const form = document.getElementById('expense-form');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit');
const tableBody = document.querySelector('#expenses-table tbody');
const totalEl = document.getElementById('total');
const filterSelect = document.getElementById('filter-category');
const sortNewest = document.getElementById('sort-newest');

async function fetchExpenses() {
  const params = [];
  const category = filterSelect.value;
  if (category) params.push(`category=${encodeURIComponent(category)}`);
  if (sortNewest.checked) params.push('sort=date_desc');
  const qs = params.length ? '?' + params.join('&') : '';
  const res = await fetch('/expenses' + qs);
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}

function formatAmount(a) {
  return Number(a).toFixed(2);
}

function renderExpenses(data) {
  tableBody.innerHTML = '';
  const seenCategories = new Set();
  data.expenses.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.date}</td><td>${e.category}</td><td>${e.description}</td><td style="text-align:right">${formatAmount(e.amount)}</td>`;
    tableBody.appendChild(tr);
    seenCategories.add(e.category);
  });
  totalEl.textContent = `₹${formatAmount(data.total)}`;

  // populate filter options
  const prev = filterSelect.value;
  filterSelect.innerHTML = '<option value="">All</option>';
  Array.from(seenCategories).sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    filterSelect.appendChild(opt);
  });
  if (prev) filterSelect.value = prev;
}

function computeSummary(expenses) {
  const map = new Map();
  expenses.forEach(e => {
    const amt = Number(e.amount);
    const cur = map.get(e.category) || 0;
    map.set(e.category, cur + amt);
  });
  // convert to sorted array by amount desc
  return Array.from(map.entries()).map(([category, total]) => ({category, total})).sort((a,b)=> b.total - a.total);
}

function renderSummary(data) {
  const list = document.getElementById('summary-list');
  if (!list) return;
  list.innerHTML = '';
  const summary = computeSummary(data.expenses);
  if (summary.length === 0) {
    list.innerHTML = '<li class="muted">No expenses</li>';
    return;
  }
  summary.forEach(item => {
    const li = document.createElement('li');
    li.className = 'summary-item';
    li.innerHTML = `<span class="cat">${item.category}</span><span class="sum">₹${formatAmount(item.total)}</span>`;
    list.appendChild(li);
  });
}

async function loadAndRender() {
  try {
    statusEl.textContent = 'Loading...';
    const data = await fetchExpenses();
    renderExpenses(data);
    renderSummary(data);
    statusEl.textContent = '';
  } catch (e) {
    statusEl.textContent = 'Error loading expenses';
  }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  // basic client-side validation
  const amountField = document.getElementById('amount');
  const categoryField = document.getElementById('category');
  const dateField = document.getElementById('date');
  const amountVal = parseFloat(amountField.value);

  // reset previous invalid states
  [amountField, categoryField, dateField].forEach(f => f.classList.remove('invalid'));

  if (isNaN(amountVal) || amountVal < 0) {
    statusEl.textContent = 'Please enter a non-negative amount';
    amountField.classList.add('invalid');
    amountField.focus();
    return;
  }
  if (!categoryField.value.trim()) {
    statusEl.textContent = 'Please enter a category';
    categoryField.classList.add('invalid');
    categoryField.focus();
    return;
  }
  if (!dateField.value) {
    statusEl.textContent = 'Please select a date';
    dateField.classList.add('invalid');
    dateField.focus();
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = 'Submitting...';

  const payload = {
    id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now(),
    amount: document.getElementById('amount').value,
    category: document.getElementById('category').value,
    description: document.getElementById('description').value,
    date: document.getElementById('date').value
  };

  try {
    const res = await fetch('/expenses', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('submit failed');
    await loadAndRender();
    statusEl.textContent = 'Saved';
    setTimeout(()=> statusEl.textContent = '', 1500);
    form.reset();
  } catch (e) {
    statusEl.textContent = 'Save failed — try again';
  } finally {
    submitBtn.disabled = false;
  }
});

// remove invalid state while typing
['amount','category','date'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => el.classList.remove('invalid'));
  el.addEventListener('change', () => el.classList.remove('invalid'));
});

filterSelect.addEventListener('change', loadAndRender);
sortNewest.addEventListener('change', loadAndRender);

// initial load
window.addEventListener('load', loadAndRender);

