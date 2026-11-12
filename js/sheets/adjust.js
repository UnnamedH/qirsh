/* Sheet for correcting an account's balance to what it really holds, e.g. after missed entries. */
import { ACCOUNTS, accName } from '../config.js';
import { ICON } from '../icons.js';
import { balances, catName } from '../ledger.js';
import { fmt, parseInput, toInput } from '../money.js';
import { thousandsInput } from '../ui/amount.js';
import { closeSheet, form } from './sheet.js';
import { state } from '../state.js';
import { commit } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { armed } from '../ui/ui-state.js';
import { $, dayLabel, esc, uid, ymd } from '../util.js';

const CURS = ['USD', 'LBP'];
const curName = (c) => (c === 'USD' ? 'USD' : 'LL');
const round = (n, c) => (c === 'USD' ? Math.round(n * 100) / 100 : Math.round(n));
const balanceText = (n, c) => toInput(round(n, c), c);
const current = (account) => balances()[account] || { USD: 0, LBP: 0 };

/** A new correction for an account, starting from the balance Frata has for it now. */
export function adjustForm(account) {
  const b = current(account);
  return {
    mode: 'new',
    account,
    USD: balanceText(b.USD, 'USD'),
    LBP: balanceText(b.LBP, 'LBP'),
    count: true,
    expCat: 'other',
    incCat: 'other-in',
    note: '',
    date: ymd(new Date()),
  };
}

/** Viewing a saved "balance only" correction, which can only be deleted. */
export const adjustView = (t) => ({ mode: 'view', id: t.id });

/**
 * What would change: one item per currency whose entered balance differs from Frata's, with the
 * signed difference. Returns null if an entered amount is not a number. A blank amount is left as is.
 */
export function adjustDiffs(f) {
  const b = current(f.account),
    out = [];
  for (const cur of CURS) {
    const raw = String(f[cur] || '').trim();
    if (!raw) continue;
    const n = parseInput(raw, cur);
    if (!isFinite(n)) return null;
    const diff = round(n - b[cur], cur);
    if (Math.abs(diff) < (cur === 'USD' ? 0.005 : 1)) continue;
    out.push({ cur, diff, target: round(n, cur) });
  }
  return out;
}

function chips(act, type, selected) {
  return (
    '<div class="chips" role="group">' +
    state.categories
      .filter((c) => c.type === type)
      .map(
        (c) =>
          '<button class="chip" data-act="' +
          act +
          '" data-v="' +
          esc(c.id) +
          '" aria-pressed="' +
          (selected === c.id) +
          '">' +
          (c.icon ? esc(c.icon) + ' ' : '') +
          esc(c.name) +
          '</button>',
      )
      .join('') +
    '</div>'
  );
}

function viewSheet(f) {
  const t = state.tx.find((x) => x.id === f.id && x.type === 'adjust');
  let h =
    '<div class="sheet-head"><h2>Balance correction</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>';
  if (!t) return h + '<p class="note">This correction was deleted.</p>';
  h +=
    '<p class="note">' +
    esc(dayLabel(t.date)) +
    ': ' +
    esc(accName(t.account || 'wallet')) +
    ' ' +
    curName(t.currency) +
    (t.target != null
      ? ' was set to <strong>' + fmt(t.target, t.currency) + '</strong>, a change of '
      : ' changed by ') +
    '<strong>' +
    fmt(t.amount, t.currency, { sign: true }) +
    '</strong>. It changed the balance only and isn’t counted as spending or income.</p>' +
    (t.note ? '<p class="note">' + esc(t.note) + '</p>' : '') +
    '<p class="note">Deleting it puts the balance back to what it was.</p>';
  h +=
    '<div class="sheet-actions"><button class="btn danger' +
    (armed === 'adjust' ? ' armed' : '') +
    '" data-act="adel">' +
    (armed === 'adjust' ? 'Tap to confirm' : 'Delete') +
    '</button></div>';
  return h;
}

