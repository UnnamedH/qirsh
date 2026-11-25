/* Sheet for adding and editing budgets. */
import { ICON } from '../icons.js';
import { budgetCats, budgetName } from '../ledger.js';
import { parseInput } from '../money.js';
import { hasPlus } from '../plus.js';
import { amountField } from '../ui/amount.js';
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
  // Any number of categories; none picked means all spending (an overall cap).
  const picked = f.categoryIds || [];
  h +=
    '<div class="field"><span>Applies to</span><div class="chips" role="group" aria-label="Categories">' +
    '<button class="chip" data-act="bcatAll" aria-pressed="' +
    !picked.length +
    '">All spending</button>' +
    cats
      .map(
        (c) =>
          '<button class="chip" data-act="bcat" data-v="' +
          esc(c.id) +
          '" aria-pressed="' +
          picked.includes(c.id) +
          '">' +
          (c.icon ? esc(c.icon) + ' ' : '') +
          esc(c.name) +
          '</button>',
      )
      .join('') +
    '</div>' +
    (hasPlus()
      ? ''
      : '<p class="note">Picking several categories at once is part of Frata Plus. ' +
        '<button class="link" data-act="plusOpen">Get Frata Plus</button></p>') +
    '</div>';
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
    '<div class="amount-row">' +
    amountField({ id: 'b-amount', value: f.amount, cur: f.currency, label: 'Limit' }) +
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
  const a = $('#b-amount');
  if (a) form.amount = a.value;
}

/** Picks or unpicks a category for the budget being edited. Without Plus, picking one replaces the rest. */
export function toggleBudgetCat(id) {
  const ids = form.categoryIds || [];
  if (ids.includes(id)) form.categoryIds = ids.filter((x) => x !== id);
  else form.categoryIds = hasPlus() ? [...ids, id] : [id];
}

/* Two budgets for the same categories and period would count the same spending twice. */
const sameCats = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

export function saveBudget() {
  readBudget();
  const f = form;
  const a = parseInput(f.amount, f.currency);
  const err = $('#b-err');
  if (!(a > 0)) {
    err.textContent = 'Enter a limit above zero.';
    err.hidden = false;
    return;
  }
  const ids = f.categoryIds || [];
  const dup = state.budgets.find(
    (b) => b.id !== f.id && sameCats(budgetCats(b), ids) && b.period === f.period,
  );
  if (dup) {
    err.textContent =
      'A ' +
      f.period +
      'ly budget for ' +
      budgetName({ categoryIds: ids }) +
      ' already exists. Edit that one instead.';
    err.hidden = false;
    return;
  }
  const b = {
    id: f.id || uid(),
    categoryIds: ids,
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
