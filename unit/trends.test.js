/* Unit tests for spending trends: no browser, the state and "today" are passed in. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareMonth, monthlyTrend } from '../js/core/trends.js';

const mk = (tx) => ({
  rate: 90000,
  settings: { weekStart: 1, display: 'USD' },
  accounts: [
    { id: 'wallet', name: 'Wallet' },
    { id: 'bank', name: 'Bank' },
  ],
  opening: { wallet: { USD: 0, LBP: 0 }, bank: { USD: 0, LBP: 0 } },
  categories: [
    { id: 'food', name: 'Food', type: 'expense' },
    { id: 'fuel', name: 'Fuel', type: 'expense' },
    { id: 'salary', name: 'Salary', type: 'income' },
  ],
  tx,
});
let n = 0;
const exp = (date, amount, categoryId = 'food', over = {}) => ({
  id: 'e' + n++,
  type: 'expense',
  date,
  currency: 'USD',
  amount,
  categoryId,
  ...over,
});
const inc = (date, amount) => ({
  id: 'i' + n++,
  type: 'income',
  date,
  currency: 'USD',
  amount,
  categoryId: 'salary',
});
const today = new Date(2026, 10, 12); // 12 November 2026
const nov = new Date(2026, 10, 1);

test('months are listed oldest first, ending with the month shown', () => {
  const s = mk([exp('2026-09-05', 10), exp('2026-10-20', 20), exp('2026-11-02', 5), inc('2026-10-01', 100)]);
  const { months } = monthlyTrend(s, nov, 3, 'USD', today);
  assert.deepEqual(
    months.map((m) => [m.start.getMonth(), m.spent, m.earned]),
    [
      [8, 10, 0],
      [9, 20, 100],
      [10, 5, 0],
    ],
  );
});

test('the average leaves out the month still going on and months before the first entry', () => {
  const s = mk([exp('2026-09-05', 10), exp('2026-10-20', 30), exp('2026-11-02', 5)]);
  const { months, average } = monthlyTrend(s, nov, 6, 'USD', today);
  assert.deepEqual(
    months.map((m) => [m.empty, m.partial]),
    [
      [true, false],
      [true, false],
      [true, false],
      [false, false],
      [false, false],
      [false, true],
    ],
  );
  assert.equal(average, 20, 'September and October only');
  assert.equal(monthlyTrend(mk([]), nov, 3, 'USD', today).average, null);
});

test('later months, and a month seen from the past, are handled', () => {
  const s = mk([exp('2026-01-10', 40), exp('2026-02-10', 60), exp('2026-11-02', 5)]);
  // Looking at February: November is in the future of that view only when it is past `today`, so look ahead.
  const ahead = monthlyTrend(s, new Date(2026, 11, 1), 2, 'USD', today);
  assert.deepEqual(
    ahead.months.map((m) => [m.start.getMonth(), m.partial, m.empty]),
    [
      [10, true, false],
      [11, false, true],
    ],
  );
  const past = monthlyTrend(s, new Date(2026, 1, 1), 2, 'USD', today);
  assert.equal(past.average, 50);
});

test('one category, one account, and each entry at its own rate', () => {
  const s = mk([
    exp('2026-10-03', 10, 'food'),
    exp('2026-10-04', 7, 'fuel'),
    exp('2026-10-05', 3, 'food', { account: 'bank' }),
    exp('2026-10-06', 1, 'food', { currency: 'LBP', amount: 89500, rate: 89500 }),
  ]);
  const oct = new Date(2026, 9, 1);
  const get = (opts) => monthlyTrend(s, oct, 1, 'USD', today, opts).months[0];
  assert.equal(get({}).spent, 21);
  assert.equal(get({ catId: 'food' }).spent, 14);
  assert.equal(get({ catId: 'food' }).earned, null, 'income says nothing about a spending category');
  assert.equal(get({ account: 'bank' }).spent, 3);
  // A new app rate moves nothing.
  s.rate = 1;
  assert.equal(get({}).spent, 21);
});

test('the month going on is set against the same days of last month', () => {
  const s = mk([
    exp('2026-10-03', 10, 'food'),
    exp('2026-10-12', 5, 'fuel'),
    exp('2026-10-20', 100, 'food'), // after the 12th: not part of "by now"
    exp('2026-11-02', 30, 'food'),
    exp('2026-11-10', 5, 'fuel'),
  ]);
  const c = compareMonth(s, nov, today, 'USD');
  assert.equal(c.partial, true);
  assert.equal(c.day, 12);
  assert.equal(c.now, 35);
  assert.equal(c.before, 15);
  assert.deepEqual(
    c.changes,
    [
      { id: 'food', now: 30, before: 10 },
      { id: 'fuel', now: 5, before: 5 },
    ].filter((x) => x.now !== x.before),
  );
});

test('a finished month is set against the whole month before', () => {
  const s = mk([exp('2026-09-03', 10), exp('2026-10-03', 40, 'fuel'), exp('2026-10-30', 10)]);
  const c = compareMonth(s, new Date(2026, 9, 1), today, 'USD');
  assert.deepEqual([c.partial, c.now, c.before], [false, 50, 10]);
  assert.deepEqual(
    c.changes,
    [
      { id: 'fuel', now: 40, before: 0 },
      { id: 'food', now: 10, before: 10 },
    ].filter((x) => x.now !== x.before),
  );
});

test('the same days of last month never run into this month when last month was shorter', () => {
  // 31 March: last month, February, has 28 days, so "the same days" is all of February.
  const s = mk([exp('2026-02-28', 7), exp('2026-03-01', 99), exp('2026-03-31', 2)]);
  const c = compareMonth(s, new Date(2026, 2, 1), new Date(2026, 2, 31), 'USD');
  assert.equal(c.before, 7);
  assert.equal(c.now, 101);
});

test('one category has no changes list, and an account is respected', () => {
  const s = mk([exp('2026-11-02', 30, 'food', { account: 'bank' }), exp('2026-11-03', 9, 'fuel')]);
  const one = compareMonth(s, nov, today, 'USD', { catId: 'food' });
  assert.deepEqual([one.now, one.changes], [30, []]);
  assert.equal(compareMonth(s, nov, today, 'USD', { account: 'bank' }).now, 30);
});
