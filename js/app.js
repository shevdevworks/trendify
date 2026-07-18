/**
 * TRENDIFY CORE ENGINE v2.5
 * State-driven telemetry controller with async race-condition mitigation
 * and dynamic client-side data derivation.
 */

import { fetchDashboardData } from './data.js';
import { renderTrendChart, renderPlatformChart } from './charts.js';
import { showToast, renderSkeletons, renderKPI, renderTable, renderErrorState, filterTransactions } from './ui.js';

const state = {
  currentPeriod: 'month',
  currentPlatform: 'all',
  activeStreams: ['Amazon', 'eBay', 'AliExpress'],
  cachedTelemetry: null
};

const DOM = {
  sidebar: null,
  mobileBtn: null,
  closeBtn: null,
  trendContainer: null,
  platformContainer: null
};

let activeNetworkDispatchId = 0;
let resizeDebounceTimer = null;

/**
 * CORE LOGIC: Derived State Selector
 * Recomputes metrics and chart data from the active filters, using the
 * marketplace shares (platformDistribution) as a scaling factor.
 */
function getFilteredTelemetry() {
  const raw = state.cachedTelemetry;
  if (!raw) return null;

  const platforms = ['amazon', 'ebay', 'aliexpress'];
  let ratio = 0;
  let newDist = [0, 0, 0];

  // 1. Work out the overall share of active data
  if (state.currentPlatform !== 'all') {
    const pIdx = platforms.indexOf(state.currentPlatform.toLowerCase());
    const isStreamActive = state.activeStreams.some(s => s.toLowerCase() === state.currentPlatform.toLowerCase());

    if (isStreamActive && pIdx !== -1) {
      ratio = raw.charts.platformDistribution[pIdx] / 100;
      newDist[pIdx] = 100; // the distribution ring is fully filled by the single selected platform
    }
  } else {
    platforms.forEach((p, idx) => {
      if (state.activeStreams.some(s => s.toLowerCase() === p.toLowerCase())) {
        const pRatio = raw.charts.platformDistribution[idx] / 100;
        ratio += pRatio;
        newDist[idx] = raw.charts.platformDistribution[idx];
      }
    });

    // Re-normalize the distribution chart if some streams are toggled off
    if (ratio > 0 && ratio < 1) {
      newDist = newDist.map(val => Math.round((val / (ratio * 100)) * 100));
    }
  }

  // Zero-state fallback when every stream is disabled
  if (ratio === 0) {
    return {
      ...raw,
      revenue: { ...raw.revenue, value: '$0' },
      orders: { ...raw.orders, value: '0' },
      averageCheck: { ...raw.averageCheck, value: '$0' },
      margin: { ...raw.margin, value: '0%' },
      charts: { ...raw.charts, trend: raw.charts.trend.map(() => 0), platformDistribution: [0, 0, 0] }
    };
  }

  // 2. String parser (turns "$12.4M" into 12.4)
  const parseNum = (str) => parseFloat(str.replace(/[^0-9.]/g, ''));

  // Recalculate Revenue
  const revBase = parseNum(raw.revenue.value);
  const isMil = raw.revenue.value.includes('M');
  const isK = raw.revenue.value.includes('K');
  const newRev = (revBase * ratio).toFixed(isMil ? 1 : 0);
  const revStr = `$${newRev}${isMil ? 'M' : isK ? 'K' : ''}`;

  // Recalculate Orders
  const ordBase = parseNum(raw.orders.value);
  const newOrd = Math.round(ordBase * ratio).toLocaleString('en-US');

  // Scale the trend chart (visual shape is preserved, tooltip values change)
  const newTrend = raw.charts.trend.map(val => Number((val * ratio).toFixed(2)));

  // averageCheck and margin are left untouched: revenue/orders share the same
  // ratio so the average is unchanged, and the mock data has no per-platform
  // margin to derive a real delta from.
  return {
    ...raw,
    revenue: { ...raw.revenue, value: revStr },
    orders: { ...raw.orders, value: newOrd },
    charts: {
      ...raw.charts,
      trend: newTrend,
      platformDistribution: newDist
    }
  };
}

/**
 * MASTER RENDERER: Single point of truth for refreshing the UI.
 * Called on every state change (filters, platform, network sync).
 */
function renderDashboard() {
  const data = getFilteredTelemetry();
  if (!data) return;

  window.requestAnimationFrame(() => {
    renderKPI(data);
    renderTrendChart(DOM.trendContainer, data.charts.trend, data.charts.trendLabels, state.currentPeriod);
    renderPlatformChart(DOM.platformContainer, data.charts.platformDistribution);
    // The table filters itself against the global state inside ui.js, so we pass the raw rows
    renderTable(data.table, state);
  });
}

