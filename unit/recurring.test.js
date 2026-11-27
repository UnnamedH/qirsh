/* Unit tests for recurring entries: when they fall due, with month ends and long gaps. Run with `npm run test:unit`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_DUE, allDue, dueNow, entryFor, isYmd, nextDate, occurrences } from '../js/core/recurring.js';

const rent = (over = {}) => ({
  id: 'rent',
  type: 'expense',
  amount: 300,
  currency: 'USD',
  categoryId: 'bills',
  account: 'wallet',
  note: 'Rent',
  every: 'month',
  day: 1,
  next: '2026-11-01',
  ...over,
});

test('monthly: the same day next month, and a short month uses its last day without drifting', () => {
  const r = rent({ day: 31 });
  assert.equal(nextDate(r, '2026-01-31'), '2026-02-28');
  assert.equal(nextDate(r, '2026-02-28'), '2026-03-31', 'back to the 31st: the day is kept');
  assert.equal(nextDate(r, '2026-03-31'), '2026-04-30');
  assert.equal(nextDate(r, '2028-01-31'), '2028-02-29', 'a leap year');
  assert.equal(nextDate(r, '2026-12-31'), '2027-01-31', 'across the new year');
  assert.equal(nextDate(rent({ day: 15 }), '2026-11-15'), '2026-12-15');
  assert.equal(nextDate(rent({ day: undefined }), '2026-11-20'), '2026-12-20', 'no saved day: from the date');
});

test('weekly: seven days on, across months and years', () => {
  const r = rent({ every: 'week', day: undefined });
  assert.equal(nextDate(r, '2026-11-27'), '2026-12-04');
  assert.equal(nextDate(r, '2026-12-28'), '2027-01-04');
});

test('dates are checked for real', () => {
  for (const ok of ['2026-02-28', '2028-02-29', '2026-12-31']) assert.equal(isYmd(ok), true, ok);
  for (const bad of ['2026-02-30', '2026-13-01', '2026-1-1', '26-01-01', '', null, 20261101, '2026-02-29'])
    assert.equal(isYmd(bad), false, String(bad));
});

test('nothing is due before its day, and it is due on the day and after', () => {
  const r = rent({ next: '2026-12-01' });
  assert.deepEqual(dueNow([r], '2026-11-30'), []);
  assert.deepEqual(
    dueNow([r], '2026-12-01').map((x) => [x.date, x.more]),
    [['2026-12-01', 0]],
  );
  assert.deepEqual(occurrences(r, '2026-12-01'), ['2026-12-01']);
});

test('a long gap offers each date oldest first, and says how many wait behind the first', () => {
  const r = rent({ next: '2026-09-01' });
  assert.deepEqual(occurrences(r, '2026-11-27'), ['2026-09-01', '2026-10-01', '2026-11-01']);
  const [d] = dueNow([r], '2026-11-27');
  assert.deepEqual([d.date, d.more], ['2026-09-01', 2]);
});

test('only the latest dates are offered after a very long gap', () => {
  const weekly = rent({ every: 'week', day: undefined, next: '2024-01-01' });
  const o = occurrences(weekly, '2026-11-27');
  assert.equal(o.length, MAX_DUE);
  assert.equal(
    o.at(-1) <= '2026-11-27' && nextDate(weekly, o.at(-1)) > '2026-11-27',
    true,
    'ends with the latest',
  );
  // A date that is far in the past, or nonsense that got through, can't loop for ever.
  assert.ok(occurrences(rent({ next: '1000-01-01' }), '2026-11-27').length <= MAX_DUE);
});

test('several entries are listed oldest first, and "add all" has every date', () => {
  const a = rent({ id: 'a', next: '2026-11-20', every: 'week', day: undefined });
  const b = rent({ id: 'b', next: '2026-11-10' });
  const list = dueNow([a, b], '2026-11-27');
  assert.deepEqual(
    list.map((x) => [x.rec.id, x.date, x.more]),
    [
      ['b', '2026-11-10', 0],
      ['a', '2026-11-20', 1], // 27 November waits behind it
    ],
  );
  // 'a' is weekly: 20 Nov and 27 Nov are both due.
  assert.deepEqual(
    allDue([a, b], '2026-11-27').map((x) => x.rec.id + x.date.slice(5)),
    ['b11-10', 'a11-20', 'a11-27'],
  );
});

test('the entry made from a due date', () => {
  assert.deepEqual(entryFor(rent(), '2026-11-01', 89500, 'new1', 123), {
    id: 'new1',
    type: 'expense',
    amount: 300,
    currency: 'USD',
    categoryId: 'bills',
    account: 'wallet',
    note: 'Rent',
    date: '2026-11-01',
    createdAt: 123,
    rate: 89500,
  });
});
