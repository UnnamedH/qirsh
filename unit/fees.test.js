/* Unit tests for members' fees (js/core/fees.js). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feeStatus, memberFeeStatus, memberFees, outstandingUSD, paymentsOf } from '../js/core/fees.js';

const dues = {
  id: 'dues',
  name: 'Dues 2026',
  amount: 50,
  currency: 'USD',
  memberIds: ['ali', 'maya', 'sam'],
};
const camp = { id: 'camp', name: 'Camp fee', amount: 4475000, currency: 'LBP', memberIds: ['ali'] };
const pay = (o) =>
  Object.assign(
    { id: 'p' + Math.random(), type: 'income', date: '2026-02-01', currency: 'USD', rate: 89500 },
    o,
  );
const mk = (tx) => ({
  rate: 89500,
  settings: { weekStart: 1 },
  accounts: [],
  opening: {},
  categories: [],
  members: [
    { id: 'ali', name: 'Ali' },
    { id: 'maya', name: 'Maya' },
    { id: 'sam', name: 'Sam' },
  ],
  fees: [dues, camp],
  tx,
});

test('paid, part paid and unpaid', () => {
  const s = mk([
    pay({ amount: 50, memberId: 'ali', feeId: 'dues' }),
    pay({ amount: 20, memberId: 'maya', feeId: 'dues' }),
    pay({ amount: 99, memberId: 'sam' }), // not toward this fee
    pay({ amount: 99, feeId: 'other', memberId: 'sam' }),
  ]);
  const st = feeStatus(s, dues);
  assert.deepEqual(
    st.members.map((m) => [m.memberId, m.state, m.owed]),
    [
      ['ali', 'paid', 0],
      ['maya', 'part', 30],
      ['sam', 'unpaid', 50],
    ],
  );
  assert.deepEqual([st.expected, st.collected, st.outstanding, st.paidCount], [150, 70, 80, 1]);
});

test('paying more than the fee never covers someone else', () => {
  const s = mk([pay({ amount: 80, memberId: 'ali', feeId: 'dues' })]);
  const st = feeStatus(s, dues);
  assert.equal(st.collected, 50);
  assert.equal(st.outstanding, 100);
  assert.equal(memberFeeStatus(s, dues, 'ali').owed, 0);
});

test('a payment in the other currency counts at its own rate, so a new app rate changes nothing', () => {
  const s = mk([pay({ amount: 2237500, currency: 'LBP', rate: 89500, memberId: 'ali', feeId: 'dues' })]);
  assert.equal(memberFeeStatus(s, dues, 'ali').owed, 25);
  s.rate = 1;
  assert.equal(memberFeeStatus(s, dues, 'ali').owed, 25);
  // An LL fee paid in dollars.
  const t = mk([pay({ amount: 50, rate: 89500, memberId: 'ali', feeId: 'camp' })]);
  assert.equal(memberFeeStatus(t, camp, 'ali').state, 'paid');
});

test('less than a cent or 500 LL left counts as paid', () => {
  const s = mk([
    pay({ amount: 49.996, memberId: 'ali', feeId: 'dues' }),
    pay({ amount: 4474600, currency: 'LBP', memberId: 'ali', feeId: 'camp' }),
  ]);
  assert.equal(memberFeeStatus(s, dues, 'ali').state, 'paid');
  assert.equal(memberFeeStatus(s, camp, 'ali').state, 'paid');
});

test('a member’s fees, and what is still owed in USD at today’s rate', () => {
  const s = mk([pay({ amount: 50, memberId: 'maya', feeId: 'dues' })]);
  assert.deepEqual(
    memberFees(s, 'ali').map((x) => [x.fee.id, x.state]),
    [
      ['dues', 'unpaid'],
      ['camp', 'unpaid'],
    ],
  );
  assert.equal(outstandingUSD(s, 'ali'), 50 + 4475000 / 89500);
  assert.equal(outstandingUSD(s, 'maya'), 0);
  assert.equal(outstandingUSD(s), 100 + 50);
  s.rate = 179000; // the LL fee is worth half as much in dollars now
  assert.equal(outstandingUSD(s), 100 + 25);
});

test('payments are listed oldest first, for one member or all', () => {
  const s = mk([
    pay({ id: 'b', amount: 10, date: '2026-03-01', memberId: 'ali', feeId: 'dues' }),
    pay({ id: 'a', amount: 10, date: '2026-01-01', memberId: 'maya', feeId: 'dues' }),
    pay({ id: 'x', type: 'expense', amount: 10, memberId: 'ali', feeId: 'dues' }),
  ]);
  assert.deepEqual(
    paymentsOf(s, 'dues').map((t) => t.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    paymentsOf(s, 'dues', 'ali').map((t) => t.id),
    ['b'],
  );
});
