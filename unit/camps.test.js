/* Unit tests for camps' own accounts (scouts/js/camps.js). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { balances } from '../js/core/ledger.js';
import {
  campAccountIds,
  campAccountUsed,
  ensureCampAccount,
  finishCamp,
  reopenCamp,
} from '../scouts/js/camps.js';
import { normalize } from '../scouts/js/state.js';

const base = (o) =>
  normalize(
    Object.assign(
      {
        app: 'frata-scouts',
        rate: 90000,
        events: [{ id: 'hp', name: 'Camp HP' }],
        tx: [],
      },
      o,
    ),
  );
const inc = (o) =>
  Object.assign({ id: 'i' + Math.random(), type: 'income', date: '2026-12-01', currency: 'USD' }, o);

test('every camp gets its own account, named after it, once', () => {
  const s = base();
  assert.equal(s.events[0].accountId, 'camp-hp');
  assert.deepEqual(
    s.accounts.find((a) => a.id === 'camp-hp'),
    { id: 'camp-hp', name: 'Camp HP' },
  );
  assert.deepEqual(s.opening['camp-hp'], { USD: 0, LBP: 0 });
  assert.deepEqual([...campAccountIds(s)], ['camp-hp']);
  // Loading again, or renaming the camp, finds the same account.
  const again = normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(again.accounts.filter((a) => a.id === 'camp-hp').length, 1);
  s.events[0].name = 'Camp HP 2026';
  ensureCampAccount(s, s.events[0]);
  assert.equal(s.accounts.filter((a) => a.id.startsWith('camp-')).length, 1);
  assert.equal(s.accounts.find((a) => a.id === 'camp-hp').name, 'Camp HP 2026');
});

test('finishing a camp sends what is left back to the caisse and hides its account; reopening brings it back', () => {
  const s = base({
    tx: [
      inc({ amount: 100, account: 'camp-hp', eventId: 'hp' }),
      inc({ amount: 900000, currency: 'LBP', account: 'camp-hp', eventId: 'hp' }),
      inc({ type: 'expense', amount: 30, account: 'camp-hp', eventId: 'hp' }),
    ],
  });
  assert.equal(campAccountUsed(s, s.events[0]), true);
  const moved = finishCamp(s, s.events[0]);
  assert.equal(moved.length, 2);
  const b = balances(s);
  assert.deepEqual(b['camp-hp'], { USD: 0, LBP: 0 });
  assert.deepEqual(b.wallet, { USD: 70, LBP: 900000 });
  assert.equal(s.events[0].closed, true);
  assert.equal(s.accounts.find((a) => a.id === 'camp-hp').hidden, true);
  reopenCamp(s, s.events[0]);
  assert.equal(s.events[0].closed, false);
  assert.equal('hidden' in s.accounts.find((a) => a.id === 'camp-hp'), false);
});

test('an overdrawn camp is topped up from the caisse when it finishes', () => {
  const s = base({ tx: [inc({ type: 'expense', amount: 25, account: 'camp-hp' })] });
  finishCamp(s, s.events[0]);
  assert.deepEqual(balances(s)['camp-hp'], { USD: 0, LBP: 0 });
  assert.equal(balances(s).wallet.USD, -25);
});

test('a camp with an empty account moves nothing when it finishes', () => {
  const s = base();
  assert.equal(campAccountUsed(s, s.events[0]), false);
  assert.deepEqual(finishCamp(s, s.events[0]), []);
});
