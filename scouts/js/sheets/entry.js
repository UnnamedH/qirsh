/* The entry form: an expense, income, a move between funds, or an exchange. */
import { accounts, pickable } from '../../../js/core/accounts.js';
import { eventOf, pickableEvents, withCotisations } from '../../../js/core/events.js';
import { feeOf, memberFeeStatus, memberOf } from '../../../js/core/fees.js';
import { other, parseInput, toInput } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { amountField } from '../../../js/ui/amount.js';
import { esc, uid, ymd } from '../../../js/util.js';
import { state } from '../state.js';
import { armed } from '../ui/ui-state.js';

const CUR = [
  ['USD', 'USD'],
  ['LBP', 'LL'],
];

/**
 * A blank form for a new entry of `type`: 'expense', 'income', 'transfer' or 'exchange'. `account` and
 * `eventId` preselect a fund and an event, when it is added from that fund's or event's page.
 */
export function newTxForm(type = 'expense', account = null, eventId = '') {
  const list = accounts(state);
  const from = account && list.some((a) => a.id === account) ? account : 'wallet';
  return {
    mode: 'new',
    kind: 'tx',
    type,
    amount: '',
    cur: 'USD',
    account: from,
    to: (list.find((a) => a.id !== from) || { id: from }).id,
    toAmount: '',
    categoryId: type === 'income' ? 'dues' : 'transport',
    eventId: eventOf(state, eventId) ? eventId : '',
    memberId: '',
    feeId: '',
    note: '',
    date: ymd(new Date()),
  };
}

/** A form filled in from a saved entry, for editing. */
export function formFromTx(t) {
  const exchange = t.type === 'transfer' && t.from === t.to;
  return {
    mode: 'edit',
    kind: 'tx',
    id: t.id,
    type: exchange ? 'exchange' : t.type,
    amount: toInput(t.amount, t.currency),
    cur: t.currency,
    account: t.type === 'transfer' ? t.from : t.account || 'wallet',
    to: t.to || 'wallet',
    toAmount: t.type === 'transfer' ? toInput(+t.toAmount, t.toCurrency || t.currency) : '',
    categoryId: t.categoryId || (t.type === 'income' ? 'other-in' : 'other'),
    eventId: t.eventId || '',
    memberId: t.memberId || '',
    feeId: t.feeId || '',
    note: t.note || '',
    date: t.date,
  };
}

const options = (list, value) =>
  list
    .map(
      (a) =>
        '<option value="' +
        esc(a.id) +
        '"' +
        (a.id === value ? ' selected' : '') +
        '>' +
        esc(a.name) +
        '</option>',
    )
    .join('');

/**
 * A payment toward a fee: income from the member, for what they still owe, in the fee's currency, in the
 * fee's event if it has one. The person can still change the amount, fund and date before saving.
 */
export function paymentForm(fee, memberId) {
  const f = newTxForm('income', null, fee.eventId || '');
  const left = memberFeeStatus(withCotisations(state), fee, memberId).owed;
  return Object.assign(f, {
    amount: left > 0 ? toInput(left, fee.currency) : '',
    cur: fee.currency,
    categoryId: state.categories.some((c) => c.id === 'dues') ? 'dues' : 'other-in',
    memberId,
    feeId: fee.id,
  });
}

/* Who paid in, and toward which of their fees. Offered on income once there are members. */
function memberPicker(f) {
  const people = state.members.filter((m) => m.active || m.id === f.memberId);
  if (!people.length) return '';
  let h =
    '<label class="field"><span>From member</span><select data-f="memberId"><option value="">None</option>' +
    options(people, f.memberId) +
    '</select></label>';
  const fees = withCotisations(state).fees.filter(
    (x) => f.memberId && (x.memberIds.includes(f.memberId) || x.id === f.feeId),
  );
  if (fees.length)
    h +=
      '<label class="field"><span>Cotisation for</span><select data-f="feeId"><option value="">None</option>' +
      options(fees, f.feeId) +
      '</select></label>';
  return h;
}

/* Which event or camp an expense or income belongs to. Offered once there is an event to pick. */
function eventPicker(f) {
  const list = pickableEvents(state, f.eventId);
  if (!list.length) return '';
  return (
    '<label class="field"><span>Event</span><select data-f="eventId"><option value="">None</option>' +
    options(list, f.eventId) +
    '</select></label>'
  );
}

