import { PLATFORMS } from './data.js';

const sumBy = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0);
const roundMoney = n => Math.round(n * 100) / 100;
const change = (value, previous) => previous ? (value / previous - 1) * 100 : null;

export function deriveView(data, { platform = 'all', streams = PLATFORMS } = {}) {
  const included = PLATFORMS.filter(name => streams.includes(name) && (platform === 'all' || platform === name));
  const rows = included.map(name => data.platforms[name]);
  const revenue = roundMoney(sumBy(rows, 'revenue'));
  const previousRevenue = roundMoney(sumBy(rows, 'previousRevenue'));
  const orders = sumBy(rows, 'orders');
  const previousOrders = sumBy(rows, 'previousOrders');
  const average = orders ? revenue / orders : 0;
  const previousAverage = previousOrders ? previousRevenue / previousOrders : 0;
  const margin = revenue ? rows.reduce((sum,r) => sum + r.margin * r.revenue, 0) / revenue : 0;
  const previousMargin = previousRevenue ? rows.reduce((sum,r) => sum + r.previousMargin * r.previousRevenue, 0) / previousRevenue : 0;
  const series = key => data.trendLabels.map((_,i) => roundMoney(rows.reduce((sum,r) => sum + r[key][i], 0)));
  return {
    included, isEmpty: included.length === 0, isFiltered: included.length !== PLATFORMS.length,
    revenue, orders, average, margin,
    changes: { revenue: change(revenue,previousRevenue), orders: change(orders,previousOrders), average: change(average,previousAverage), margin: previousRevenue ? margin - previousMargin : null },
    trend: series('trend'), previousTrend: series('previousTrend'),
    transactions: data.table.filter(row => included.includes(row.platform))
  };
}

export function filterOrders(rows, query = '', status = 'all') {
  const needle = query.trim().toLowerCase();
  return rows.filter(row => (status === 'all' || row.status === status)
    && (!needle || `${row.id} ${row.product} ${row.platform}`.toLowerCase().includes(needle)));
}

export function roundShares(values) {
  const total = values.reduce((a,b) => a+b, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map(v => v / total * 100);
  const shares = raw.map(Math.floor);
  const ranked = raw.map((v,i) => ({ i, fraction: v - shares[i] })).sort((a,b) => b.fraction - a.fraction);
  const remainder = 100 - shares.reduce((a,b) => a+b, 0);
  for (let i = 0; i < remainder; i++) shares[ranked[i].i]++;
  return shares;
}

// Numeric amounts and ISO dates remain useful when imported into a spreadsheet.
// Neutralize leading formula characters if this demo is later given API data.
export function ordersToCsv(rows) {
  const escape = value => {
    let text = String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    ['Order ID', 'Date (UTC)', 'Product', 'Channel', 'Quantity', 'Amount (USD)', 'Status'],
    ...rows.map(row => [row.id,row.date,row.product,row.platform,row.quantity,row.amount.toFixed(2),row.status])
  ].map(row => row.map(escape).join(',')).join('\r\n');
}
