/* Sheet for adding and editing budgets. */
import { ICON } from '../icons.js';
import { budgetName } from '../ledger.js';
import { parseAmt } from '../money.js';
import { curToggle } from './entry.js';
import { closeSheet, form } from './sheet.js';
import { state } from '../state.js';
import { commit } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { armed } from '../ui/ui-state.js';
import { $, esc, uid } from '../util.js';

export function budgetSheet() {
  const f = form;
  const cats = state.categories.filter((c) => c.type === 'expense');
  let h =
    '<div class="sheet-head"><h2>' +
    (f.id ? 'Edit budget' : 'New budget') +
    '</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>';
  h +=
    '<label class="field"><span>Applies to</span><select id="b-cat"><option value="">All spending (overall cap)</option>' +
    cats
      .map(
        (c) =>
          '<option value="' +
          esc(c.id) +
          '"' +
          (f.categoryId === c.id ? ' selected' : '') +
          '>' +
          esc(c.name) +
          '</option>',
      )
      .join('') +
    '</select></label>';
  h +=
    '<div class="field"><span>Resets every</span><div class="seg wide">' +
    [
      ['week', 'Week'],
      ['month', 'Month'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="bperiod" data-v="' +
          k +
          '" aria-pressed="' +
          (f.period === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div></div>';
  h +=
    '<div class="amount-row"><input id="b-amount" class="amount-input" inputmode="decimal" placeholder="0" value="' +
    esc(f.amount) +
    '" aria-label="Limit">' +
    curToggle('bcur', f.currency) +
    '</div>';
  h +=
    '<p class="form-error" id="b-err" hidden></p><div class="sheet-actions">' +
    (f.id
      ? '<button class="btn danger' +
        (armed === 'budget' ? ' armed' : '') +
        '" data-act="bdel">' +
        (armed === 'budget' ? 'Tap to confirm' : 'Delete') +
        '</button>'
      : '') +
    '<button class="btn primary" data-act="bsave">' +
    (f.id ? 'Save changes' : 'Add budget') +
    '</button></div>';
  return h;
}

export function readBudget() {
  const c = $('#b-cat'),
    a = $('#b-amount');
  if (c) form.categoryId = c.value || null;
  if (a) form.amount = a.value;
}

export function saveBudget() {
  readBudget();
  const f = form;
  const a = parseAmt(f.amount);
  const err = $('#b-err');
  if (!(a > 0)) {
    err.textContent = 'Enter a limit above zero.';
    err.hidden = false;
    return;
  }
  const dup = state.budgets.find(
    (b) => b.id !== f.id && (b.categoryId || null) === (f.categoryId || null) && b.period === f.period,
  );
  if (dup) {
    err.textContent =
      'A ' + f.period + 'ly budget for ' + budgetName(f) + ' already exists. Edit that one instead.';
    err.hidden = false;
    return;
  }
  const b = {
    id: f.id || uid(),
    categoryId: f.categoryId || null,
    period: f.period,
    amount: a,
    currency: f.currency,
  };
  const i = state.budgets.findIndex((x) => x.id === b.id);
  if (i >= 0) state.budgets[i] = b;
  else state.budgets.push(b);
  closeSheet();
  commit();
  toast(f.id ? 'Budget saved' : 'Budget added');
}
