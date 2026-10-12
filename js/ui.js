import { prefersReducedMotion, escapeHtml, formatPrice, formatDate, formatDateTime } from './format.js';
import { animateRows } from './motion.js';
import { productIllustration as thumbnail } from './products.js';

const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const statusClass = status => ({ Delivered: 'delivered', 'In transit': 'in-transit', Cancelled: 'cancelled' }[status] || 'in-transit');
const badge = status => `<span class="status-badge status-badge--${statusClass(status)}">${escapeHtml(status)}</span>`;
const channel = name => `<span class="platform-tag"><span class="channel-symbol channel-symbol--${name.toLowerCase()}" aria-hidden="true">${{Amazon:'a',eBay:'e',AliExpress:'A'}[name] || ''}</span>${escapeHtml(name)}</span>`;

export function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role','status');
    document.body.appendChild(container);
  }
  [...container.querySelectorAll('.toast')].slice(0,-1).forEach(dismissToast);
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${type === 'error' ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3h.01"/>' : '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'}</svg>`;
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(text);
  container.append(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  toast._timer = setTimeout(() => dismissToast(toast),3500);
}
function dismissToast(toast) {
  clearTimeout(toast._timer);
  toast.classList.remove('toast--visible');
  setTimeout(() => toast.remove(),220);
}

export function renderSkeletons(trendContainer, platformContainer) {
  document.querySelectorAll('.kpi-card').forEach(card => {
    cancelAnimationFrame(card._raf);
    card._displayed = undefined;
    card.querySelector('.kpi-card__value').innerHTML = '<div class="skeleton skeleton-title"></div>';
    card.querySelector('.kpi-card__change').textContent = '—';
  });
  trendContainer.innerHTML = '<div class="skeleton skeleton-chart"></div>';
  platformContainer.innerHTML = '<div class="skeleton skeleton-circle"></div>';
  document.querySelector('.data-table tbody').innerHTML = Array.from({length:6}, () => '<tr class="skeleton-tr"><td colspan="6"><div class="skeleton skeleton-row"></div></td></tr>').join('');
}

function buildStatePanel({ text, actionLabel, onAction }) {
  const wrap = document.createElement('div');
  wrap.className = 'state-panel';
  wrap.innerHTML = icon('search');
  const message = document.createElement('p');
  message.textContent = text;
  wrap.append(message);
  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'state-panel__action';
    button.textContent = actionLabel;
    button.addEventListener('click',onAction);
    wrap.append(button);
  }
  return wrap;
}
export function renderEmptyState(containers, options) {
  containers.forEach(container => container.replaceChildren(buildStatePanel(options)));
}
export function renderErrorState(containers, onRetry) {
  renderEmptyState(containers, { text: 'Sales data could not be loaded.', actionLabel: 'Try again', onAction: onRetry });
}

export function renderKPI(metrics) {
  document.querySelectorAll('.kpi-card').forEach(card => {
    const metric = metrics[card.dataset.kpi];
    if (!metric) return;
    const valueEl = card.querySelector('.kpi-card__value');
    const changeEl = card.querySelector('.kpi-card__change');
    const initial = card._displayed === undefined;
    const from = card._displayed ?? 0;
    const to = metric.value;
    cancelAnimationFrame(card._raf);
    if (prefersReducedMotion() || from === to) {
      card._displayed = to;
      valueEl.textContent = metric.format(to);
    } else {
      const start = performance.now();
      const tick = now => {
        const progress = Math.min(1,(now-start)/(initial ? 1200 : 700));
        card._displayed = from + (to-from) * (1-Math.pow(1-progress,3));
        valueEl.textContent = metric.format(card._displayed);
        if (progress < 1) card._raf = requestAnimationFrame(tick);
      };
      card._raf = requestAnimationFrame(tick);
    }
    changeEl.textContent = metric.changeLabel;
    changeEl.title = metric.changeLabel.endsWith(' pp') ? 'Change in percentage points' : '';
    changeEl.className = 'kpi-card__change kpi-card__change--' + (metric.change === null ? 'neutral' : metric.change >= 0 ? 'positive' : 'negative');
  });
}

export function renderTable(rows, { onReset, emptyText = 'No orders match these filters.', actionLabel = 'Clear filters' } = {}) {
  const tbody = document.querySelector('.data-table tbody');
  const previous = new Map([...tbody.querySelectorAll('.data-table__row')].map(row => [row.dataset.row, row.getBoundingClientRect().top]));
  tbody.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.className = 'data-table__empty';
    const td = document.createElement('td');
    td.colSpan = 6;
    td.append(buildStatePanel({ text: emptyText, actionLabel, onAction: onReset }));
    tr.append(td);
    tbody.append(tr);
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'data-table__row';
    tr.dataset.row = row.id;
    tr.innerHTML = `
      <td><button class="product-button" data-order="${escapeHtml(row.id)}" aria-label="View ${escapeHtml(row.product)}, order ${escapeHtml(row.id)}">${thumbnail(row.category)}<span><span class="product-name">${escapeHtml(row.product)}</span><span class="order-id">${escapeHtml(row.id)}</span></span></button></td>
      <td>${channel(row.platform)}</td>
      <td class="data-table__date"><time datetime="${escapeHtml(row.date)}">${formatDate(row.date)}</time></td>
      <td class="data-table__amount">${formatPrice(row.amount)}</td>
      <td>${badge(row.status)}</td>
      <td><button class="icon-button order-open" data-order="${escapeHtml(row.id)}" aria-label="View order ${escapeHtml(row.id)}">${icon('chevron')}</button></td>`;
    tbody.append(tr);
  });
  animateRows(tbody, previous);
}

export function renderOrderDetail(row, container) {
  const statusCopy = {
    Delivered: 'This order has reached its destination.',
    'In transit': 'This order has shipped and is on its way.',
    Cancelled: 'This order was cancelled. It is excluded from sales revenue.'
  };
  container.innerHTML = `<div class="dialog-header"><div><h2 id="order-dialog-title">Order ${escapeHtml(row.id)}</h2><p>Order details</p></div><button class="icon-button" data-close-dialog aria-label="Close order details" autofocus>${icon('close')}</button></div>
    <div class="order-detail__product">${thumbnail(row.category)}<div><strong>${escapeHtml(row.product)}</strong><p>${escapeHtml(row.variant)}</p></div></div>
    <dl class="order-detail__info"><div><dt>Status</dt><dd>${badge(row.status)}</dd></div><div><dt>Sales channel</dt><dd>${channel(row.platform)}</dd></div><div><dt>Placed (UTC)</dt><dd>${formatDateTime(row.date)}</dd></div><div><dt>Quantity</dt><dd>${row.quantity}</dd></div><div><dt>Unit price</dt><dd>${formatPrice(row.unitPrice)}</dd></div><div class="order-total"><dt>Order amount</dt><dd>${formatPrice(row.amount)}</dd></div></dl>
    <div class="order-detail__status"><h3>${escapeHtml(row.status)}</h3><p>${statusCopy[row.status]}</p></div>
    <p class="dialog-note">Sample order from the Studio Supply demo. No payment or fulfilment actions are performed here.</p>`;
}
