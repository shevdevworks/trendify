export function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  
  const iconPath = type === 'error' 
    ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
    : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';

  toast.innerHTML = `
    <svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${iconPath}
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

export function renderSkeletons(trendContainer, platformContainer) {
  const kpiCards = document.querySelectorAll('.kpi-card');
  kpiCards.forEach(card => {
    const valueEl = card.querySelector('.kpi-card__value');
    const changeEl = card.querySelector('.kpi-card__change');
    if (valueEl) valueEl.innerHTML = '<div class="skeleton skeleton-title"></div>';
    if (changeEl) changeEl.innerHTML = '<div class="skeleton skeleton-text"></div>';
  });

  if (trendContainer) trendContainer.innerHTML = '<div class="skeleton skeleton-chart"></div>';
  if (platformContainer) platformContainer.innerHTML = '<div class="skeleton skeleton-circle"></div>';

  const tbody = document.querySelector('.data-table tbody');
  if (tbody) {
    tbody.innerHTML = '';
    for(let i = 0; i < 5; i++) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6"><div class="skeleton skeleton-row" style="height: 48px; margin: 0;"></div></td>`;
      tbody.appendChild(tr);
    }
  }
}

/**
 * Renders a recoverable error panel inside the chart containers instead of
 * leaving the skeleton loaders spinning forever when a fetch fails.
 * @param {HTMLElement | null} trendContainer
 * @param {HTMLElement | null} platformContainer
 * @param {() => void} onRetry - called when the user clicks "Retry"
 */
export function renderErrorState(trendContainer, platformContainer, onRetry) {
  const buildPanel = () => {
    const wrap = document.createElement('div');
    wrap.className = 'error-state';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '26');
    icon.setAttribute('height', '26');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';

    const msg = document.createElement('span');
    msg.className = 'error-state__text';
    msg.textContent = 'Unable to load telemetry data.';

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'error-state__retry';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => onRetry?.());

    wrap.append(icon, msg, retryBtn);
    return wrap;
  };

  if (trendContainer) {
    trendContainer.innerHTML = '';
    trendContainer.appendChild(buildPanel());
  }
  if (platformContainer) {
    platformContainer.innerHTML = '';
    platformContainer.appendChild(buildPanel());
  }
}

export function renderKPI(data) {
  const kpiData = [data.revenue, data.orders, data.averageCheck, data.margin];
  const cards = document.querySelectorAll('.kpi-card');

  cards.forEach((card, i) => {
    const valueEl = card.querySelector('.kpi-card__value');
    const changeEl = card.querySelector('.kpi-card__change');
    const targetData = kpiData[i];

    if (valueEl) valueEl.textContent = targetData.value;
    if (changeEl) {
      changeEl.textContent = targetData.trend;
      changeEl.className = 'kpi-card__change ' + 
        (targetData.isPositive ? 'kpi-card__change--positive' : 'kpi-card__change--negative');
    }
  });
}

/**
 * Applies the current platform/stream filters to a list of transactions.
 * Shared between table rendering and CSV export so both always agree on
 * exactly which rows are "currently visible".
 * @param {Array<Object>} transactions
 * @param {Object} globalState
 * @returns {Array<Object>}
 */
export function filterTransactions(transactions, globalState) {
  return transactions.filter(item => {
    const matchPlatform = globalState.currentPlatform === 'all' || item.platform.toLowerCase() === globalState.currentPlatform.toLowerCase();
    const matchStream = globalState.activeStreams.includes(item.platform);
    return matchPlatform && matchStream;
  });
}

export function renderTable(transactions, globalState) {
  const tbody = document.querySelector('.data-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filteredData = filterTransactions(transactions, globalState);

  if (filteredData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px !important;color:var(--text-secondary);">No transactions match filter.</td></tr>`;
    return;
  }

  filteredData.forEach((row) => {
    const tr = document.createElement('tr');
    let statusClass = 'status-badge--delivered';
    if (row.status === 'In Transit') statusClass = 'status-badge--in-transit';
    if (row.status === 'Cancelled') statusClass = 'status-badge--cancelled';

    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${row.date}</td>
      <td><strong>${row.product}</strong></td>
      <td><span class="platform-tag platform-tag--${row.platform.toLowerCase()}">${row.platform}</span></td>
      <td style="font-weight: 700;">${row.price}</td>
      <td><span class="status-badge ${statusClass}">${row.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}