async function synchronizeTelemetry() {
  const dispatchId = ++activeNetworkDispatchId;
  renderSkeletons(DOM.trendContainer, DOM.platformContainer);

  try {
    const data = await fetchDashboardData(state.currentPeriod);
    if (dispatchId !== activeNetworkDispatchId) return;

    state.cachedTelemetry = data;
    renderDashboard();
  } catch (err) {
    if (dispatchId === activeNetworkDispatchId) {
      showToast("Telemetry Sync Error: Remote node unreachable.", "error");
      if (state.cachedTelemetry) {
        // Roll back to the last successful snapshot instead of leaving skeletons frozen
        renderDashboard();
      } else {
        // No prior data to fall back to — show a recoverable error state with a retry action
        renderErrorState(DOM.trendContainer, DOM.platformContainer, synchronizeTelemetry);
      }
    }
  }
}

/**
 * Exports the rows currently visible in the Live Ledger table (after platform
 * and stream filters are applied) as a downloadable CSV file.
 */
function exportCurrentView() {
  const data = getFilteredTelemetry();
  if (!data) {
    showToast('Export Failed: No telemetry data loaded yet.', 'error');
    return;
  }

  const rows = filterTransactions(data.table, state);
  if (rows.length === 0) {
    showToast('Export Failed: No transactions match the current filter.', 'error');
    return;
  }

  const escapeCsv = (val) => {
    const str = String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const headerRow = ['ID', 'Timestamp', 'Product', 'Platform', 'Amount', 'Status'];
  const csvRows = rows.map(r => [r.id, r.date, r.product, r.platform, r.price, r.status].map(escapeCsv).join(','));
  const csvContent = [headerRow.join(','), ...csvRows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trendify_${state.currentPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast(`Export Complete: ${rows.length} record${rows.length === 1 ? '' : 's'} downloaded.`);
}

function initializeExport() {
  document.getElementById('export-btn')?.addEventListener('click', exportCurrentView);
}

function initializeNavigationDrawers() {
  DOM.sidebar = document.querySelector('.filters-panel');
  DOM.mobileBtn = document.getElementById('mobile-filters-btn');
  DOM.closeBtn = document.getElementById('close-filters-btn');

  const backdrop = document.createElement('div');
  backdrop.className = 'filters-overlay';
  document.body.appendChild(backdrop);

  const toggleDrawer = (isOpen) => {
    DOM.sidebar?.classList.toggle('filters-panel--open', isOpen);
    backdrop.classList.toggle('filters-overlay--visible', isOpen);
  };

  DOM.mobileBtn?.addEventListener('click', () => toggleDrawer(true));
  DOM.closeBtn?.addEventListener('click', () => toggleDrawer(false));
  backdrop.addEventListener('click', () => toggleDrawer(false));

  const timeframeController = document.getElementById('timeframe-selector');
  timeframeController?.addEventListener('click', (e) => {
    const trigger = e.target.closest('.period-btn');
    if (!trigger || trigger.dataset.period === state.currentPeriod) return;

    timeframeController.querySelectorAll('.period-btn').forEach(b => b.classList.remove('period-btn--active'));
    trigger.classList.add('period-btn--active');

    state.currentPeriod = trigger.dataset.period;
    synchronizeTelemetry(); // requires a network round-trip
    if (window.innerWidth <= 768) toggleDrawer(false);
  });

  const platformController = document.getElementById('platform-selector');
  platformController?.addEventListener('click', (e) => {
    const trigger = e.target.closest('.period-btn');
    if (!trigger || trigger.dataset.platform === state.currentPlatform) return;

    platformController.querySelectorAll('.period-btn').forEach(b => b.classList.remove('period-btn--active'));
    trigger.classList.add('period-btn--active');

    state.currentPlatform = trigger.dataset.platform;
    renderDashboard(); // no network call needed, recompute locally
    if (window.innerWidth <= 768) toggleDrawer(false);
  });

  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(box => {
    box.addEventListener('change', (e) => {
      const targetPlatform = e.target.value;

      if (e.target.checked) {
        if (!state.activeStreams.includes(targetPlatform)) state.activeStreams.push(targetPlatform);
        showToast(`Stream Restored: [${targetPlatform}] node operational.`);
      } else {
        state.activeStreams = state.activeStreams.filter(item => item !== targetPlatform);
        showToast(`Connection Severed: [${targetPlatform}] data stream offline.`, 'error');
      }

      if (state.activeStreams.length === 0) {
        showToast('CRITICAL WARNING: Zero active telemetry streams.', 'error');
      }

      renderDashboard(); // recompute locally
    });
  });
}

function bootstrap() {
  DOM.trendContainer = document.getElementById('trend-chart-container');
  DOM.platformContainer = document.getElementById('platform-chart-container');

  initializeNavigationDrawers();
  initializeExport();
  synchronizeTelemetry();

  window.addEventListener('resize', () => {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(() => {
      const data = getFilteredTelemetry();
      if (data) {
        renderTrendChart(
          DOM.trendContainer,
          data.charts.trend,
          data.charts.trendLabels,
          state.currentPeriod
        );
      }
    }, 160);
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', bootstrap);