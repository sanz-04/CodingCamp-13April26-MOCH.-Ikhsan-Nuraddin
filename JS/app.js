/* ─── State ──────────────────────────────────────────────────── */
const STORAGE_KEY    = 'dompetku_transactions';
const THEME_KEY      = 'dompetku_theme';
const CUSTOM_CAT_KEY = 'dompetku_custom_cats';
const LIMIT_KEY      = 'dompetku_limit';

// Default categories
const DEFAULT_CATS = [
  { name: 'Makanan',      emoji: '🍜', color: '#f97066' },
  { name: 'Transportasi', emoji: '🚌', color: '#38bdf8' },
  { name: 'Hiburan',      emoji: '🎮', color: '#34d399' },
];

let customCategories = loadCustomCats();
let transactions     = loadFromStorage();
let chart            = null;
let currentMonth     = new Date().getMonth();
let currentYear      = new Date().getFullYear();
let spendingLimit    = parseFloat(localStorage.getItem(LIMIT_KEY)) || 0;
let sortMode         = 'date';

// Helpers: merged category list
function allCategories() {
  return [...DEFAULT_CATS, ...customCategories];
}
function getCatMeta(name) {
  return allCategories().find(c => c.name === name)
    || { name, emoji: '💸', color: '#8a90a8' };
}
// Keep CATEGORY_COLORS dynamic
function getCategoryColors() {
  const obj = {};
  allCategories().forEach(c => { obj[c.name] = c.color; });
  return obj;
}

/* ─── Storage Helpers ────────────────────────────────────────── */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function loadCustomCats() {
  try {
    const raw = localStorage.getItem(CUSTOM_CAT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveCustomCats() {
  localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(customCategories));
}

/* ─── DOM References ─────────────────────────────────────────── */
const sortSelect    = document.getElementById('sortSelect');
const limitInput    = document.getElementById('limitInput');
const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const btnManageCat  = document.getElementById('btnManageCat');
const btnAddCustCat = document.getElementById('btnAddCustomCat');
const customCatName = document.getElementById('customCatName');
const customCatList = document.getElementById('customCatList');
const prevMonthBtn  = document.getElementById('prevMonth');
const nextMonthBtn  = document.getElementById('nextMonth');
const monthLabel    = document.getElementById('monthLabel');

/* ─── Form Submission ────────────────────────────────────────── */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const tx = {
    id: Date.now(),
    name: inputName.value.trim(),
    amount: parseFloat(inputAmount.value),
    category: inputCategory.value,
    date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
  };

  transactions.unshift(tx);
  saveToStorage();
  renderAll();
  resetForm();
});

/* ─── Validation ─────────────────────────────────────────────── */
function validateForm() {
  let valid = true;
  clearErrors();

  if (!inputName.value.trim()) {
    showError('errorName', 'Nama item wajib diisi', inputName);
    valid = false;
  }

  const amt = parseFloat(inputAmount.value);
  if (!inputAmount.value || isNaN(amt) || amt <= 0) {
    showError('errorAmount', 'Masukkan jumlah yang valid', inputAmount);
    valid = false;
  }

  if (!inputCategory.value) {
    showError('errorCategory', 'Pilih kategori', inputCategory);
    valid = false;
  }

  return valid;
}

function showError(id, msg, field) {
  document.getElementById(id).textContent = msg;
  field.classList.add('error');
}

function clearErrors() {
  ['errorName', 'errorAmount', 'errorCategory'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  [inputName, inputAmount, inputCategory].forEach(el => el.classList.remove('error'));
}

function resetForm() {
  form.reset();
  clearErrors();
}

/* ─── Delete ─────────────────────────────────────────────────── */
function deleteTransaction(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  saveToStorage();
  renderAll();
}

/* ─── Sort & Limit Controls ─────────────────────────────────── */
sortSelect.addEventListener('change', () => {
  sortMode = sortSelect.value;
  renderList();
});

if (spendingLimit > 0) limitInput.value = spendingLimit;
limitInput.addEventListener('input', () => {
  spendingLimit = parseFloat(limitInput.value) || 0;
  localStorage.setItem(LIMIT_KEY, spendingLimit);
  renderList();
});

function getSortedTransactions() {
  const list = [...transactions];
  if (sortMode === 'amount-desc') return list.sort((a,b) => b.amount - a.amount);
  if (sortMode === 'amount-asc')  return list.sort((a,b) => a.amount - b.amount);
  if (sortMode === 'category')    return list.sort((a,b) => a.category.localeCompare(b.category));
  return list; // 'date' = original insert order
}

/* ─── Custom Category Modal ──────────────────────────────────── */
let selectedEmoji = '⭐';
let selectedColor = '#a78bfa';

btnManageCat.addEventListener('click', () => {
  renderCustomCatList();
  modalOverlay.classList.add('open');
});
modalClose.addEventListener('click', () => modalOverlay.classList.remove('open'));
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('open');
});

