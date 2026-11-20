/* Unit tests for repairing scouts data. The module is loaded outside a browser, where there is no
   localStorage, so it starts from an empty state. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankState, isValid, normalize, parseState } from '../scouts/js/state.js';

const base = (over) => Object.assign({ app: 'frata-scouts', tx: [] }, over);

test('only scouts data is accepted: a personal Frata backup or junk is refused', () => {
  assert.equal(isValid({ app: 'qirsh', tx: [] }), false);
  assert.equal(isValid({ tx: [] }), false);
  assert.equal(isValid(null), false);
  assert.equal(parseState('{nope'), null);
  assert.equal(parseState(JSON.stringify({ app: 'qirsh', tx: [] })), null);
  assert.ok(parseState(JSON.stringify(base())));
});

test('bad data is repaired and never throws', () => {
  const s = normalize(
    base({
      rate: -4,
      settings: { display: 'EUR', weekStart: 12, theme: 'purple' },
      group: { name: 5 },
      accounts: 'nope',
      categories: [null, { id: 3 }],
      events: [null, { id: 'e1' }, { name: 'no id' }],
      members: 'x',
      tx: [
        null,
        { id: 'a', type: 'expense', amount: '12', currency: 'USD', date: '2026-01-02', eventId: 7 },
        { id: 'b', type: 'bogus', amount: 1, currency: 'USD', date: '2026-01-02' },
        { id: 'c', type: 'income', amount: 'x', currency: 'USD', date: '2026-01-02' },
        { id: 'd', type: 'income', amount: 5, currency: 'XXX', date: '2026-01-02' },
      ],
    }),
  );
  assert.equal(s.rate, blankState().rate);
  assert.deepEqual(s.settings, { display: 'USD', weekStart: 1, theme: 'system' });
  assert.equal(s.group.name, '');
  assert.deepEqual(
    s.accounts.map((a) => a.id),
    ['wallet', 'bank'],
  );
  assert.ok(s.categories.length > 4);
  assert.deepEqual(s.events, [{ id: 'e1' }]);
  assert.deepEqual(s.members, []);
  assert.deepEqual(
    s.tx.map((t) => t.id),
    ['a'],
  );
  assert.equal(s.tx[0].amount, 12);
  assert.equal('eventId' in s.tx[0], false);
});

test('every entry gets the rate of the day it was saved, once', () => {
  const s = normalize(
    base({
      rate: 90000,
      tx: [
        { id: 'a', type: 'expense', amount: 1, currency: 'LBP', date: '2026-01-02' },
        { id: 'b', type: 'expense', amount: 1, currency: 'LBP', date: '2026-01-02', rate: 80000 },
        {
          id: 't',
          type: 'transfer',
          amount: 1,
          currency: 'USD',
          date: '2026-01-02',
          from: 'wallet',
          to: 'bank',
        },
      ],
    }),
  );
  assert.deepEqual(
    s.tx.map((t) => t.rate),
    [90000, 80000, undefined],
  );
});

test('a fund that entries or starting balances use is kept even if the list lost it', () => {
  const s = normalize(
    base({
      accounts: [{ id: 'wallet', name: 'Box' }],
      opening: { camp: { USD: 5 } },
      tx: [{ id: 'a', type: 'income', amount: 1, currency: 'USD', date: '2026-01-02', account: 'bank' }],
    }),
  );
  assert.deepEqual(s.accounts.map((a) => a.id).sort(), ['bank', 'camp', 'wallet']);
  assert.equal(s.accounts[0].name, 'Box');
  assert.deepEqual(s.opening.camp, { USD: 5, LBP: 0 });
});

test('a leader who paid and the claims a reimbursement covers are kept only when valid', () => {
  const tx = (o) => Object.assign({ type: 'expense', amount: 1, currency: 'USD', date: '2026-01-02' }, o);
  const s = normalize(
    base({
      tx: [
        tx({ id: 'a', paidBy: 'm1', claimIds: ['c1', 'c1', '', 4, 'c2'] }),
        tx({ id: 'b', paidBy: 3, claimIds: 'c1' }),
        tx({ id: 'c', claimIds: [] }),
      ],
    }),
  );
  assert.equal(s.tx[0].paidBy, 'm1');
  assert.deepEqual(s.tx[0].claimIds, ['c1', 'c2']);
  assert.equal('paidBy' in s.tx[1], false);
  assert.equal('claimIds' in s.tx[1], false);
  assert.equal('claimIds' in s.tx[2], false);
});

test('links to events, members and fees survive when they are plain ids', () => {
  const s = normalize(
    base({
      tx: [
        {
          id: 'a',
          type: 'income',
          amount: 1,
          currency: 'USD',
          date: '2026-01-02',
          eventId: 'e',
          memberId: 'm',
          feeId: '',
        },
      ],
    }),
  );
  assert.equal(s.tx[0].eventId, 'e');
  assert.equal(s.tx[0].memberId, 'm');
  assert.equal('feeId' in s.tx[0], false);
});
