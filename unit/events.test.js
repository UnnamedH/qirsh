/* Unit tests for event and camp totals (js/core/events.js). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventBudget, eventOf, eventTotals, pickableEvents } from '../js/core/events.js';

const mk = (tx, events = []) => ({
  rate: 90000,
  settings: { weekStart: 1 },
  accounts: [{ id: 'wallet', name: 'Cash box' }],
  opening: {},
  categories: [],
  tx,
  events,
});
const e = (o) => Object.assign({ type: 'expense', date: '2026-03-01', currency: 'USD', rate: 90000 }, o);

test('totals count only the event’s own expenses and income', () => {
  const s = mk([
    e({ id: '1', amount: 40, eventId: 'camp', categoryId: 'food' }),
    e({ id: '2', amount: 10, eventId: 'camp', categoryId: 'transport' }),
    e({ id: '3', amount: 5, eventId: 'camp', categoryId: 'food' }),
    e({ id: '4', amount: 99, eventId: 'other' }),
    e({ id: '5', amount: 99 }),
    e({ id: '6', type: 'income', amount: 120, eventId: 'camp' }),
    {
      id: '7',
      type: 'transfer',
      date: '2026-03-01',
      currency: 'USD',
      amount: 50,
      from: 'wallet',
      to: 'bank',
      eventId: 'camp',
    },
    e({ id: '8', type: 'adjust', amount: -3, account: 'wallet', eventId: 'camp' }),
  ]);
  const t = eventTotals(s, 'camp', 'USD');
  assert.equal(t.spent, 55);
  assert.equal(t.earned, 120);
  assert.equal(t.net, 65);
  assert.equal(t.count, 4);
  assert.deepEqual(t.byCat, { food: 45, transport: 10 });
});

test('LL entries count at their own rate, so a new app rate moves nothing', () => {
  const s = mk([e({ id: '1', amount: 900000, currency: 'LBP', rate: 90000, eventId: 'camp' })]);
  assert.equal(eventTotals(s, 'camp', 'USD').spent, 10);
  s.rate = 1;
  assert.equal(eventTotals(s, 'camp', 'USD').spent, 10);
  assert.equal(eventTotals(s, 'camp', 'LBP').spent, 900000);
});

test('budget progress is in the budget’s currency', () => {
  const camp = { id: 'camp', name: 'Camp', budget: { amount: 100, currency: 'USD' } };
  const s = mk([e({ id: '1', amount: 85, eventId: 'camp' })], [camp]);
  const b = eventBudget(s, camp);
  assert.deepEqual([b.spent, b.limit, b.left, b.state], [85, 100, 15, 'warn']);
  s.tx.push(e({ id: '2', amount: 1800000, currency: 'LBP', eventId: 'camp' }));
  assert.equal(eventBudget(s, camp).state, 'over');
  assert.equal(eventBudget(s, { id: 'x', name: 'No budget' }), null);
  assert.equal(eventBudget(s, { id: 'x', name: 'Zero', budget: { amount: 0, currency: 'USD' } }), null);
});

test('closed events leave the picker unless an entry already uses them', () => {
  const s = mk(
    [],
    [
      { id: 'a', name: 'Open' },
      { id: 'b', name: 'Done', closed: true },
    ],
  );
  assert.deepEqual(
    pickableEvents(s).map((x) => x.id),
    ['a'],
  );
  assert.deepEqual(
    pickableEvents(s, 'b').map((x) => x.id),
    ['a', 'b'],
  );
  assert.equal(eventOf(s, 'b').name, 'Done');
  assert.equal(eventOf(s, 'gone'), undefined);
  assert.equal(eventOf(s, undefined), undefined);
});
