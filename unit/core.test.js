/* Unit tests for the shared money core: no browser, the state is passed in. Run with `npm run test:unit`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as acc from '../js/core/accounts.js';
import * as adv from '../js/core/advances.js';
import * as led from '../js/core/ledger.js';
import * as money from '../js/core/money.js';

const mk = (over = {}) => ({
  rate: 90000,
  settings: { weekStart: 1, display: 'USD' },
  accounts: [{ id: 'wallet', name: 'Wallet' }],
  opening: { wallet: { USD: 0, LBP: 0 } },
  categories: [{ id: 'food', name: 'Food' }],
  tx: [],
  ...over,
});
const exp = (o) => ({ id: 'x' + Math.random(), type: 'expense', date: '2026-03-10', currency: 'USD', ...o });
const month = led.range('month', new Date(2026, 2, 15), 1);

test('LL typed in thousands, USD as typed', () => {
  assert.equal(money.parseInput('385', 'LBP'), 385000);
  assert.equal(money.parseInput('1.1', 'LBP'), 1100);
  assert.equal(money.parseInput('12abc', 'USD'), NaN);
  assert.equal(money.toInput(385000, 'LBP'), '385');
});

test('conversion uses the rate it is given', () => {
  assert.equal(money.toUSD(90000, 'LBP', 90000), 1);
  assert.equal(money.fromUSD(2, 'LBP', 90000), 180000);
  assert.equal(money.vUSD({ USD: 1, LBP: 45000 }, 90000), 1.5);
});

test('an entry keeps its own rate when the app rate changes', () => {
  const t = exp({ currency: 'LBP', amount: 89500, rate: 89500 });
  assert.equal(money.entryValueIn(t, 'USD', 90000), 1);
  assert.equal(money.entryValueIn(t, 'USD', 200000), 1);
  const noRate = exp({ currency: 'LBP', amount: 90000 });
  assert.equal(money.entryValueIn(noRate, 'USD', 90000), 1);
});

test('change given back reduces an expense', () => {
  const t = exp({ amount: 10, back: { USD: 2, LBP: 0 } });
  assert.equal(money.entryValueIn(t, 'USD', 90000), 8);
});

test('balances: expenses, income, transfers, exchanges and adjustments', () => {
  const s = mk({
    accounts: [
      { id: 'wallet', name: 'Wallet' },
      { id: 'bank', name: 'Bank' },
    ],
    opening: { wallet: { USD: 100, LBP: 0 }, bank: { USD: 0, LBP: 0 } },
    tx: [
      exp({ amount: 30 }),
      { id: 'i', type: 'income', date: '2026-03-11', currency: 'USD', amount: 10 },
      {
        id: 't',
        type: 'transfer',
        date: '2026-03-12',
        currency: 'USD',
        amount: 50,
        from: 'wallet',
        to: 'bank',
      },
      {
        id: 'e',
        type: 'transfer',
        date: '2026-03-12',
        currency: 'USD',
        amount: 20,
        from: 'wallet',
        to: 'wallet',
        toCurrency: 'LBP',
        toAmount: 1800000,
      },
      { id: 'a', type: 'adjust', date: '2026-03-13', currency: 'USD', amount: -5, account: 'bank' },
    ],
  });
  const b = led.balances(s);
  assert.deepEqual(b.wallet, { USD: 100 - 30 + 10 - 50 - 20, LBP: 1800000 });
  assert.deepEqual(b.bank, { USD: 45, LBP: 0 });
});

test("totals use each entry's own rate, so a new app rate moves nothing", () => {
  const s = mk({ tx: [exp({ currency: 'LBP', amount: 89500, rate: 89500, categoryId: 'food' })] });
  assert.equal(led.sumIn(s, month, 'expense', null, 'USD'), 1);
  s.rate = 1;
  assert.equal(led.sumIn(s, month, 'expense', null, 'USD'), 1);
  assert.equal(led.sumIn(s, month, 'expense', 'food', 'USD'), 1);
  assert.equal(led.sumIn(s, month, 'expense', 'other', 'USD'), 0);
});

test('sums can be limited to one account and one date range', () => {
  const s = mk({
    tx: [exp({ amount: 5, account: 'bank' }), exp({ amount: 7 }), exp({ amount: 9, date: '2026-04-02' })],
  });
  assert.equal(led.sumIn(s, month, 'expense', null, 'USD'), 12);
  assert.equal(led.sumIn(s, month, 'expense', null, 'USD', 'bank'), 5);
});

test('week range follows the week start', () => {
  const wed = new Date(2026, 2, 11);
  assert.equal(led.range('week', wed, 1).start.getDay(), 1);
  assert.equal(led.range('week', wed, 0).start.getDay(), 0);
});

test('budget status in the budget currency', () => {
  const s = mk({ tx: [exp({ amount: 85 }), exp({ amount: 10, date: '2000-01-01' })] });
  const b = { period: 'month', amount: 100, currency: 'USD' };
  const spent = led.sumIn(s, led.range('month', new Date(), 1), 'expense', null, 'USD');
  const st = led.budgetStatus(s, b);
  assert.equal(st.limit, 100);
  assert.equal(st.spent, spent);
  assert.equal(led.catName(s, 'nope'), 'Uncategorised');
  assert.equal(led.catName(s, 'food'), 'Food');
});

test('a budget can cover several categories, and reads the older single-category form', () => {
  const s = mk({
    categories: [
      { id: 'food', name: 'Food' },
      { id: 'coffee', name: 'Coffee' },
      { id: 'transport', name: 'Transport' },
    ],
    tx: [
      exp({ amount: 10, categoryId: 'food' }),
      exp({ amount: 3, categoryId: 'coffee' }),
      exp({ amount: 7, categoryId: 'transport' }),
    ],
  });
  assert.equal(led.sumIn(s, month, 'expense', ['food', 'coffee'], 'USD'), 13);
  assert.equal(led.sumIn(s, month, 'expense', 'transport', 'USD'), 7);
  assert.equal(led.sumIn(s, month, 'expense', [], 'USD'), 20, 'no categories means all spending');
  assert.equal(led.sumIn(s, month, 'expense', null, 'USD'), 20);

  assert.deepEqual(led.budgetCats({ categoryIds: ['food', 'coffee'] }), ['food', 'coffee']);
  assert.deepEqual(led.budgetCats({ categoryId: 'food' }), ['food'], 'older budgets still read');
  assert.deepEqual(led.budgetCats({ categoryId: null }), []);

  assert.equal(led.budgetName(s, { categoryIds: [] }), 'All spending');
  assert.equal(led.budgetName(s, { categoryId: 'food' }), 'Food');
  assert.equal(led.budgetName(s, { categoryIds: ['food', 'coffee'] }), 'Food and Coffee');
  assert.equal(
    led.budgetName(s, { categoryIds: ['food', 'coffee', 'transport'] }),
    'Food, Coffee and 1 more',
  );
});

test('spending split by category, biggest first, with unknown categories grouped', () => {
  const s = mk({
    categories: [
      { id: 'food', name: 'Food', type: 'expense' },
      { id: 'coffee', name: 'Coffee', type: 'expense' },
      { id: 'salary', name: 'Salary', type: 'income' },
    ],
    tx: [
      exp({ amount: 3, categoryId: 'coffee' }),
      exp({ amount: 10, categoryId: 'food' }),
      exp({ amount: 2, categoryId: 'gone' }),
      exp({ amount: 50, categoryId: 'food', date: '2000-01-01' }),
      { id: 'i', type: 'income', date: '2026-03-10', currency: 'USD', amount: 100, categoryId: 'salary' },
    ],
  });
  assert.deepEqual(led.spendByCategory(s, month, 'USD'), [
    { id: 'food', total: 10 },
    { id: 'coffee', total: 3 },
    { id: null, total: 2 },
  ]);
  assert.deepEqual(led.spendByCategory(mk(), month, 'USD'), []);
});

test('a closed advance kept as spending counts toward a budget that covers its category', () => {
  const s = mk({
    tx: [
      {
        id: 'a',
        type: 'advance',
        date: '2026-03-02',
        currency: 'USD',
        amount: 8,
        rate: 90000,
        closed: true,
        closedOn: '2026-03-05',
        keptCat: 'food',
      },
    ],
  });
  assert.equal(led.sumIn(s, month, 'expense', ['food', 'coffee'], 'USD'), 8);
  assert.equal(led.sumIn(s, month, 'expense', ['coffee'], 'USD'), 0);
});

test('advances: paybacks reduce what is owed and a part payback in LL uses its saved rate', () => {
  const a = { id: 'a1', type: 'advance', date: '2026-03-01', currency: 'USD', amount: 10, rate: 90000 };
  const r = {
    id: 'r1',
    type: 'repay',
    advanceId: 'a1',
    date: '2026-03-02',
    currency: 'LBP',
    amount: 450000,
    rate: 90000,
  };
  const s = mk({ tx: [a, r] });
  assert.equal(adv.owed(s, a).left, 5);
  s.rate = 1;
  assert.equal(adv.owed(s, a).left, 5);
  assert.equal(adv.advanceOf(s, r), a);
});

test('accounts: add, rename, remove keeps history and moves money to the main account', () => {
  const s = mk({ tx: [exp({ amount: 1 })] });
  const id = acc.addAccount(s, '  Bank  ');
  assert.ok(id);
  assert.equal(acc.accName(s, id), 'Bank');
  assert.equal(acc.addAccount(s, '   '), null);
  assert.equal(acc.renameAccount(s, id, ''), false);
  s.tx.push({ id: 'in', type: 'income', date: '2026-03-02', currency: 'USD', amount: 40, account: id });
  assert.equal(acc.removeAccount(s, id), true);
  assert.equal(
    acc.accounts(s).some((x) => x.id === id),
    false,
  );
  assert.equal(s.accounts.find((x) => x.id === id).hidden, true);
  assert.equal(led.balances(s).wallet.USD, 39);
  assert.equal(acc.restoreAccount(s, id), true);
  assert.equal(acc.removeAccount(s, acc.MAIN), false);
});

test('an account that was never used is deleted outright', () => {
  const s = mk();
  const id = acc.addAccount(s, 'Temp');
  acc.removeAccount(s, id);
  assert.equal(
    s.accounts.some((x) => x.id === id),
    false,
  );
  assert.equal(id in s.opening, false);
});

test('the number of accounts is capped', () => {
  const s = mk();
  while (acc.addAccount(s, 'A')) {
    /* fill up */
  }
  assert.equal(acc.accounts(s).length, acc.MAX_ACCOUNTS);
});
