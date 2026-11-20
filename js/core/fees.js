/* Members' fees (yearly dues, a camp fee): who has paid, who still owes. Pure: the state is passed in. */
import { entryValueIn } from './money.js';

/**
 * @typedef {object} Member
 * @property {string} id
 * @property {string} name
 * @property {'scout' | 'leader'} [role]
 * @property {string} [unit]
 * @property {boolean} [active]
 */
/**
 * @typedef {object} Fee
 * @property {string} id
 * @property {string} name
 * @property {number} amount        what each member owes, in `currency`
 * @property {import("./types.js").Cur} currency
 * @property {string} [due]         ymd, or ''
 * @property {string} [eventId]
 * @property {string[]} memberIds   who has to pay it
 */
/** @typedef {import("./types.js").CoreState & { members?: Member[], fees?: Fee[] }} FeeState */

/* Less than a cent, or less than 500 LL, still to pay counts as paid, as with paybacks. */
const settled = (/** @type {number} */ left, /** @type {string} */ cur) =>
  left < (cur === 'USD' ? 0.005 : 500);

/**
 * @param {FeeState} s
 * @param {string | undefined} id
 */
export const memberOf = (s, id) => (id ? (s.members || []).find((m) => m.id === id) : undefined);

/**
 * @param {FeeState} s
 * @param {string | undefined} id
 */
export const feeOf = (s, id) => (id ? (s.fees || []).find((f) => f.id === id) : undefined);

/**
 * Payments toward a fee: income entries linked to it, optionally from one member, oldest first.
 * @param {FeeState} s
 * @param {string} feeId
 * @param {string} [memberId]
 */
export const paymentsOf = (s, feeId, memberId) =>
  s.tx
    .filter(
      (t) =>
        t.type === 'income' &&
        /** @type {{ feeId?: string }} */ (t).feeId === feeId &&
        (!memberId || /** @type {{ memberId?: string }} */ (t).memberId === memberId),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));

/**
 * Where one member stands on one fee, in the fee's currency. A payment in the other currency counts at
 * the rate saved on it, so changing the app's rate never changes who has paid.
 * @param {FeeState} s
 * @param {Fee} fee
 * @param {string} memberId
 */
export function memberFeeStatus(s, fee, memberId) {
  const paid = paymentsOf(s, fee.id, memberId).reduce((n, t) => n + entryValueIn(t, fee.currency, s.rate), 0);
  const left = fee.amount - paid;
  const done = settled(left, fee.currency);
  return {
    memberId,
    paid,
    owed: done ? 0 : left,
    state: done ? 'paid' : paid > 0 ? 'part' : 'unpaid',
  };
}

/**
 * A fee's progress: each member's status, and the totals expected, collected and still owed, all in
 * the fee's currency. Paying more than the fee never makes another member's share look paid.
 * @param {FeeState} s
 * @param {Fee} fee
 */
export function feeStatus(s, fee) {
  const members = fee.memberIds.map((id) => memberFeeStatus(s, fee, id));
  const expected = fee.amount * members.length;
  const collected = members.reduce((n, m) => n + Math.min(m.paid, fee.amount), 0);
  const outstanding = members.reduce((n, m) => n + m.owed, 0);
  return {
    members,
    expected,
    collected,
    outstanding,
    paidCount: members.filter((m) => m.state === 'paid').length,
    pct: expected > 0 ? collected / expected : 0,
  };
}

/**
 * Every fee a member has to pay, with where they stand on each.
 * @param {FeeState} s
 * @param {string} memberId
 */
export const memberFees = (s, memberId) =>
  (s.fees || [])
    .filter((f) => f.memberIds.includes(memberId))
    .map((fee) => ({ fee, ...memberFeeStatus(s, fee, memberId) }));

/**
 * What is still owed on all fees, in USD at today's rate: it is money still to come in, so like a
 * balance it is valued now. Optionally for one member only.
 * @param {FeeState} s
 * @param {string} [memberId]
 */
export function outstandingUSD(s, memberId) {
  let usd = 0;
  for (const fee of s.fees || []) {
    for (const id of fee.memberIds) {
      if (memberId && id !== memberId) continue;
      const left = memberFeeStatus(s, fee, id).owed;
      usd += fee.currency === 'USD' ? left : left / s.rate;
    }
  }
  return usd;
}
