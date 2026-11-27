/* Sheet for adding and editing a recurring entry, like rent or a salary. */
import { MAX_RECURRING, isYmd } from '../core/recurring.js';
import { ICON } from '../icons.js';
import { parseInput, toInput } from '../money.js';
import { state } from '../state.js';
import { amountField } from '../ui/amount.js';
import { commit } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { armed } from '../ui/ui-state.js';
import { $, esc, parseYmd, uid, ymd } from '../util.js';
import { accountOptions, curToggle } from './entry.js';
import { closeSheet, form } from './sheet.js';

/** A fresh form for a new recurring entry, due first today. */
export const newRecurringForm = () => ({
  id: null,
  type: 'expense',
  amount: '',
  currency: 'USD',
  categoryId: null,
  account: 'wallet',
  note: '',
  every: 'month',
  date: ymd(new Date()),
});

export function recurringFormFrom(r) {
  return {
    id: r.id,
    type: r.type,
    amount: toInput(r.amount, r.currency),
    currency: r.currency,
    categoryId: r.categoryId,
    account: r.account,
    note: r.note,
    every: r.every,
    date: r.next,
  };
}

const seg = (act, current, options) =>
  '<div class="seg wide">' +
  options
    .map(
      ([k, l]) =>
        '<button data-act="' +
        act +
        '" data-v="' +
        k +
        '" aria-pressed="' +
        (current === k) +
        '">' +
        l +
        '</button>',
    )
    .join('') +
  '</div>';

export function recurringSheet() {
  const f = form;
  const cats = state.categories.filter((c) => (c.type === 'income') === (f.type === 'income'));
  let h =
    '<div class="sheet-head"><h2>' +
    (f.id ? 'Edit recurring entry' : 'New recurring entry') +
    '</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>';
  h += seg('rtype', f.type, [
    ['expense', 'Expense'],
    ['income', 'Income'],
  ]);
  h +=
    '<div class="amount-row">' +
    amountField({ id: 'r-amount', value: f.amount, cur: f.currency, label: 'Amount' }) +
    curToggle('rcur', f.currency) +
    '</div>';
  h +=
    '<div class="field"><span>Category</span><div class="chips" role="group" aria-label="Category">' +
    cats
      .map(
        (c) =>
          '<button class="chip" data-act="rcat" data-v="' +
          esc(c.id) +
          '" aria-pressed="' +
          (f.categoryId === c.id) +
          '">' +
          (c.icon ? esc(c.icon) + ' ' : '') +
          esc(c.name) +
          '</button>',
      )
      .join('') +
    '</div></div>';
  h +=
    '<div class="grid2"><label class="field"><span>' +
    (f.type === 'income' ? 'Into' : 'From') +
    '</span><select id="r-acct">' +
    accountOptions(f.account) +
    '</select></label><label class="field"><span>Note</span><input id="r-note" maxlength="100" autocomplete="off" placeholder="Optional" value="' +
    esc(f.note) +
    '"></label></div>';
  h +=
    '<div class="field"><span>Repeats</span>' +
    seg('revery', f.every, [
      ['month', 'Every month'],
      ['week', 'Every week'],
    ]) +
    '</div>';
  h +=
    '<label class="field"><span>' +
    (f.id ? 'Next due' : 'First due') +
    '</span><input id="r-date" type="date" value="' +
    esc(f.date) +
    '"></label>';
  if (f.every === 'month')
    h += '<p class="note">On the same day each month. In a shorter month, on its last day.</p>';
  h +=
    '<p class="form-error" id="r-err" hidden></p><div class="sheet-actions">' +
    (f.id
      ? '<button class="btn danger' +
        (armed === 'recurring' ? ' armed' : '') +
        '" data-act="recdel">' +
        (armed === 'recurring' ? 'Tap to confirm' : 'Delete') +
        '</button>'
      : '') +
    '<button class="btn primary" data-act="recsave">' +
    (f.id ? 'Save changes' : 'Add') +
    '</button></div>';
  return h;
}

/** Copies what's typed into the form, so a redraw (a different category, say) keeps it. */
export function readRecurring() {
  const a = $('#r-amount'),
    n = $('#r-note'),
    d = $('#r-date'),
    ac = $('#r-acct');
  if (a) form.amount = a.value;
  if (n) form.note = n.value;
  if (d) form.date = d.value;
  if (ac) form.account = ac.value;
}

export function saveRecurring() {
  readRecurring();
  const f = form;
  const err = $('#r-err');
  const fail = (m) => {
    err.textContent = m;
    err.hidden = false;
  };
  const amount = parseInput(f.amount, f.currency);
  if (!(amount > 0)) return fail('Enter an amount above zero.');
  if (!f.categoryId) return fail('Pick a category.');
  if (!isYmd(f.date)) return fail('Pick the date it is first due.');
  if (!f.id && state.recurring.length >= MAX_RECURRING)
    return fail('That is the most recurring entries (' + MAX_RECURRING + ').');
  const r = {
    id: f.id || uid(),
    type: f.type,
    amount,
    currency: f.currency,
    categoryId: f.categoryId,
    account: f.account || 'wallet',
    note: f.note.trim().slice(0, 100),
    every: f.every,
    next: f.date,
  };
  if (r.every === 'month') r.day = parseYmd(r.next).getDate();
  const i = state.recurring.findIndex((x) => x.id === r.id);
  if (i >= 0) state.recurring[i] = r;
  else state.recurring.push(r);
  closeSheet();
  commit();
  toast(f.id ? 'Saved' : 'Added. It shows on Home when it is due.');
}
