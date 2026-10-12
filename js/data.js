export const PLATFORMS = ['Amazon', 'eBay', 'AliExpress'];

export const PERIODS = {
  day: { label: 'Day', range: 'Jun 30, 2026', comparison: 'previous day', filename: '2026-06-30', resolution: 'Revenue every two hours in USD' },
  week: { label: 'Week', range: 'Jun 24 – 30, 2026', comparison: 'previous week', filename: '2026-06-24_2026-06-30', resolution: 'Daily revenue in USD' },
  month: { label: 'Month', range: 'Jun 1 – 30, 2026', comparison: 'previous 30 days', filename: '2026-06', resolution: 'Daily revenue in USD' }
};

// Allocate in integer units, then distribute the remainder. Revenue series
// reconcile to the cent; order counts stay whole and reconcile exactly.
export function distribute(weights, total, precision = 100) {
  const units = Math.round(total * precision);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => units * w / sum);
  const result = raw.map(Math.floor);
  const ranked = raw.map((n, i) => ({ i, fraction: n - result[i] })).sort((a, b) => b.fraction - a.fraction);
  let remainder = units - result.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) result[ranked[i].i]++;
  return result.map(n => n / precision);
}
const money = n => Math.round(n * 100) / 100;
const sum = values => values.reduce((a, b) => a + b, 0);
const weights = [6, 7, 6.4, 8.5, 8, 6.5, 7.3, 9.2, 8.7, 10, 7.9, 8.8, 9.5, 8.6, 11.4, 10, 9.2, 10.5, 11, 9.7, 10.8, 12.2, 11.4, 10.3, 13.6, 12.1, 11.4, 13, 12.6, 14.2];
const previousWeights = [6.5, 7, 6, 7.5, 8, 7, 6.3, 8, 9, 8, 8.5, 7.5, 8.8, 9, 8, 9.2, 8.5, 10, 9.3, 8.8, 10.5, 9.7, 10, 9, 10.5, 11, 10, 11.5, 10.4, 11.9];
const specs = {
  Amazon: { revenue: 52416, orders: 360, margin: 32.1, previousRevenue: 44877, previousOrders: 324, previousMargin: 30.5 },
  eBay: { revenue: 47424, orders: 290, margin: 35.4, previousRevenue: 41490, previousOrders: 264, previousMargin: 34.3 },
  AliExpress: { revenue: 24960, orders: 192, margin: 32.6, previousRevenue: 22962, previousOrders: 181, previousMargin: 31.9 }
};
const daily = Object.fromEntries(PLATFORMS.map((name, index) => {
  const spec = specs[name];
  const platformWeights = weights.map((w, i) => w * (1 + Math.sin(i * .9 + index * 2) * .18));
  return [name, {
    revenue: distribute(platformWeights, spec.revenue),
    orders: distribute(platformWeights, spec.orders, 1),
    previous: distribute(previousWeights.map((w, i) => w * (1 + Math.sin(i + index) * .1)), spec.previousRevenue),
    margin: weights.map((_, i) => spec.margin - .6 + i * .04)
  }];
}));

const catalog = [
  { product: 'Arc Wireless Headphones', variant: 'Graphite', category: 'headphones', unitPrice: 199 },
  { product: 'Forma Mechanical Keyboard', variant: 'Warm white / Tactile', category: 'keyboard', unitPrice: 129 },
  { product: 'Beam Desk Lamp', variant: 'Sage', category: 'lamp', unitPrice: 89 },
  { product: 'Pebble Wireless Mouse', variant: 'Lavender', category: 'mouse', unitPrice: 59 },
  { product: 'Frame 27” Monitor', variant: 'Space grey / 4K', category: 'monitor', unitPrice: 329 },
  { product: 'Loop Desktop Speaker', variant: 'Terracotta', category: 'speaker', unitPrice: 149 },
  { product: 'Lift Laptop Stand', variant: 'Silver', category: 'monitor', unitPrice: 79 },
  { product: 'Studio Desk Mat', variant: 'Sand / Large', category: 'keyboard', unitPrice: 39 }
];
const sampleOrders = Array.from({ length: 30 }, (_, i) => {
  const item = catalog[i % catalog.length];
  const day = 30 - Math.floor(i / 6);
  const hour = 16 - (i % 6) * 2;
  const quantity = i % 7 === 5 ? 2 : 1;
  return {
    ...item, id: `#ST-${1086 - i}`, date: `2026-06-${day}T${String(hour).padStart(2,'0')}:24:00Z`,
    platform: PLATFORMS[[0,1,0,2,1,0,2,1,0,2,0,1][i % 12]],
    quantity, amount: item.unitPrice * quantity,
    status: ['In transit','Delivered','Delivered','In transit','Delivered','Cancelled','Delivered','Delivered','In transit','Delivered','Cancelled','Delivered'][i % 12]
  };
});

function platformForPeriod(name, period) {
  const d = daily[name];
  const spec = specs[name];
  let trend, previousTrend, orders, previousOrders, margin, previousMargin;
  if (period === 'month') {
    trend = d.revenue; previousTrend = d.previous;
    orders = spec.orders; previousOrders = spec.previousOrders;
    margin = sum(d.margin.map((m,i) => m * trend[i])) / sum(trend); previousMargin = spec.previousMargin;
  } else if (period === 'week') {
    trend = d.revenue.slice(23); previousTrend = d.revenue.slice(16,23);
    orders = sum(d.orders.slice(23)); previousOrders = sum(d.orders.slice(16,23));
    margin = sum(d.margin.slice(23).map((m,i) => m * trend[i])) / sum(trend);
    previousMargin = sum(d.margin.slice(16,23).map((m,i) => m * previousTrend[i])) / sum(previousTrend);
  } else {
    const intraday = [2,1,1,3,6,9,11,12,10,9,7,4];
    trend = distribute(intraday, d.revenue[29]);
    previousTrend = distribute([1,1,2,3,5,8,9,10,9,10,6,5], d.revenue[28]);
    orders = d.orders[29]; previousOrders = d.orders[28];
    margin = d.margin[29]; previousMargin = d.margin[28];
  }
  const revenue = money(sum(trend));
  const previousRevenue = money(sum(previousTrend));
  return { revenue, orders, margin, previousRevenue, previousOrders, previousMargin, trend, previousTrend };
}

export const mockData = Object.fromEntries(Object.keys(PERIODS).map(period => [period, {
  trendLabels: period === 'month' ? weights.map((_,i) => `Jun ${i+1}`)
    : period === 'week' ? ['Jun 24','Jun 25','Jun 26','Jun 27','Jun 28','Jun 29','Jun 30']
    : ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'],
  platforms: Object.fromEntries(PLATFORMS.map(name => [name, platformForPeriod(name,period)])),
  // This intentionally shows a recent sample, not the complete sales ledger.
  table: sampleOrders.filter(row => period !== 'day' || row.date.startsWith('2026-06-30')).slice(0,12)
}]));

/** Simulated local API boundary; consumers still handle loading and failure. */
export function fetchDashboardData(period) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!mockData[period]) reject(new Error('Unknown reporting period'));
      else resolve(mockData[period]);
    }, 280);
  });
}
