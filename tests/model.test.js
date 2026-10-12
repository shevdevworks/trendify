import test from 'node:test';
import assert from 'node:assert/strict';
import { mockData, PLATFORMS, distribute, fetchDashboardData } from '../js/data.js';
import { deriveView, filterOrders, roundShares, ordersToCsv } from '../js/model.js';

const cents = n => Math.round(n * 100);

test('every current and comparison series reconciles to its revenue', () => {
  for (const data of Object.values(mockData)) {
    for (const platform of Object.values(data.platforms)) {
      assert.equal(platform.trend.length, data.trendLabels.length);
      assert.equal(platform.previousTrend.length, data.trendLabels.length);
      assert.equal(platform.trend.reduce((sum,v) => sum+cents(v),0), cents(platform.revenue));
      assert.equal(platform.previousTrend.reduce((sum,v) => sum+cents(v),0), cents(platform.previousRevenue));
      assert.ok(platform.trend.every(v => Number.isFinite(v) && v >= 0));
    }
  }
});

test('day and week revenue are slices of the same month', () => {
  for (const name of PLATFORMS) {
    const month = mockData.month.platforms[name];
    assert.equal(cents(mockData.day.platforms[name].revenue),cents(month.trend.at(-1)));
    assert.equal(cents(mockData.week.platforms[name].revenue),month.trend.slice(-7).reduce((sum,v) => sum+cents(v),0));
  }
});

test('all channel selections derive their totals and averages consistently', () => {
  for (const data of Object.values(mockData)) {
    for (let mask=0; mask<8; mask++) {
      const streams=PLATFORMS.filter((_,i) => mask & (1 << i));
      for (const platform of ['all',...PLATFORMS]) {
        const view=deriveView(data,{streams,platform});
        const included=streams.filter(name => platform === 'all' || name === platform);
        assert.deepEqual(view.included,included);
        assert.equal(cents(view.revenue),included.reduce((sum,name) => sum+cents(data.platforms[name].revenue),0));
        assert.equal(cents(view.trend.reduce((a,b) => a+b,0)),cents(view.revenue));
        assert.equal(view.average,view.orders ? view.revenue/view.orders : 0);
        assert.ok(Number.isFinite(view.margin));
        assert.ok(view.transactions.every(row => included.includes(row.platform)));
      }
    }
  }
});

test('empty selection has no misleading growth values', () => {
  const view=deriveView(mockData.month,{streams:[]});
  assert.equal(view.revenue,0);
  assert.equal(view.orders,0);
  assert.equal(view.isEmpty,true);
  assert.deepEqual(Object.values(view.changes),[null,null,null,null]);
});

test('margin change is a difference in percentage points', () => {
  const p=mockData.month.platforms.Amazon;
  const view=deriveView(mockData.month,{platform:'Amazon'});
  assert.ok(Math.abs(view.changes.margin-(p.margin-p.previousMargin)) < 1e-10);
});

test('shares reconcile to 100, including small totals and excluded channels', () => {
  assert.deepEqual(roundShares([1,1,1]),[34,33,33]);
  assert.deepEqual(roundShares([0,0,0]),[0,0,0]);
  assert.deepEqual(roundShares([17,0,0]),[100,0,0]);
  assert.equal(roundShares([52416,47424,24960]).reduce((a,b) => a+b,0),100);
});

test('integer allocation does not lose cents or fractional orders', () => {
  assert.deepEqual(distribute([1,1,1],.01),[.01,0,0]);
  assert.deepEqual(distribute([1,1,1],2,1),[1,1,0]);
});

test('search and status intersect with the active channels', () => {
  const view=deriveView(mockData.month,{platform:'Amazon'});
  assert.equal(filterOrders(view.transactions,'  ARC ','In transit').length,2);
  assert.equal(filterOrders(view.transactions,'#ST-1086','Delivered').length,0);
  assert.equal(filterOrders(view.transactions,'nothing here').length,0);
  assert.equal(filterOrders(view.transactions,'#st-1086')[0].id,'#ST-1086');
});

test('CSV exports exactly the matching rows with numeric amounts', () => {
  const rows=filterOrders(deriveView(mockData.month,{platform:'Amazon'}).transactions,'','Delivered');
  const csv=ordersToCsv(rows);
  assert.equal(csv.split('\r\n').length,rows.length+1);
  assert.ok(csv.includes('Amount (USD)'));
  assert.ok(csv.includes(',89.00,Delivered'));
  assert.ok(rows.every(row => csv.includes(row.id)));
  assert.ok(!csv.includes('Cancelled'));
});

test('CSV escapes delimiters, quotes, newlines, and spreadsheet formulas', () => {
  const base=mockData.month.table[0];
  assert.ok(ordersToCsv([{...base,product:'Desk, "large"\nwhite'}]).includes('"Desk, ""large""\nwhite"'));
  assert.ok(ordersToCsv([{...base,product:'=1+1'}]).includes("'=1+1"));
});

test('invalid reporting periods reject instead of silently returning another period', async () => {
  await assert.rejects(fetchDashboardData('year'),/Unknown reporting period/);
});