export function txSheet(f) {
  const isMove = f.type === 'transfer',
    isX = f.type === 'exchange',
    cats = state.categories.filter((c) => c.type === (f.type === 'income' ? 'income' : 'expense'));
  let h =
    '<div class="sheet-head"><h2>' +
    (f.mode === 'edit' ? 'Edit entry' : 'New entry') +
    '</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>';
  h +=
    '<div class="seg wide">' +
    [
      ['expense', 'Expense'],
      ['income', 'Income'],
      ['transfer', 'Move'],
      ['exchange', 'Exchange'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="ftype" data-v="' +
          k +
          '" aria-pressed="' +
          (f.type === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div>';
  h +=
    '<div class="amount-row">' +
    amountField({
      id: 'f-amount',
      value: f.amount,
      cur: f.cur,
      label: isX ? 'Amount you give' : 'Amount',
      attrs: ' data-f="amount"',
    }) +
    '<div class="seg cur" role="group" aria-label="Currency">' +
    CUR.map(
      ([k, l]) =>
        '<button data-act="fcur" data-v="' + k + '" aria-pressed="' + (f.cur === k) + '">' + l + '</button>',
    ).join('') +
    '</div></div>';
  if (isX) {
    const gc = other(f.cur);
    h +=
      '<div class="sub-lines"><span class="sub-label">You get</span><div class="amount-row">' +
      amountField({
        id: 'f-toamount',
        value: f.toAmount,
        cur: gc,
        label: 'Amount received in ' + (gc === 'USD' ? 'USD' : 'LL'),
        attrs: ' data-f="toAmount"',
      }) +
      '<span class="cur-tag">' +
      (gc === 'USD' ? 'USD' : 'LL') +
      '</span></div></div>';
  }
  if (isMove)
    h +=
      '<div class="grid2"><label class="field"><span>From</span><select data-f="account">' +
      options(pickable(state, f.account), f.account) +
      '</select></label><label class="field"><span>To</span><select data-f="to">' +
      options(pickable(state, f.to), f.to) +
      '</select></label></div>';
  else
    h +=
      '<label class="field"><span>' +
      (isX ? 'Fund' : f.type === 'income' ? 'Paid into' : 'Paid from') +
      '</span><select data-f="account">' +
      options(pickable(state, f.account), f.account) +
      '</select></label>';
  if (!isMove && !isX)
    h +=
      '<label class="field"><span>Category</span><select data-f="categoryId">' +
      options(cats, f.categoryId) +
      '</select></label>' +
      (f.type === 'income' ? memberPicker(f) : '') +
      eventPicker(f);
  h +=
    '<div class="grid2"><label class="field"><span>Note</span><input data-f="note" autocomplete="off" value="' +
    esc(f.note) +
    '" placeholder="Optional"></label><label class="field"><span>Date</span><input data-f="date" type="date" value="' +
    esc(f.date) +
    '"></label></div>';
  h +=
    '<p class="form-error" id="f-err" hidden></p><div class="sheet-actions">' +
    (f.mode === 'edit'
      ? '<button class="btn danger' +
        (armed === 'tx' ? ' armed' : '') +
        '" data-act="fdel">' +
        (armed === 'tx' ? 'Tap to confirm' : 'Delete') +
        '</button>'
      : '') +
    '<button class="btn primary" data-act="fsave">' +
    (f.mode === 'edit' ? 'Save changes' : 'Add') +
    '</button></div>';
  return h;
}

/**
 * Checks the form and builds the entry it describes. Returns { tx } or { error }. An edited entry keeps
 * its id, its creation time, its rate and any links to events or members.
 */
export function buildTx(f, old) {
  const amount = parseInput(f.amount, f.cur);
  if (!(amount > 0) || !isFinite(amount)) return { error: 'Enter an amount above zero.' };
  if (!state.accounts.some((a) => a.id === f.account)) return { error: 'Pick a fund.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return { error: 'Pick a date.' };
  const t = Object.assign({}, old, {
    id: (old && old.id) || uid(),
    createdAt: (old && old.createdAt) || Date.now(),
    date: f.date,
    amount,
    currency: f.cur,
    note: f.note.trim().slice(0, 200),
  });
  ['categoryId', 'account', 'from', 'to', 'toAmount', 'toCurrency', 'rate'].forEach((k) => {
    if (!old || old.type !== f.type) delete t[k];
  });
  if (f.type === 'expense' || f.type === 'income') {
    t.type = f.type;
    t.account = f.account;
    t.categoryId = f.categoryId;
    t.rate = (old && +old.rate > 0 && old.rate) || state.rate;
    if (f.eventId && eventOf(state, f.eventId)) t.eventId = f.eventId;
    else delete t.eventId;
    // Only money coming in is a member's payment.
    const member = f.type === 'income' ? memberOf(state, f.memberId) : undefined;
    const fee = member ? feeOf(withCotisations(state), f.feeId) : undefined;
    if (member) t.memberId = member.id;
    else delete t.memberId;
    if (fee) t.feeId = fee.id;
    else delete t.feeId;
    delete t.from;
    delete t.to;
    delete t.toAmount;
    delete t.toCurrency;
    return { tx: t };
  }
  t.type = 'transfer';
  // Moving money between funds isn't spending or a payment, so it never belongs to an event or a member.
  delete t.eventId;
  delete t.memberId;
  delete t.feeId;
  delete t.account;
  delete t.categoryId;
  delete t.rate;
  t.from = f.account;
  if (f.type === 'transfer') {
    if (f.to === f.account || !state.accounts.some((a) => a.id === f.to))
      return { error: 'Pick two different funds.' };
    t.to = f.to;
    t.toCurrency = f.cur;
    t.toAmount = amount;
  } else {
    const got = parseInput(f.toAmount, other(f.cur));
    if (!(got > 0) || !isFinite(got)) return { error: 'Enter what you get.' };
    t.to = f.account;
    t.toCurrency = other(f.cur);
    t.toAmount = got;
  }
  return { tx: t };
}
