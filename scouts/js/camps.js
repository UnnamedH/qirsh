/* Each camp has its own account: its cotisations go in, its expenses come out. Finishing a camp moves
   what is left back to the caisse; reopening it brings the account back. */
import { MAIN } from '../../js/core/accounts.js';
import { balances } from '../../js/core/ledger.js';
import { uid, ymd } from '../../js/util.js';

/** The ids of every camp's account, so the caisse can leave them out. */
export const campAccountIds = (s) => new Set(s.events.map((e) => e.accountId).filter(Boolean));

/** Whether any entry uses a camp's account, so deleting the camp would lose track of that money. */
export const campAccountUsed = (s, e) =>
  !!e.accountId &&
  s.tx.some((t) => t.account === e.accountId || t.from === e.accountId || t.to === e.accountId);

/** The camp an account belongs to, if it is a camp's. */
export const campOfAccount = (s, accountId) => s.events.find((e) => e.accountId === accountId);

/**
 * Gives a camp its account if it has none (a new camp, or one from before camps had accounts), and keeps
 * the account's name the camp's. The id follows from the camp's, so doing it again finds the same one.
 */
export function ensureCampAccount(s, e) {
  let a = e.accountId && s.accounts.find((x) => x.id === e.accountId);
  if (!a) {
    const id = 'camp-' + e.id;
    a = s.accounts.find((x) => x.id === id);
    if (!a) {
      a = { id, name: e.name };
      s.accounts.push(a);
    }
    e.accountId = id;
  }
  if (!s.opening[a.id]) s.opening[a.id] = { USD: 0, LBP: 0 };
  a.name = e.name.slice(0, 30);
  return a;
}

/**
 * Marks a camp finished. Money left in its account goes back to the main fund (the caisse), one transfer
 * per currency, so the camp's balance ends at zero and nothing goes missing; an overdrawn camp is topped
 * up from the caisse instead. The account is then hidden, keeping its name for History.
 */
export function finishCamp(s, e) {
  e.closed = true;
  const a = e.accountId && s.accounts.find((x) => x.id === e.accountId);
  if (!a) return [];
  const b = balances(s)[a.id] || { USD: 0, LBP: 0 };
  const moved = [];
  ['USD', 'LBP'].forEach((cur) => {
    const left = Math.round(b[cur] * 100) / 100;
    if (!left) return;
    const t = {
      id: uid(),
      type: 'transfer',
      date: ymd(new Date()),
      createdAt: Date.now(),
      amount: Math.abs(left),
      currency: cur,
      toCurrency: cur,
      toAmount: Math.abs(left),
      from: left > 0 ? a.id : MAIN,
      to: left > 0 ? MAIN : a.id,
      note: e.name + ' finished',
    };
    s.tx.push(t);
    moved.push(t);
  });
  a.hidden = true;
  return moved;
}

/** Reopens a finished camp, with its account. */
export function reopenCamp(s, e) {
  e.closed = false;
  const a = ensureCampAccount(s, e);
  delete a.hidden;
}
