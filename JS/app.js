/* ── State ──────────────────────────────────────────── */
const STORAGE_KEYS = {
  transactions: 'fintrack_txs',
  categories:   'fintrack_cats',
  budget:       'fintrack_budget',
  theme:        'fintrack_theme',
};

const DEFAULT_CATEGORIES = ['Makanan', 'Transportasi', 'Hiburan', 'Kesehatan', 'Belanja', 'Tagihan'];

const CATEGORY_COLORS = [
  '#3fb950','#58a6ff','#f78166','#d29922','#bc8cff','#39d353',
  '#ff7b72','#79c0ff','#ffa657','#56d364','#db61a2','#7ee787',
];

let state = {
  transactions: [],
  categories:   [],
  budget:       0,
  sortBy:       'date',    // date | amount | category
  filterMonth:  null,
};

let chart = null;

/* ── Storage ────────────────────────────────────────── */
function save() {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
  localStorage.setItem(STORAGE_KEYS.categories,   JSON.stringify(state.categories));
  localStorage.setItem(STORAGE_KEYS.budget,        String(state.budget));
}

function load() {
  state.transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions) || '[]');
  state.categories   = JSON.parse(localStorage.getItem(STORAGE_KEYS.categories)   || 'null')
                       ?? [...DEFAULT_CATEGORIES];
  state.budget       = parseFloat(localStorage.getItem(STORAGE_KEYS.budget) || '0');

  const theme = localStorage.getItem(STORAGE_KEYS.theme) || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

/* ── Theme ──────────────────────────────────────────── */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEYS.theme, next);
  updateThemeIcon(next);
  if (chart) updateChart();
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ── Category colour map ────────────────────────────── */
function getCatColor(cat) {
  const all = [...DEFAULT_CATEGORIES, ...state.categories.filter(c => !DEFAULT_CATEGORIES.includes(c))];
  const idx = all.indexOf(cat);
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] ?? '#8b949e';
}

/* ── Format ─────────────────────────────────────────── */
function fmt(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

/* ── Render select options ──────────────────────────── */
function renderCategoryOptions() {
  const sel = document.getElementById('txCategory');
  const cur = sel.value;
  sel.innerHTML = state.categories
    .map(c => `<option value="${c}"${c === cur ? ' selected' : ''}>${c}</option>`)
    .join('');
}

/* ── Render Transaction List ────────────────────────── */
function getSortedFiltered() {
  let txs = [...state.transactions];

  // filter by month
  if (state.filterMonth) {
    txs = txs.filter(t => t.date.slice(0, 7) === state.filterMonth);
  }

  // sort
  if (state.sortBy === 'amount')   txs.sort((a, b) => b.amount - a.amount);
  if (state.sortBy === 'category') txs.sort((a, b) => a.category.localeCompare(b.category));
  if (state.sortBy === 'date')     txs.sort((a, b) => new Date(b.date) - new Date(a.date));

  return txs;
}

function renderList() {
  const container = document.getElementById('txList');
  const txs = getSortedFiltered();

  if (!txs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="emoji">💸</div>
        <p>Belum ada transaksi.<br>Tambahkan pengeluaran pertamamu!</p>
      </div>`;
    return;
  }

  container.innerHTML = txs.map(t => {
    const color    = getCatColor(t.category);
    const overBudget = state.budget > 0 && t.amount > state.budget;
    return `
      <div class="tx-item${overBudget ? ' over-budget' : ''}" data-id="${t.id}">
        <span class="tx-dot" style="background:${color}"></span>
        <div class="tx-info">
          <div class="tx-name">${escHtml(t.name)}</div>
          <div class="tx-cat">
            <span style="color:${color}">●</span>
            ${escHtml(t.category)} · ${formatDate(t.date)}
          </div>
          ${overBudget ? '<span class="tx-flag">⚠ Melebihi batas</span>' : ''}
        </div>
        <span class="tx-amount">${fmt(t.amount)}</span>
        <button class="btn-danger-sm" onclick="deleteTransaction('${t.id}')" title="Hapus">✕</button>
      </div>`;
  }).join('');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Render Stats ───────────────────────────────────── */
function renderStats() {
  const total = state.transactions.reduce((s, t) => s + t.amount, 0);
  document.getElementById('totalBalance').textContent = fmt(total);
  document.getElementById('totalSpent').textContent   = fmt(total);

  const bLeft = Math.max(0, state.budget - total);
  document.getElementById('budgetLeft').textContent = state.budget > 0
    ? fmt(bLeft) + (bLeft <= 0 ? ' 🔴' : '')
    : 'Belum diatur';

  document.getElementById('budgetInput').value = state.budget || '';
}

/* ── Render Monthly Summary ─────────────────────────── */
function getMonths() {
  const months = [...new Set(state.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  return months;
}

function renderMonthTabs() {
  const months = getMonths();
  const container = document.getElementById('monthTabs');

  if (!months.length) {
    container.innerHTML = '<span style="color:var(--muted);font-size:12px">Belum ada data</span>';
    return;
  }

  container.innerHTML = ['Semua', ...months].map(m => {
    const label  = m === 'Semua' ? 'Semua' : formatMonth(m);
    const active = (m === 'Semua' && !state.filterMonth) || m === state.filterMonth;
    return `<button class="month-tab${active ? ' active' : ''}" onclick="setMonth('${m}')">${label}</button>`;
  }).join('');
}

function formatMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
}

function setMonth(m) {
  state.filterMonth = m === 'Semua' ? null : m;
  renderAll();
}

function renderMonthlySummary() {
  const txs   = getSortedFiltered();
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const count = txs.length;
  const avg   = count ? total / count : 0;

  // top category
  const byCat = {};
  txs.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('monthTotal').textContent = fmt(total);
  document.getElementById('monthCount').textContent = count + ' transaksi';
  document.getElementById('monthAvg').textContent   = fmt(Math.round(avg));
  document.getElementById('monthTop').textContent   = topCat ? topCat[0] : '—';
}

/* ── Chart ──────────────────────────────────────────── */
function renderChart() {
  const txs  = getSortedFiltered();
  const byCat = {};
  txs.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });

  const labels = Object.keys(byCat);
  const data   = Object.values(byCat);
  const colors = labels.map(getCatColor);
  const total  = data.reduce((s, v) => s + v, 0);

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? '#e6edf3' : '#1a1f2e';

  const ctx = document.getElementById('spendChart').getContext('2d');

  if (chart) { chart.destroy(); chart = null; }

  if (!labels.length) {
    document.getElementById('chartLegend').innerHTML =
      '<p style="color:var(--muted);font-size:13px;text-align:center">Belum ada data</p>';
    return;
  }

  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor:      'transparent',
        borderWidth:      0,
        hoverOffset:      8,
      }]
    },
    options: {
      cutout:    '70%',
      animation: { animateRotate: true, duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.raw)} (${((ctx.raw/total)*100).toFixed(1)}%)`
          }
        }
      }
    }
  });

  // legend
  document.getElementById('chartLegend').innerHTML = labels.map((l, i) => `
    <div class="legend-item">
      <div class="legend-dot-name">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span class="legend-name">${escHtml(l)}</span>
      </div>
      <span class="legend-pct">${((data[i]/total)*100).toFixed(1)}%</span>
    </div>`).join('');
}

