/* Example data shown on first launch. */
import { blankState } from './state.js';
import { addDays, startOfDay, ymd } from './util.js';

export function sampleState() {
  const s = blankState();
  s.sample = true;
  s.opening = {
    wallet: { USD: 240, LBP: 2500000 },
    savings: { USD: 900, LBP: 0 },
    whish: { USD: 35, LBP: 0 },
  };
  const now = new Date();
  let seq = 0;
  const add = (ago, o) => {
    const d = addDays(startOfDay(now), -ago);
    seq++;
    /* Spread entries through the day, but never later than now, so anything the user adds sorts above them. */
    const at = Math.min(d.getTime() + (8 * 60 + seq * 7) * 60000, now.getTime() - (200 - seq) * 60000);
    s.tx.push(Object.assign({ id: 's' + seq, date: ymd(d), createdAt: at, account: 'wallet', note: '' }, o));
  };
  [0, 1, 2, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16, 18, 19, 21, 22, 25, 26, 28].forEach((a) =>
    add(a, { type: 'expense', amount: 2, currency: 'USD', categoryId: 'coffee', note: 'Espresso' }),
  );
  [1, 3, 6, 8, 10, 13, 15, 17, 20, 22, 24, 27, 29].forEach((a) =>
    add(a, { type: 'expense', amount: 150000, currency: 'LBP', categoryId: 'food', note: 'Manoushe' }),
  );
  [0, 2, 5, 7, 9, 12, 14, 16, 19, 21, 23, 26, 28].forEach((a) =>
    add(a, {
      type: 'expense',
      amount: 300000,
      currency: 'LBP',
      categoryId: 'transport',
      note: 'Service to campus',
    }),
  );
  [3, 10, 17, 24, 31].forEach((a) =>
    add(a, { type: 'expense', amount: 25, currency: 'USD', categoryId: 'transport', note: 'Fuel' }),
  );
  [6, 13, 27].forEach((a) =>
    add(a, {
      type: 'expense',
      amount: 35,
      currency: 'USD',
      categoryId: 'groceries',
      note: 'Weekly groceries',
    }),
  );
  [4, 11, 25].forEach((a) =>
    add(a, {
      type: 'expense',
      amount: 18,
      currency: 'USD',
      categoryId: 'outing',
      note: 'Dinner with friends',
    }),
  );
  add(20, {
    type: 'expense',
    amount: 48,
    currency: 'USD',
    categoryId: 'bills',
    note: 'Generator subscription',
  });
  add(18, { type: 'expense', amount: 15, currency: 'USD', categoryId: 'phone', note: 'Alfa recharge' });
  add(12, { type: 'expense', amount: 900000, currency: 'LBP', categoryId: 'uni', note: 'Printing' });
  add(20, { type: 'income', amount: 650, currency: 'USD', categoryId: 'salary', note: 'Monthly pay' });
  add(16, { type: 'advance', amount: 100, currency: 'USD', who: 'Scouts', note: 'Camp supplies' });
  const camp = 's' + seq;
  add(6, { type: 'repay', amount: 60, currency: 'USD', advanceId: camp, note: '' });
  add(19, {
    type: 'transfer',
    amount: 150,
    currency: 'USD',
    from: 'wallet',
    to: 'savings',
    toAmount: 150,
    toCurrency: 'USD',
    note: '',
  });
  add(9, {
    type: 'transfer',
    amount: 30,
    currency: 'USD',
    from: 'wallet',
    to: 'whish',
    toAmount: 30,
    toCurrency: 'USD',
    note: '',
  });
  add(8, {
    type: 'transfer',
    amount: 50,
    currency: 'USD',
    from: 'wallet',
    to: 'wallet',
    toAmount: 4475000,
    toCurrency: 'LBP',
    note: 'Changed at the shop',
  });
  s.budgets = [
    { id: 'b1', categoryId: null, period: 'month', amount: 600, currency: 'USD' },
    { id: 'b2', categoryId: 'transport', period: 'month', amount: 120, currency: 'USD' },
    { id: 'b3', categoryId: 'food', period: 'month', amount: 2000000, currency: 'LBP' },
    { id: 'b4', categoryId: 'coffee', period: 'week', amount: 12, currency: 'USD' },
    { id: 'b5', categoryId: 'outing', period: 'month', amount: 40, currency: 'USD' },
  ];
  return s;
}
