/* ─── State ──────────────────────────────────────────────────── */
const STORAGE_KEY = 'dompetku_transactions';
const CATEGORY_EMOJI = { Makanan: '🍜', Transportasi: '🚌', Hiburan: '🎮' };
const CATEGORY_COLORS = {
  Makanan:      '#f97066',
  Transportasi: '#38bdf8',
  Hiburan:      '#34d399',
};

let transactions = loadFromStorage();
let chart = null;

/* ─── Storage Helpers ────────────────────────────────────────── */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/* ─── DOM References ─────────────────────────────────────────── */
const form          = document.getElementById('transactionForm');
const inputName     = document.getElementById('itemName');
const inputAmount   = document.getElementById('itemAmount');
const inputCategory = document.getElementById('itemCategory');
const totalBalance  = document.getElementById('totalBalance');
const txList        = document.getElementById('transactionList');
const emptyState    = document.getElementById('emptyState');
const txCount       = document.getElementById('txCount');
const chartEmpty    = document.getElementById('chartEmpty');
const chartCanvas   = document.getElementById('expenseChart');

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

/* ─── Render All ─────────────────────────────────────────────── */
function renderAll() {
  renderList();
  renderTotal();
  renderChart();
  renderCategorySummary();
}

/* ─── Render List ────────────────────────────────────────────── */
function renderList() {
  const count = transactions.length;
  txCount.textContent = `${count} transaksi`;

  // Remove existing tx items (keep emptyState in DOM)
  const existing = txList.querySelectorAll('.tx-item');
  existing.forEach(el => el.remove());

  if (count === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  transactions.forEach(tx => {
    const item = document.createElement('div');
    item.className = 'tx-item';
    item.dataset.id = tx.id;
    item.innerHTML = `
      <div class="tx-icon ${tx.category}">${CATEGORY_EMOJI[tx.category] ?? '💸'}</div>
      <div class="tx-details">
        <div class="tx-name">${escapeHtml(tx.name)}</div>
        <div class="tx-cat">${tx.category} · ${tx.date}</div>
      </div>
      <div class="tx-amount ${tx.category}">${formatRupiah(tx.amount)}</div>
      <button class="btn-delete" title="Hapus" data-id="${tx.id}">✕</button>
    `;
    txList.appendChild(item);
  });

  // Delegate delete clicks
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
  const colors = labels.map(k => CATEGORY_COLORS[k]);

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

    document.getElementById(`total${cat}`).textContent = formatRupiah(amt);
    document.getElementById(`bar${cat}`).style.width = `${pct}%`;
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
renderAll();