function updateChart() { renderChart(); }

/* ── Add Transaction ────────────────────────────────── */
function addTransaction(e) {
  e.preventDefault();

  const name   = document.getElementById('txName').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const cat    = document.getElementById('txCategory').value;

  let valid = true;

  setFieldError('txName',   !name,            'Nama item wajib diisi');
  setFieldError('txAmount', !amount || amount <= 0, 'Masukkan jumlah yang valid');
  setFieldError('txCategory', !cat,           'Pilih kategori');

  if (!name || !amount || amount <= 0 || !cat) return;

  const tx = {
    id:       crypto.randomUUID(),
    name,
    amount,
    category: cat,
    date:     new Date().toISOString(),
  };

  state.transactions.unshift(tx);
  save();
  renderAll();

  // reset form
  document.getElementById('txName').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txName').focus();

  toast('Transaksi ditambahkan ✓', 'success');
}

function setFieldError(id, hasError, msg) {
  const field = document.getElementById(id);
  const err   = field.nextElementSibling;
  field.classList.toggle('error', hasError);
  if (err && err.classList.contains('form-error')) {
    err.textContent = msg;
    err.classList.toggle('visible', hasError);
  }
}

/* ── Delete Transaction ─────────────────────────────── */
function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  save();
  renderAll();
  toast('Transaksi dihapus', 'error');
}

/* ── Sort ───────────────────────────────────────────── */
function setSort(by) {
  state.sortBy = by;
  document.querySelectorAll('.sort-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === by);
  });
  renderList();
  renderMonthlySummary();
}

/* ── Budget ─────────────────────────────────────────── */
function setBudget() {
  const val = parseFloat(document.getElementById('budgetInput').value);
  state.budget = isNaN(val) ? 0 : val;
  save();
  renderStats();
  renderList();
  toast('Batas anggaran disimpan ✓', 'success');
}

/* ── Custom Category Modal ──────────────────────────── */
function openCatModal() {
  renderCatChips();
  document.getElementById('catModal').classList.add('open');
}

function closeCatModal() {
  document.getElementById('catModal').classList.remove('open');
  renderCategoryOptions();
}

function renderCatChips() {
  const container = document.getElementById('catChips');
  container.innerHTML = state.categories.map(c => {
    const builtin = DEFAULT_CATEGORIES.includes(c);
    return `<span class="chip${builtin ? ' builtin' : ''}">
      ${escHtml(c)}
      <span class="chip-del" onclick="deleteCat('${escHtml(c)}')" title="Hapus">✕</span>
    </span>`;
  }).join('');
}

function deleteCat(name) {
  if (DEFAULT_CATEGORIES.includes(name)) return;
  state.categories = state.categories.filter(c => c !== name);
  save();
  renderCatChips();
}

function addCustomCat() {
  const input = document.getElementById('newCatInput');
  const name  = input.value.trim();
  if (!name) return;
  if (state.categories.includes(name)) { toast('Kategori sudah ada', 'error'); return; }
  state.categories.push(name);
  save();
  input.value = '';
  renderCatChips();
  toast(`Kategori "${name}" ditambahkan`, 'success');
}

/* ── Toast ──────────────────────────────────────────── */
let toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ── Render All ─────────────────────────────────────── */
function renderAll() {
  renderStats();
  renderList();
  renderChart();
  renderMonthTabs();
  renderMonthlySummary();
}

/* ── Init ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  load();
  renderCategoryOptions();
  renderAll();

  // close modal on backdrop click
  document.getElementById('catModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCatModal();
  });

  // new category on Enter
  document.getElementById('newCatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addCustomCat();
  });

  // clear field errors on input
  ['txName','txAmount','txCategory'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => setFieldError(id, false, ''));
  });
});
