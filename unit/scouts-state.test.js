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
  // The two default funds, and the one event's own account.
  assert.deepEqual(
    s.accounts.map((a) => a.id),
    ['wallet', 'bank', 'camp-e1'],
  );
  assert.ok(s.categories.length > 4);
  assert.deepEqual(
    s.events.map((e) => [e.id, e.name]),
    [['e1', 'Untitled event']],
  );
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
      members: [{ id: 'm1', name: 'Leader' }],
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
      events: [{ id: 'e', name: 'Camp' }],
      members: [{ id: 'm', name: 'Maya' }],
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

test('events are repaired, and entries lose links to events that are gone', () => {
  const s = normalize(
    base({
      events: [
        {
          id: 'camp',
          name: ' Summer camp ',
          start: '2026-07-01',
          end: '2026-06-01',
          budget: { amount: '500', currency: 'USD' },
        },
        { id: 'camp', name: 'Duplicate' },
        { id: 'hike', name: 'Hike', start: 'soon', budget: { amount: -1, currency: 'USD' }, closed: 'yes' },
      ],
      tx: [
        { id: 'a', type: 'expense', amount: 1, currency: 'USD', date: '2026-01-02', eventId: 'camp' },
        { id: 'b', type: 'expense', amount: 1, currency: 'USD', date: '2026-01-02', eventId: 'deleted' },
      ],
    }),
  );
  assert.deepEqual(s.events[0], {
    id: 'camp',
    name: 'Summer camp',
    start: '2026-07-01',
    end: '',
    budget: { amount: 500, currency: 'USD' },
    cotisation: null,
    attendees: [],
    closed: false,
    createdAt: 0,
    accountId: 'camp-camp',
  });
  assert.equal(s.events.length, 2);
  assert.deepEqual([s.events[1].start, s.events[1].budget, s.events[1].closed], ['', null, false]);
  assert.equal(s.tx[0].eventId, 'camp');
  assert.equal('eventId' in s.tx[1], false);
});

test('members and fees are repaired, and links to ones that are gone are dropped', () => {
  const s = normalize(
    base({
      events: [{ id: 'camp', name: 'Camp' }],
      members: [
        { id: 'ali', name: ' Ali ', role: 'leader', unit: 'Rovers', active: false },
        { id: 'ali', name: 'Duplicate' },
        { id: 'maya', role: 'chief', unit: 7 },
        { name: 'No id' },
      ],
      fees: [
        {
          id: 'dues',
          name: 'Dues',
          amount: '50',
          currency: 'USD',
          due: '2026-03-01',
          memberIds: ['ali', 'ali', 'gone', 'maya'],
        },
        { id: 'campfee', amount: 100, currency: 'USD', eventId: 'camp', memberIds: 'ali' },
        { id: 'x', amount: 1, currency: 'USD', eventId: 'deleted', due: 'tomorrow', memberIds: [] },
        { id: 'bad', name: 'No amount', amount: 0, currency: 'USD' },
        { id: 'bad2', name: 'Odd currency', amount: 5, currency: 'EUR' },
      ],
      tx: [
        {
          id: 'a',
          type: 'income',
          amount: 50,
          currency: 'USD',
          date: '2026-01-02',
          memberId: 'ali',
          feeId: 'dues',
        },
        {
          id: 'b',
          type: 'income',
          amount: 5,
          currency: 'USD',
          date: '2026-01-02',
          memberId: 'gone',
          feeId: 'bad',
        },
        { id: 'c', type: 'expense', amount: 5, currency: 'USD', date: '2026-01-02', paidBy: 'gone' },
      ],
    }),
  );
  assert.deepEqual(s.members, [
    { id: 'ali', name: 'Ali', role: 'leader', unit: 'Rovers', active: false, createdAt: 0 },
    { id: 'maya', name: 'Unnamed', role: 'scout', unit: '', active: true, createdAt: 0 },
  ]);
  // The fee tied to the camp became the camp's cotisation (see the next test).
  assert.deepEqual(
    s.fees.map((f) => [f.id, f.name, f.amount, f.due, f.eventId, f.memberIds]),
    [
      ['dues', 'Dues', 50, '2026-03-01', undefined, ['ali', 'maya']],
      ['x', 'Fee', 1, '', undefined, []],
    ],
  );
  assert.deepEqual(s.events[0].cotisation, { amount: 100, currency: 'USD' });
  assert.deepEqual([s.tx[0].memberId, s.tx[0].feeId], ['ali', 'dues']);
  assert.equal('memberId' in s.tx[1] || 'feeId' in s.tx[1], false);
  assert.equal('paidBy' in s.tx[2], false);
});

test('a fee tied to a camp becomes its cotisation, and its payments move along, once', () => {
  const data = base({
    members: [
      { id: 'ali', name: 'Ali' },
      { id: 'maya', name: 'Maya' },
    ],
    events: [
      { id: 'camp', name: 'Camp HP', attendees: ['maya'] },
      { id: 'noel', name: 'Camp Noël', cotisation: { amount: 20, currency: 'USD' } },
    ],
    fees: [
      { id: 'f1', name: 'Camp fee', amount: 4475000, currency: 'LBP', eventId: 'camp', memberIds: ['ali'] },
      { id: 'f2', name: 'Second fee', amount: 10, currency: 'USD', eventId: 'noel', memberIds: ['ali'] },
    ],
    tx: [
      {
        id: 'p',
        type: 'income',
        amount: 50,
        currency: 'USD',
        date: '2026-01-02',
        memberId: 'ali',
        feeId: 'f1',
      },
    ],
  });
  const s = normalize(data);
  assert.deepEqual(s.events[0].cotisation, { amount: 4475000, currency: 'LBP' });
  assert.deepEqual(s.events[0].attendees, ['maya', 'ali']);
  assert.deepEqual([s.tx[0].feeId, s.tx[0].eventId], ['camp', 'camp']);
  // Camp Noël already had a cotisation, so its old fee stays as it was.
  assert.deepEqual(
    s.fees.map((f) => f.id),
    ['f2'],
  );
  // Running it again changes nothing.
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))), s);
});

test('attendees must be members, and a cotisation needs a usable amount', () => {
  const s = normalize(
    base({
      members: [{ id: 'ali', name: 'Ali' }],
      events: [
        {
          id: 'a',
          name: 'A',
          attendees: ['ali', 'ali', 'ghost', 5],
          cotisation: { amount: '30', currency: 'USD' },
        },
        { id: 'b', name: 'B', attendees: 'ali', cotisation: { amount: 0, currency: 'USD' } },
      ],
      tx: [
        {
          id: 'p',
          type: 'income',
          amount: 30,
          currency: 'USD',
          date: '2026-01-02',
          memberId: 'ali',
          feeId: 'a',
        },
        {
          id: 'q',
          type: 'income',
          amount: 5,
          currency: 'USD',
          date: '2026-01-02',
          memberId: 'ali',
          feeId: 'b',
        },
      ],
    }),
  );
  assert.deepEqual(s.events[0].attendees, ['ali']);
  assert.deepEqual(s.events[0].cotisation, { amount: 30, currency: 'USD' });
  assert.deepEqual([s.events[1].attendees, s.events[1].cotisation], [[], null]);
  assert.equal(s.tx[0].feeId, 'a');
  assert.equal('feeId' in s.tx[1], false); // event B has no cotisation to pay toward
});
