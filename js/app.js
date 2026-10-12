import { fetchDashboardData, PLATFORMS, PERIODS } from './data.js';
import { deriveView, filterOrders, roundShares, ordersToCsv } from './model.js';
import { createTrendChart, createDonutChart } from './charts.js';
import { showToast, renderSkeletons, renderKPI, renderTable, renderErrorState, renderEmptyState, renderOrderDetail } from './ui.js';
import { PLATFORM_COLORS, formatMoney, formatPrice, formatInteger, formatPercent, formatSignedPercent } from './format.js';
import { enterWorkspace, syncSelectionTracks, openDialog, closeDialog } from './motion.js';

const state = { period: 'month', loadedPeriod: null, platform: 'all', streams: [...PLATFORMS], data: null, query: '', status: 'all', page: 1, compare: true };
const PAGE_SIZE = 6;
const $ = selector => document.querySelector(selector);
const DOM = {
  main: $('.main-content'), trend: $('#trend-chart-container'), donut: $('#platform-chart-container'),
  summary: $('#view-summary'), channels: $('#channels-dialog'), detail: $('#order-dialog'),
  export: $('#export-btn'), search: $('#order-search'), status: $('#status-filter')
};
let dispatchId = 0;
let loading = false;
const trendChart = createTrendChart(DOM.trend);
const donutChart = createDonutChart(DOM.donut, { onSelect: name => setPlatform(state.platform === name ? 'all' : name) });
const getView = () => state.data ? deriveView(state.data,state) : null;
const getOrders = view => filterOrders(view.transactions,state.query,state.status);