export function adjustSheet() {
  const f = form;
  if (f.mode === 'view') return viewSheet(f);
  const b = current(f.account);
  let h =
    '<div class="sheet-head"><h2>Correct balance</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>';
  h +=
    '<p class="note">Missed some entries? Enter what the account actually holds now, and Frata records the difference.</p>';
  h +=
    '<label class="field"><span>Account</span><select id="a-acct">' +
    ACCOUNTS.map(
      (a) =>
        '<option value="' + a.id + '"' + (f.account === a.id ? ' selected' : '') + '>' + a.name + '</option>',
    ).join('') +
    '</select></label>';
  h +=
    '<div class="grid2">' +
    CURS.map(
      (c) =>
        '<label class="field"><span>' +
        curName(c) +
        ' now</span>' +
        (c === 'LBP'
          ? thousandsInput(' id="a-LBP"', f[c], 'LL the account holds now')
          : '<input id="a-' +
            c +
            '" class="num" inputmode="decimal" autocomplete="off" value="' +
            esc(f[c]) +
            '" aria-label="' +
            curName(c) +
            ' the account holds now">') +
        '<span class="sub-label">Frata has ' +
        fmt(b[c], c) +
        '</span></label>',
    ).join('') +
    '</div>';
  h +=
    '<div class="seg wide" role="group" aria-label="How to count the difference">' +
    [
      ['1', 'Count it'],
      ['0', 'Just fix the balance'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="acount" data-v="' +
          k +
          '" aria-pressed="' +
          (f.count === (k === '1')) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div>';
  h +=
    '<p class="note">' +
    (f.count
      ? 'Missing money is added as an expense, and extra money as income, so your totals and budgets include it.'
      : 'Only the balance changes. Spending, income and budgets stay as they are.') +
    '</p>';
  if (f.count)
    h +=
      '<div id="a-exp" hidden><span class="sub-label">Count missing money as</span>' +
      chips('aexp', 'expense', f.expCat) +
      '</div>' +
      '<div id="a-inc" hidden><span class="sub-label">Count extra money as</span>' +
      chips('ainc', 'income', f.incCat) +
      '</div>';
  h += '<p class="hint" id="a-preview"></p>';
  h +=
    '<div class="grid2"><label class="field"><span>Note</span><input id="a-note" list="notesList" autocomplete="off" value="' +
    esc(f.note) +
    '" placeholder="Optional"></label><label class="field"><span>Date</span><input id="a-date" type="date" value="' +
    esc(f.date) +
    '"></label></div>';
  h +=
    '<p class="form-error" id="a-err" hidden></p><div class="sheet-actions">' +
    '<button class="btn primary" data-act="asave">Save correction</button></div>';
  return h;
}

/** Copies what is typed in the sheet into the form. */
export function readAdjust() {
  const f = form;
  if (!f || f.mode !== 'new') return;
  for (const k of ['USD', 'LBP', 'note', 'date']) {
    const el = $('#a-' + k);
    if (el) f[k] = el.value;
  }
}

/** Shows what saving would do, and which category pickers apply. */
export function updateAdjustPreview() {
  const f = form,
    el = $('#a-preview');
  if (!f || f.mode !== 'new' || !el) return;
  const diffs = adjustDiffs(f);
  const neg = !!diffs && diffs.some((d) => d.diff < 0),
    pos = !!diffs && diffs.some((d) => d.diff > 0);
  const exp = $('#a-exp'),
    inc = $('#a-inc');
  if (exp) exp.hidden = !neg;
  if (inc) inc.hidden = !pos;
  if (!diffs) el.textContent = 'Enter amounts as numbers.';
  else if (!diffs.length) el.textContent = 'This matches what Frata has. Nothing to correct.';
  else
    el.textContent =
      accName(f.account) +
      ': ' +
      diffs.map((d) => fmt(d.diff, d.cur, { sign: true })).join('  ') +
      (f.count
        ? ' · ' +
          [neg && 'expense in ' + catName(f.expCat), pos && 'income in ' + catName(f.incCat)]
            .filter(Boolean)
            .join(', ')
        : ' · balance only');
}

/** Switches the sheet to another account, starting from that account's balance. */
export function setAdjustAccount(account) {
  readAdjust();
  const b = current(account);
  Object.assign(form, { account, USD: balanceText(b.USD, 'USD'), LBP: balanceText(b.LBP, 'LBP') });
}

export function saveAdjust() {
  readAdjust();
  const f = form,
    err = $('#a-err'),
    fail = (m) => {
      err.textContent = m;
      err.hidden = false;
    };
  const diffs = adjustDiffs(f);
  if (!diffs) return fail('Enter amounts as numbers.');
  if (!diffs.length) return fail('This already matches what Frata has.');
  if (!f.date) return fail('Pick a date.');
  const now = Date.now(),
    note = f.note.trim();
  const added = diffs.map((d) => {
    const base = {
      id: uid(),
      currency: d.cur,
      account: f.account,
      note,
      date: f.date,
      createdAt: now,
      rate: state.rate,
    };
    if (!f.count) return Object.assign(base, { type: 'adjust', amount: d.diff, target: d.target });
    // Counted: an ordinary expense or income entry, marked so it reads as a correction.
    return Object.assign(base, {
      type: d.diff < 0 ? 'expense' : 'income',
      amount: Math.abs(d.diff),
      categoryId: d.diff < 0 ? f.expCat : f.incCat,
      correction: true,
    });
  });
  state.tx.push(...added);
  closeSheet();
  commit();
  const ids = new Set(added.map((t) => t.id));
  toast(accName(f.account) + ' balance corrected', () => {
    state.tx = state.tx.filter((t) => !ids.has(t.id));
    commit();
  });
}

export function deleteAdjust() {
  const t = state.tx.find((x) => x.id === form.id);
  if (!t) return closeSheet();
  state.tx = state.tx.filter((x) => x !== t);
  closeSheet();
  commit();
  toast('Correction deleted', () => {
    state.tx.push(t);
    commit();
  });
}
