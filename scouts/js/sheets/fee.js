/* The fee form: what each member owes (yearly dues, a camp fee), by when, and who has to pay it. */
import { pickableEvents } from '../../../js/core/events.js';
import { parseInput, toInput } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { amountField } from '../../../js/ui/amount.js';
import { esc, uid } from '../../../js/util.js';
import { state } from '../state.js';
import { armed } from '../ui/ui-state.js';

/* New fees are for everyone still in the group; people can untick who doesn't pay. */
export function newFeeForm() {
  return {
    mode: 'new',
    kind: 'fee',
    name: '',
    amount: '',
    cur: 'USD',
    due: '',
    eventId: '',
    memberIds: state.members.filter((m) => m.active).map((m) => m.id),
  };
}

export function formFromFee(f) {
  return {
    mode: 'edit',
    kind: 'fee',
    id: f.id,
    name: f.name,
    amount: toInput(f.amount, f.currency),
    cur: f.currency,
    due: f.due || '',
    eventId: f.eventId || '',
    memberIds: f.memberIds.slice(),
  };
}

/* Members who can be ticked: everyone still in the group, plus anyone who left but is already on the fee. */
const tickable = (f) => state.members.filter((m) => m.active || f.memberIds.includes(m.id));

export function feeSheet(f) {
  const people = tickable(f),
    events = pickableEvents(state, f.eventId),
    paid = f.id ? state.tx.filter((t) => t.feeId === f.id).length : 0;
  return (
    '<div class="sheet-head"><h2>' +
    (f.mode === 'edit' ? 'Edit fee' : 'New fee') +
    '</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>' +
    '<label class="field"><span>Name</span><input id="f-name" data-f="name" maxlength="60" autocomplete="off" value="' +
    esc(f.name) +
    '" placeholder="e.g. Dues 2026, Summer camp fee"></label>' +
    '<p class="sub-label">Each member pays</p><div class="amount-row">' +
    amountField({
      id: 'f-amount',
      value: f.amount,
      cur: f.cur,
      label: 'Amount each member pays',
      attrs: ' data-f="amount"',
    }) +
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
    '<div class="grid2"><label class="field"><span>Due by (optional)</span><input data-f="due" type="date" value="' +
    esc(f.due) +
    '"></label>' +
    (events.length
      ? '<label class="field"><span>Event (optional)</span><select data-f="eventId"><option value="">None</option>' +
        events
          .map(
            (e) =>
              '<option value="' +
              esc(e.id) +
              '"' +
              (e.id === f.eventId ? ' selected' : '') +
              '>' +
              esc(e.name) +
              '</option>',
          )
          .join('') +
        '</select></label>'
      : '') +
    '</div>' +
    '<div class="who-head"><p class="sub-label">Who pays (' +
    f.memberIds.length +
    ')</p>' +
    (people.length
      ? '<span class="links"><button class="link" data-act="feeAll">Everyone</button><button class="link" data-act="feeNone">No one</button></span>'
      : '') +
    '</div>' +
    (people.length
      ? '<div class="who">' +
        people
          .map(
            (m) =>
              '<label class="tick"><input type="checkbox" data-feemember="' +
              esc(m.id) +
              '"' +
              (f.memberIds.includes(m.id) ? ' checked' : '') +
              '><span>' +
              esc(m.name) +
              (m.unit ? ' <em>' + esc(m.unit) + '</em>' : '') +
              '</span></label>',
          )
          .join('') +
        '</div>'
      : '<p class="note">Add members on the Members tab first; then tick who pays this fee.</p>') +
    (f.mode === 'edit' && paid
      ? '<p class="note">' +
        paid +
        (paid === 1 ? ' payment was' : ' payments were') +
        ' made toward this fee. Deleting it keeps them as ordinary income.</p>'
      : '') +
    '<p class="form-error" id="f-err" hidden></p><div class="sheet-actions">' +
    (f.mode === 'edit'
      ? '<button class="btn danger' +
        (armed === 'tx' ? ' armed' : '') +
        '" data-act="fdel">' +
        (armed === 'tx' ? 'Tap to confirm' : 'Delete') +
        '</button>'
      : '') +
    '<button class="btn primary" data-act="fsave">' +
    (f.mode === 'edit' ? 'Save changes' : 'Add fee') +
    '</button></div>'
  );
}

export function buildFee(f, old) {
  const name = f.name.trim().slice(0, 60);
  if (!name) return { error: 'Give the fee a name.' };
  const amount = parseInput(f.amount, f.cur);
  if (!(amount > 0) || !isFinite(amount)) return { error: 'Enter what each member pays.' };
  const fee = Object.assign({}, old, {
    id: (old && old.id) || 'f' + uid(),
    name,
    amount,
    currency: f.cur,
    due: /^\d{4}-\d{2}-\d{2}$/.test(f.due) ? f.due : '',
    memberIds: f.memberIds.filter((id) => state.members.some((m) => m.id === id)),
    createdAt: (old && old.createdAt) || Date.now(),
  });
  if (f.eventId && state.events.some((e) => e.id === f.eventId)) fee.eventId = f.eventId;
  else delete fee.eventId;
  return { fee };
}