function syncControls() {
  document.querySelectorAll('[data-period]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.period === state.period)));
  document.querySelectorAll('.channel-btn, .chip').forEach(button => {
    const name = button.dataset.platform;
    button.setAttribute('aria-pressed',String(name === state.platform));
    button.disabled = name !== 'all' && !state.streams.includes(name);
  });
  document.querySelectorAll('.checkbox-list input').forEach(input => { input.checked = state.streams.includes(input.value); });
  $('.channel-btn__count').textContent = state.streams.length;
  syncSelectionTracks();
}

function renderMetrics(view) {
  const metric = (value, format, change, suffix = '%') => ({
    value, format, change: view.isEmpty ? null : change,
    changeLabel: view.isEmpty || change === null ? '—' : formatSignedPercent(change,suffix)
  });
  renderKPI({
    revenue: metric(view.revenue,formatMoney,view.changes.revenue),
    orders: metric(view.orders,formatInteger,view.changes.orders),
    averageCheck: metric(view.average,formatPrice,view.changes.average),
    margin: metric(view.margin,formatPercent,view.changes.margin,' pp')
  });
  document.querySelectorAll('.kpi-card__comparison').forEach(el => { el.textContent = `vs ${PERIODS[state.loadedPeriod].comparison}`; });
}

function renderTrend(view) {
  const legend = $('#trend-legend');
  if (view.isEmpty) {
    trendChart.detach();
    legend.replaceChildren();
    renderEmptyState([DOM.trend], { text: 'Choose a channel to see your sales.', actionLabel: 'Show all channels', onAction: resetChannels });
    return;
  }
  const color = view.included.length === 1 ? PLATFORM_COLORS[view.included[0]] : PLATFORM_COLORS.Amazon;
  trendChart.update({
    key: state.loadedPeriod, labels: state.data.trendLabels, values: view.trend,
    ghost: state.compare ? view.previousTrend : null, color,
    seriesName: view.included.length === 1 ? view.included[0] : 'Revenue',
    comparisonName: PERIODS[state.loadedPeriod].comparison
  });
  legend.innerHTML = `<span class="chart-legend__item"><i style="background:${color}"></i>Selected ${state.loadedPeriod}</span>${state.compare ? '<span class="chart-legend__item chart-legend__item--ghost"><i></i>Previous period</span>' : ''}`;
}

function renderDonut(view) {
  const values = PLATFORMS.map(name => state.streams.includes(name) ? state.data.platforms[name].revenue : 0);
  const shares = roundShares(values);
  const selected = state.platform !== 'all';
  donutChart.update({
    items: PLATFORMS.map((name,i) => ({ name, value: values[i], share: shares[i], enabled: state.streams.includes(name), color: PLATFORM_COLORS[name] })),
    focus: state.platform,
    centerValue: view.isEmpty ? '0' : selected ? `${shares[PLATFORMS.indexOf(state.platform)]}%` : String(state.streams.length),
    centerCaption: selected ? state.platform : state.streams.length === 1 ? 'channel' : 'channels'
  });
}

function renderSummary(view) {
  DOM.summary.hidden = !view.isFiltered;
  if (!view.isFiltered) { DOM.summary.replaceChildren(); return; }
  const names = view.included.join(' + ');
  DOM.summary.innerHTML = `<span>${view.isEmpty ? 'No channels included.' : `Showing <strong>${names}</strong>.`} Metrics and orders follow this selection.</span><button class="view-summary__reset" data-action="reset-filters">Show all</button>`;
}

function renderOrders() {
  const view = getView();
  if (!view) return;
  const rows = getOrders(view);
  const pages = Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
  state.page = Math.max(1,Math.min(state.page,pages));
  const start = (state.page-1)*PAGE_SIZE;
  renderTable(rows.slice(start,start+PAGE_SIZE), {
    onReset: () => { clearOrderFilters(); resetChannels(); },
    emptyText: view.isEmpty ? 'No channels are selected.' : 'No orders match your search or status.',
    actionLabel: 'Clear filters'
  });
  $('#ledger-count').textContent = rows.length;
  $('#table-summary').textContent = rows.length ? `${start+1}–${Math.min(start+PAGE_SIZE,rows.length)} of ${rows.length} sample orders` : '0 sample orders';
  $('#page-number').textContent = `${state.page} / ${pages}`;
  $('#prev-page').disabled = state.page === 1;
  $('#next-page').disabled = state.page >= pages;
  DOM.export.disabled = loading || rows.length === 0;
  DOM.export.title = rows.length ? `Export all ${rows.length} matching sample orders` : 'No orders to export';
}

function renderDashboard() {
  const view = getView();
  if (!view) return;
  $('#date-range').textContent = PERIODS[state.loadedPeriod].range;
  $('#trend-subtitle').textContent = PERIODS[state.loadedPeriod].resolution;
  renderMetrics(view);
  renderTrend(view);
  renderDonut(view);
  renderSummary(view);
  renderOrders();
}

async function loadData() {
  const currentId = ++dispatchId;
  const period = state.period;
  loading = true;
  DOM.main.setAttribute('aria-busy','true');
  DOM.export.disabled = true;
  if (state.data) DOM.main.classList.add('is-loading');
  else renderSkeletons(DOM.trend,DOM.donut);
  try {
    const data = await fetchDashboardData(period);
    if (currentId !== dispatchId) return;
    state.data = data;
    state.loadedPeriod = period;
    state.page = 1;
    loading = false;
    renderDashboard();
  } catch {
    if (currentId !== dispatchId) return;
    loading = false;
    if (state.data) {
      state.period = state.loadedPeriod;
      syncControls();
      renderDashboard();
      showToast('Could not load that period. Your previous view is still available.','error');
    } else {
      trendChart.detach(); donutChart.detach();
      document.querySelectorAll('.kpi-card__value,.kpi-card__change').forEach(el => { el.textContent = '—'; });
      renderErrorState([DOM.trend,DOM.donut],loadData);
      renderTable([], { emptyText: 'Orders could not be loaded.', actionLabel: 'Try again', onReset: loadData });
      $('#table-summary').textContent = 'Data unavailable';
      $('#prev-page').disabled = true;
      $('#next-page').disabled = true;
    }
  } finally {
    if (currentId === dispatchId) {
      DOM.main.classList.remove('is-loading');
      DOM.main.setAttribute('aria-busy','false');
    }
  }
}

function setPlatform(name) {
  if (name === state.platform || (name !== 'all' && !state.streams.includes(name))) return;
  state.platform = name;
  state.page = 1;
  syncControls();
  renderDashboard();
}
function resetChannels() {
  state.platform = 'all';
  state.streams = [...PLATFORMS];
  state.page = 1;
  syncControls();
  renderDashboard();
}
function clearOrderFilters() {
  state.query = ''; state.status = 'all'; state.page = 1;
  DOM.search.value = ''; DOM.status.value = 'all';
}

function exportOrders() {
  const view = getView();
  if (!view || loading) return;
  const rows = getOrders(view);
  if (!rows.length) return;
  const blob = new Blob(['\uFEFF',ordersToCsv(rows)],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `trendify_orders_${PERIODS[state.loadedPeriod].filename}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  showToast(`${rows.length} matching order${rows.length === 1 ? '' : 's'} exported.`);
}

function openOrder(id) {
  const row = state.data?.table.find(order => order.id === id);
  if (!row) return;
  renderOrderDetail(row,$('#order-detail'));
  openDialog(DOM.detail);
}

// Native modal dialogs trap Tab focus and make the rest of the page inert.
// Only a pointer sequence that starts AND ends on the backdrop dismisses it.
for (const dialog of [DOM.channels,DOM.detail]) {
  let startedOnBackdrop = false;
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
  dialog.addEventListener('keydown',event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')]
      .filter(el => el.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  });
  dialog.addEventListener('pointerdown',event => {
    const r = dialog.getBoundingClientRect();
    startedOnBackdrop = event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom);
  });
  dialog.addEventListener('click',event => {
    const r = dialog.getBoundingClientRect();
    if (startedOnBackdrop && event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) closeDialog(dialog);
    startedOnBackdrop = false;
  });
}

document.addEventListener('click',event => {
  const close = event.target.closest('[data-close-dialog]');
  if (close) return closeDialog(close.closest('dialog'));
  const order = event.target.closest('[data-order]');
  if (order) return openOrder(order.dataset.order);
  const periodButton = event.target.closest('[data-period]');
  if (periodButton && state.period !== periodButton.dataset.period) {
    state.period = periodButton.dataset.period;
    syncControls(); loadData(); return;
  }
  const channelButton = event.target.closest('.channel-btn,.chip');
  if (channelButton && !channelButton.disabled) return setPlatform(channelButton.dataset.platform);
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'manage-channels') openDialog(DOM.channels);
  if (action === 'reset-filters') resetChannels();
});

document.querySelectorAll('.checkbox-list input').forEach(input => input.addEventListener('change',() => {
  state.streams = PLATFORMS.filter(name => name === input.value ? input.checked : state.streams.includes(name));
  if (!state.streams.includes(state.platform)) state.platform = 'all';
  state.page = 1;
  syncControls(); renderDashboard();
}));
DOM.search.addEventListener('input',() => { state.query = DOM.search.value; state.page = 1; renderOrders(); });
DOM.status.addEventListener('change',() => { state.status = DOM.status.value; state.page = 1; renderOrders(); });
$('#compare-period').addEventListener('change',event => { state.compare = event.target.checked; const view = getView(); if (view) renderTrend(view); });
$('#prev-page').addEventListener('click',() => { state.page--; renderOrders(); });
$('#next-page').addEventListener('click',() => { state.page++; renderOrders(); });
DOM.export.addEventListener('click',exportOrders);

// Keep navigation in sync with manual scrolling as well as anchor clicks.
const updateNav = () => {
  const atOrders = $('#orders').getBoundingClientRect().top < window.innerHeight * .45;
  document.querySelectorAll('.nav-link').forEach(link => {
    const active = (link.hash === '#orders') === atOrders;
    link.classList.toggle('is-active',active);
    if (active) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
};
window.addEventListener('scroll',updateNav,{passive:true});
new ResizeObserver(() => trendChart.resize()).observe(DOM.trend);
new ResizeObserver(syncSelectionTracks).observe($('.main-content'));
document.fonts.ready.then(syncSelectionTracks);
enterWorkspace();
syncControls();
loadData();
