/* The event form: a camp or activity, its dates, budget and cotisation, and who attends. */
import { parseInput, toInput } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { amountField } from '../../../js/ui/amount.js';
import { esc, uid, ymd } from '../../../js/util.js';
import { state } from '../state.js';
import { armed } from '../ui/ui-state.js';

const CUR = [
  ['USD', 'USD'],
  ['LBP', 'LL'],
];

/* A currency switch for one of the form's two amounts: `act` tells events.js which one it changes. */
const curSeg = (act, cur) =>
  '<div class="seg cur" role="group" aria-label="Currency">' +
  CUR.map(
    ([k, l]) =>
      '<button data-act="' +
      act +
      '" data-v="' +
      k +
      '" aria-pressed="' +
      (cur === k) +
      '">' +
      l +
      '</button>',
  ).join('') +
  '</div>';

export function newEventForm() {
  return {
    mode: 'new',
    kind: 'event',
    name: '',
    start: ymd(new Date()),
    end: '',
    budget: '',
    cur: 'USD',
    cotisation: '',
    cotCur: 'USD',
    attendees: [],
  };
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
    cotisation: e.cotisation ? toInput(e.cotisation.amount, e.cotisation.currency) : '',
    cotCur: e.cotisation ? e.cotisation.currency : 'USD',
    attendees: (e.attendees || []).slice(),
    closed: !!e.closed,
  };
}

/* Cotisation payments already recorded for this event. */
const cotisationPayments = (id) => state.tx.filter((t) => t.feeId === id).length;

/* Members who can be ticked: everyone still in the unité, plus anyone who left but is already attending. */
const tickable = (f) => state.members.filter((m) => m.active || f.attendees.includes(m.id));

function attendeeList(f) {
  const people = tickable(f);
  return (
    '<div class="who-head"><p class="sub-label">Attending (' +
    f.attendees.length +
    ')</p>' +
    (people.length
      ? '<span class="links"><button class="link" data-act="attAll">Everyone</button><button class="link" data-act="attNone">No one</button></span>'
      : '') +
    '</div>' +
    (people.length
      ? '<div class="who">' +
        people
          .map(
            (m) =>
              '<label class="tick"><input type="checkbox" data-attendee="' +
              esc(m.id) +
              '"' +
              (f.attendees.includes(m.id) ? ' checked' : '') +
              '><span>' +
              esc(m.name) +
              (m.role === 'leader' ? ' <em>Leader</em>' : '') +
              '</span></label>',
          )
          .join('') +
        '</div>'
      : '<p class="note">Add members on the Members tab, then tick who attends.</p>')
  );
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
    '" placeholder="e.g. Camp HP, Camp Noël, Camp d’été"></label>' +
    '<div class="grid2"><label class="field"><span>Starts</span><input data-f="start" type="date" value="' +
    esc(f.start) +
    '"></label><label class="field"><span>Ends</span><input data-f="end" type="date" value="' +
    esc(f.end) +
    '"></label></div>' +
    '<p class="sub-label">Cotisation per attendee (optional)</p><div class="amount-row">' +
    amountField({
      id: 'f-cot',
      value: f.cotisation,
      cur: f.cotCur,
      label: 'Cotisation per attendee',
      attrs: ' data-f="cotisation"',
    }) +
    curSeg('fcotcur', f.cotCur) +
    '</div>' +
    '<p class="sub-label">Budget (optional)</p><div class="amount-row">' +
    amountField({ id: 'f-amount', value: f.budget, cur: f.cur, label: 'Budget', attrs: ' data-f="budget"' }) +
    curSeg('fcur', f.cur) +
    '</div>' +
    attendeeList(f) +
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

/* An optional amount: null when left empty, or an error when typed but not usable. */
function optionalAmount(text, cur, what) {
  if (!String(text).trim()) return { value: null };
  const amount = parseInput(text, cur);
  if (!(amount > 0) || !isFinite(amount))
    return { error: 'Enter ' + what + ' above zero, or leave it empty.' };
  return { value: { amount, currency: cur } };
}

/** Checks the form and builds the event. Returns { event } or { error }. */
export function buildEvent(f, old) {
  const name = f.name.trim().slice(0, 60);
  if (!name) return { error: 'Give the event a name.' };
  const start = /^\d{4}-\d{2}-\d{2}$/.test(f.start) ? f.start : '';
  const end = /^\d{4}-\d{2}-\d{2}$/.test(f.end) ? f.end : '';
  if (start && end && end < start) return { error: 'The end can’t be before the start.' };
  const cot = optionalAmount(f.cotisation, f.cotCur, 'a cotisation');
  if (cot.error) return { error: cot.error };
  // Payments recorded toward the cotisation need it to stay, or they'd lose what they were paying for.
  if (!cot.value && old && cotisationPayments(old.id))
    return { error: 'Cotisation payments are already recorded for this event, so it needs a cotisation.' };
  const budget = optionalAmount(f.budget, f.cur, 'a budget');
  if (budget.error) return { error: budget.error };
  return {
    event: Object.assign({}, old, {
      id: (old && old.id) || 'e' + uid(),
      name,
      start,
      end,
      budget: budget.value,
      cotisation: cot.value,
      attendees: f.attendees.filter((id) => state.members.some((m) => m.id === id)),
      closed: old ? !!old.closed : false,
      createdAt: (old && old.createdAt) || Date.now(),
    }),
  };
}
