/* The event form: a camp, outing or activity with optional dates and budget. */
import { parseInput, toInput } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { amountField } from '../../../js/ui/amount.js';
import { esc, uid, ymd } from '../../../js/util.js';
import { state } from '../state.js';
import { armed } from '../ui/ui-state.js';

export function newEventForm() {
  return { mode: 'new', kind: 'event', name: '', start: ymd(new Date()), end: '', budget: '', cur: 'USD' };
}

export function formFromEvent(e) {
  return {
    mode: 'edit',
    kind: 'event',
    id: e.id,
    name: e.name,
    start: e.start || '',
    end: e.end || '',
    budget: e.budget ? toInput(e.budget.amount, e.budget.currency) : '',
    cur: e.budget ? e.budget.currency : 'USD',
    closed: !!e.closed,
  };
}

export function eventSheet(f) {
  const used = f.id ? state.tx.filter((t) => t.eventId === f.id).length : 0;
  return (
    '<div class="sheet-head"><h2>' +
    (f.mode === 'edit' ? 'Edit event' : 'New event') +
    '</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>' +
    '<label class="field"><span>Name</span><input id="f-name" data-f="name" maxlength="60" autocomplete="off" value="' +
    esc(f.name) +
    '" placeholder="e.g. Summer camp 2026"></label>' +
    '<div class="grid2"><label class="field"><span>Starts</span><input data-f="start" type="date" value="' +
    esc(f.start) +
    '"></label><label class="field"><span>Ends</span><input data-f="end" type="date" value="' +
    esc(f.end) +
    '"></label></div>' +
    '<p class="sub-label">Budget (optional)</p><div class="amount-row">' +
    amountField({ id: 'f-amount', value: f.budget, cur: f.cur, label: 'Budget', attrs: ' data-f="budget"' }) +
    '<div class="seg cur" role="group" aria-label="Currency">' +
    [
      ['USD', 'USD'],
      ['LBP', 'LL'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="fcur" data-v="' +
          k +
          '" aria-pressed="' +
          (f.cur === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div></div>' +
    (f.mode === 'edit'
      ? '<p class="note">' +
        (used
          ? used +
            (used === 1 ? ' entry belongs' : ' entries belong') +
            ' to this event. Deleting the event keeps them as ordinary entries.'
          : 'No entries belong to this event yet.') +
        '</p>'
      : '') +
    '<p class="form-error" id="f-err" hidden></p><div class="sheet-actions">' +
    (f.mode === 'edit'
      ? '<button class="btn danger' +
        (armed === 'tx' ? ' armed' : '') +
        '" data-act="fdel">' +
        (armed === 'tx' ? 'Tap to confirm' : 'Delete') +
        '</button><button class="btn" data-act="eventClose">' +
        (f.closed ? 'Reopen' : 'Mark finished') +
        '</button>'
      : '') +
    '<button class="btn primary" data-act="fsave">' +
    (f.mode === 'edit' ? 'Save changes' : 'Add event') +
    '</button></div>'
  );
}

/** Checks the form and builds the event. Returns { event } or { error }. */
export function buildEvent(f, old) {
  const name = f.name.trim().slice(0, 60);
  if (!name) return { error: 'Give the event a name.' };
  const start = /^\d{4}-\d{2}-\d{2}$/.test(f.start) ? f.start : '';
  const end = /^\d{4}-\d{2}-\d{2}$/.test(f.end) ? f.end : '';
  if (start && end && end < start) return { error: 'The end can’t be before the start.' };
  let budget = null;
  if (String(f.budget).trim()) {
    const amount = parseInput(f.budget, f.cur);
    if (!(amount > 0) || !isFinite(amount)) return { error: 'Enter a budget above zero, or leave it empty.' };
    budget = { amount, currency: f.cur };
  }
  return {
    event: Object.assign({}, old, {
      id: (old && old.id) || 'e' + uid(),
      name,
      start,
      end,
      budget,
      closed: old ? !!old.closed : false,
      createdAt: (old && old.createdAt) || Date.now(),
    }),
  };
}
