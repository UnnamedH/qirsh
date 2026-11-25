/* Unit tests for the receipt helpers that need no browser (scouts/js/receipts.js). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitWithin, isImageUrl, receiptsFromBackup, usedIds } from '../scouts/js/receipts.js';
import { normalize } from '../scouts/js/state.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

test('a picture is fitted inside a size, in proportion, and never enlarged', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { w: 1600, h: 1200 });
  assert.deepEqual(fitWithin(3000, 4000, 1600), { w: 1200, h: 1600 });
  assert.deepEqual(fitWithin(800, 600, 1600), { w: 800, h: 600 });
  assert.deepEqual(fitWithin(0, 0, 1600), { w: 1, h: 1 });
});

test('only pictures as data URLs are accepted', () => {
  assert.equal(isImageUrl(PNG), true);
  assert.equal(isImageUrl(JPG), true);
  for (const bad of [
    '',
    null,
    42,
    'https://example.com/a.png',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,<script>',
    'javascript:alert(1)',
  ])
    assert.equal(isImageUrl(bad), false, String(bad));
});

test('entries keep a receipt id only on an expense or income', () => {
  const tx = (o) => Object.assign({ date: '2026-01-02', currency: 'USD', amount: 5 }, o);
  const s = normalize({
    app: 'frata-scouts',
    tx: [
      tx({ id: 'a', type: 'expense', receiptId: 'r1' }),
      tx({ id: 'b', type: 'income', receiptId: 'r2' }),
      tx({ id: 'c', type: 'expense', receiptId: 7 }),
      tx({ id: 'd', type: 'expense', receiptId: '' }),
      tx({ id: 'e', type: 'transfer', from: 'wallet', to: 'wallet', receiptId: 'r3' }),
      tx({ id: 'f', type: 'adjust', receiptId: 'r4' }),
    ],
  });
  assert.deepEqual(
    s.tx.map((t) => [t.id, t.receiptId]),
    [
      ['a', 'r1'],
      ['b', 'r2'],
      ['c', undefined],
      ['d', undefined],
      ['e', undefined],
      ['f', undefined],
    ],
  );
  assert.deepEqual([...usedIds(s)].sort(), ['r1', 'r2']);
});

test('a backup brings back only receipts an entry refers to, and only real pictures', () => {
  const state = normalize({
    app: 'frata-scouts',
    tx: [
      { id: 'a', type: 'expense', date: '2026-01-02', currency: 'USD', amount: 5, receiptId: 'r1' },
      { id: 'b', type: 'expense', date: '2026-01-02', currency: 'USD', amount: 5, receiptId: 'r2' },
      { id: 'c', type: 'expense', date: '2026-01-02', currency: 'USD', amount: 5, receiptId: 'r3' },
    ],
  });
  const raw = { receipts: { r1: PNG, r2: 'javascript:alert(1)', r4: JPG } };
  // r2 isn't a picture, r3 has none, r4 is used by no entry.
  assert.deepEqual(receiptsFromBackup(raw, state), { r1: PNG });
  assert.deepEqual(receiptsFromBackup({}, state), {});
  assert.deepEqual(receiptsFromBackup(null, state), {});
  assert.deepEqual(receiptsFromBackup({ receipts: 'x' }, state), {});
});

test('the receipts in a backup never end up in the saved state', () => {
  const s = normalize({ app: 'frata-scouts', tx: [], receipts: { r1: PNG } });
  assert.equal('receipts' in s, false);
});