document.getElementById('emojiPicker').addEventListener('click', (e) => {
  const btn = e.target.closest('.emoji-btn');
  if (!btn) return;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedEmoji = btn.dataset.emoji;
});

document.getElementById('colorPicker').addEventListener('click', (e) => {
  const btn = e.target.closest('.color-btn');
  if (!btn) return;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedColor = btn.dataset.color;
});

btnAddCustCat.addEventListener('click', () => {
  const name = customCatName.value.trim();
  const errEl = document.getElementById('errorCustomCat');
  errEl.textContent = '';

  if (!name) { errEl.textContent = 'Nama kategori wajib diisi.'; return; }
  if (allCategories().some(c => c.name.toLowerCase() === name.toLowerCase())) {
    errEl.textContent = 'Kategori sudah ada.'; return;
  }

  customCategories.push({ name, emoji: selectedEmoji, color: selectedColor });
  saveCustomCats();
  customCatName.value = '';
  refreshCategorySelect();
  renderCustomCatList();
  renderCategorySummary();
  renderChart();
});

function renderCustomCatList() {
  customCatList.innerHTML = '';
  if (customCategories.length === 0) {
    customCatList.innerHTML = '<p style="font-size:0.78rem;color:var(--text-3);text-align:center;margin-top:8px">Belum ada kategori kustom.</p>';
    return;
  }
  customCategories.forEach((cat, idx) => {
    const row = document.createElement('div');
    row.className = 'custom-cat-row';
    row.innerHTML = `
      <span class="cat-badge">${cat.emoji}</span>
      <span class="cat-badge-name" style="color:${cat.color}">${escapeHtml(cat.name)}</span>
      <button class="btn-delete-cat" data-idx="${idx}">✕</button>
    `;
    customCatList.appendChild(row);
  });
  customCatList.querySelectorAll('.btn-delete-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      customCategories.splice(idx, 1);
      saveCustomCats();
      refreshCategorySelect();
      renderCustomCatList();
      renderAll();
    });
  });
}

function refreshCategorySelect() {
  const sel = document.getElementById('itemCategory');
  sel.innerHTML = '<option value="">Pilih…</option>';
  allCategories().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    sel.appendChild(opt);
  });
}

/* ─── Monthly Summary ────────────────────────────────────────── */
prevMonthBtn.addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderMonthlySummary();
});
nextMonthBtn.addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderMonthlySummary();
});

function renderMonthlySummary() {
  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  monthLabel.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

  const filtered = transactions.filter(tx => {
    const d = new Date(tx.id); // id = Date.now() saat dibuat
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const max   = filtered.length ? Math.max(...filtered.map(t => t.amount)) : 0;
  const avg   = filtered.length ? total / filtered.length : 0;

  document.getElementById('mTotal').textContent = formatRupiah(total);
  document.getElementById('mCount').textContent = filtered.length;
  document.getElementById('mMax').textContent   = formatRupiah(max);
  document.getElementById('mAvg').textContent   = formatRupiah(avg);

  // Per-category breakdown
  const breakdown = {};
  filtered.forEach(tx => {
    breakdown[tx.category] = (breakdown[tx.category] || 0) + tx.amount;
  });
  const breakdownEl = document.getElementById('monthlyCatBreakdown');
  breakdownEl.innerHTML = '';
  Object.entries(breakdown).sort((a,b) => b[1]-a[1]).forEach(([cat, amt]) => {
    const meta = getCatMeta(cat);
    const row = document.createElement('div');
    row.className = 'mcat-row';
    row.innerHTML = `
      <div class="mcat-dot" style="background:${meta.color}"></div>
      <span class="mcat-name">${meta.emoji} ${escapeHtml(cat)}</span>
      <span class="mcat-total">${formatRupiah(amt)}</span>
    `;
    breakdownEl.appendChild(row);
  });
  if (!filtered.length) {
    breakdownEl.innerHTML = '<p style="font-size:0.78rem;color:var(--text-3);text-align:center">Tidak ada transaksi bulan ini.</p>';
  }
}

/* ─── Render All ─────────────────────────────────────────────── */
function renderAll() {
  renderList();
  renderTotal();
  renderChart();
  renderCategorySummary();
}

/* ─── Render List ────────────────────────────────────────────── */
function renderList() {
  const sorted = getSortedTransactions();
  txCount.textContent = `${sorted.length} transaksi`;

  const existing = txList.querySelectorAll('.tx-item');
  existing.forEach(el => el.remove());

  if (sorted.length === 0) { emptyState.style.display = 'flex'; return; }
  emptyState.style.display = 'none';

  sorted.forEach(tx => {
    const meta    = getCatMeta(tx.category);
    const isOver  = spendingLimit > 0 && tx.amount > spendingLimit;
    const item    = document.createElement('div');
    item.className = `tx-item${isOver ? ' over-limit' : ''}`;
    item.dataset.id = tx.id;
    item.innerHTML = `
      <div class="tx-icon" style="background:${meta.color}22">${meta.emoji}</div>
      <div class="tx-details">
        <div class="tx-name">${escapeHtml(tx.name)}</div>
        <div class="tx-cat">${tx.category} · ${tx.date}</div>
      </div>
      <div class="tx-amount" style="color:${meta.color}">${formatRupiah(tx.amount)}</div>
      <button class="btn-delete" title="Hapus" data-id="${tx.id}">✕</button>
    `;
    txList.appendChild(item);
  });

  txList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(Number(btn.dataset.id)));
  });
}

