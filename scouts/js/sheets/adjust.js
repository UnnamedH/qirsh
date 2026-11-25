/* "Correct balance": set a fund to the amount it really holds. Saved as a balance-only entry. */
import { accName } from '../../../js/core/accounts.js';
import { balances } from '../../../js/core/ledger.js';
import { fmt, parseInput, toInput } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { amountField } from '../../../js/ui/amount.js';
import { esc, uid, ymd } from '../../../js/util.js';
import { state } from '../state.js';
import { armed } from '../ui/ui-state.js';

const CUR = [
  ['USD', 'USD'],
  ['LBP', 'LL'],
];

export function adjustForm(account) {
  return { mode: 'new', kind: 'adjust', account, cur: 'USD', target: '', date: ymd(new Date()) };
}

export function adjustFromTx(t) {
  return {
    mode: 'edit',
    kind: 'adjust',
    id: t.id,
    account: t.account || 'wallet',
    cur: t.currency,
    target: t.target != null ? toInput(t.target, t.currency) : '',
    date: t.date,
  };
}

/* What the fund holds in `cur`, not counting the entry being edited. */
function holdsWithout(f) {
  const s = Object.assign({}, state, { tx: state.tx.filter((t) => t.id !== f.id) });
  return (balances(s)[f.account] || { USD: 0, LBP: 0 })[f.cur];
}

export function adjustSheet(f) {
  const now = holdsWithout(f);
  return (
    '<div class="sheet-head"><h2>Correct balance</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div><p class="note">' +
    esc(accName(state, f.account)) +
    ' should hold:</p><div class="amount-row">' +
    amountField({
      id: 'f-amount',
      value: f.target,
      cur: f.cur,
      label: 'Balance it should hold',
      attrs: ' data-f="target"',
    }) +
    '<div class="seg cur" role="group" aria-label="Currency">' +
    CUR.map(
      ([k, l]) =>
        '<button data-act="fcur" data-v="' + k + '" aria-pressed="' + (f.cur === k) + '">' + l + '</button>',
    ).join('') +
    '</div></div><p class="note" id="f-diff">' +
    diffText(f, now) +
    '</p><label class="field"><span>Date</span><input data-f="date" type="date" value="' +
    esc(f.date) +
    '"></label><p class="form-error" id="f-err" hidden></p><div class="sheet-actions">' +
    (f.mode === 'edit'
      ? '<button class="btn danger' +
        (armed === 'tx' ? ' armed' : '') +
        '" data-act="fdel">' +
        (armed === 'tx' ? 'Tap to confirm' : 'Delete') +
        '</button>'
      : '') +
    '<button class="btn primary" data-act="fsave">' +
    (f.mode === 'edit' ? 'Save changes' : 'Correct') +
    '</button></div>'
  );
}

function diffText(f, now) {
  const t = parseInput(f.target, f.cur);
  if (!isFinite(t)) return 'It holds ' + fmt(now, f.cur) + ' now.';
  const d = t - now;
  return (
    'It holds ' +
    fmt(now, f.cur) +
    ' now, so this ' +
    (d === 0 ? 'changes nothing.' : 'adds ' + fmt(d, f.cur, { sign: true }) + '.')
  );
}

/** Updates the "holds now" line while typing, without redrawing the field being typed in. */
export function updateAdjustPreview(f) {
  const el = document.getElementById('f-diff');
  if (el) el.textContent = diffText(f, holdsWithout(f));
}

export function buildAdjust(f, old) {
  const target = parseInput(f.target, f.cur);
  if (!isFinite(target)) return { error: 'Enter the balance it should hold.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return { error: 'Pick a date.' };
  const amount = Math.round((target - holdsWithout(f)) * 100) / 100;
  if (amount === 0) return { error: 'That is already the balance, so there is nothing to correct.' };
  return {
    tx: Object.assign({}, old, {
      id: (old && old.id) || uid(),
      createdAt: (old && old.createdAt) || Date.now(),
      type: 'adjust',
      date: f.date,
      account: f.account,
      currency: f.cur,
      amount,
      target,
      rate: (old && +old.rate > 0 && old.rate) || state.rate,
    }),
  };
}