/* ─── Render Total ───────────────────────────────────────────── */
function renderTotal() {
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  totalBalance.textContent = formatRupiah(total);
}

/* ─── Render Chart ───────────────────────────────────────────── */
function renderChart() {
  const totals = getCategoryTotals();
  const labels = Object.keys(totals).filter(k => totals[k] > 0);
  const data   = labels.map(k => totals[k]);
  const colors = labels.map(k => getCategoryColors()[k] || '#8a90a8');

  if (labels.length === 0) {
    chartEmpty.style.opacity = '1';
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  chartEmpty.style.opacity = '0';

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update('active');
    return;
  }

  chart = new Chart(chartCanvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#151820',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#8a90a8',
            font: { family: 'DM Sans', size: 12 },
            padding: 16,
            boxWidth: 12,
            boxHeight: 12,
            borderRadius: 4,
            useBorderRadius: true,
          },
        },
        tooltip: {
          backgroundColor: '#1c2030',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#f0f2f8',
          bodyColor: '#8a90a8',
          padding: 12,
          callbacks: {
            label: (ctx) => ` ${formatRupiah(ctx.parsed)}`,
          },
        },
      },
      animation: { duration: 500, easing: 'easeInOutQuart' },
    },
  });
}

/* ─── Render Category Summary ────────────────────────────────── */
function renderCategorySummary() {
  const totals = getCategoryTotals();
  const grand  = Object.values(totals).reduce((s, v) => s + v, 0);

  ['Makanan', 'Transportasi', 'Hiburan'].forEach(cat => {
    const amt = totals[cat] ?? 0;
    const pct = grand > 0 ? (amt / grand) * 100 : 0;
    const el  = document.getElementById(`total${cat}`);
    const bar = document.getElementById(`bar${cat}`);
    if (el)  el.textContent   = formatRupiah(amt);
    if (bar) bar.style.width  = `${pct}%`;
  });
}

/* ─── Utilities ──────────────────────────────────────────────── */
function getCategoryTotals() {
  return transactions.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
    return acc;
  }, {});
}

function formatRupiah(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Dark / Light Mode ──────────────────────────────────────── */
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.getElementById('themeIcon');
const THEME_KEY   = 'dompetku_theme';

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light');
    themeIcon.textContent = '🌙';
  } else {
    document.body.classList.remove('light');
    themeIcon.textContent = '☀️';
  }
  localStorage.setItem(THEME_KEY, theme);
}

themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light');
  applyTheme(isLight ? 'dark' : 'light');
});

// Load saved theme on startup
applyTheme(localStorage.getItem(THEME_KEY) ?? 'dark');

/* ─── Init ───────────────────────────────────────────────────── */
refreshCategorySelect();
renderAll();
function renderAll() {
  renderList();
  renderTotal();
  renderChart();
  renderCategorySummary();
  renderMonthlySummary();
}
renderMonthlySummary();
if (spendingLimit > 0) limitInput.value = spendingLimit;
