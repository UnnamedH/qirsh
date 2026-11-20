/* The person's accounts: the main one (Wallet, always there) plus any they add, rename or remove.
   Pure: the state is passed in. */
import { balances } from './ledger.js';
import { uid, ymd } from '../util.js';

/* The main account: new entries, exchanges and paybacks use it unless told otherwise. It can be
   renamed but never removed. */
export const MAIN = 'wallet';

/* Enough for every wallet, bank and app someone might use, without Home becoming a list. */
export const MAX_ACCOUNTS = 12;
export const MAX_NAME = 30;

/**
 * Accounts that are in use: shown on Home and offered in pickers, main account first.
 * @param {import("./types.js").CoreState} state
 */
export const accounts = (state) => state.accounts.filter((a) => !a.hidden);

/**
 * Accounts offered in a picker, plus `keep` if it's a removed account an entry being edited still uses.
 * @param {import("./types.js").CoreState} state
 * @param {string} [keep]
 */
export const pickable = (state, keep) => state.accounts.filter((a) => !a.hidden || a.id === keep);

/**
 * @param {import("./types.js").CoreState} state
 * @param {string} id
 * @returns {string}
 */
export const accName = (state, id) => (state.accounts.find((a) => a.id === id) || { name: id }).name;

/**
 * Savings accounts are added up as money set aside in the monthly report.
 * @param {import("./types.js").CoreState} state
 * @param {string} id
 */
export const isSavings = (state, id) => !!(state.accounts.find((a) => a.id === id) || {}).savings;

/**
 * Another account in use than `id`, for example the other side of a new transfer.
 * @param {import("./types.js").CoreState} state
 * @param {string} id
 * @returns {string}
 */
export const otherAccount = (state, id) => (accounts(state).find((a) => a.id !== id) || { id: MAIN }).id;

/**
 * Whether any entry uses the account, so removing it must keep its name for History.
 * @param {import("./types.js").CoreState} state
 * @param {string} id
 */
export const hasEntries = (state, id) =>
  state.tx.some((t) => t.account === id || t.from === id || t.to === id || (id === MAIN && !t.account));

/**
 * @param {unknown} name
 */
const cleanName = (name) =>
  String(name || '')
    .trim()
    .slice(0, MAX_NAME);

/**
 * Adds an account and returns its id, or null when the name is empty or there are too many.
 * @param {import("./types.js").CoreState} state
 * @param {unknown} name
 * @returns {string | null}
 */
export function addAccount(state, name) {
  const n = cleanName(name);
  if (!n || accounts(state).length >= MAX_ACCOUNTS) return null;
  const id = 'a' + uid();
  state.accounts.push({ id, name: n });
  state.opening[id] = { USD: 0, LBP: 0 };
  return id;
}

/**
 * Renames an account. An empty name is refused, so every account stays recognisable in History.
 * @param {import("./types.js").CoreState} state
 * @param {string} id
 * @param {unknown} name
 */
export function renameAccount(state, id, name) {
  const a = state.accounts.find((x) => x.id === id),
    n = cleanName(name);
  if (!a || !n) return false;
  a.name = n;
  return true;
}

/**
 * @param {import("./types.js").CoreState} state
 * @param {string} id
 * @param {boolean} on
 */
export function setSavings(state, id, on) {
  const a = state.accounts.find((x) => x.id === id);
  if (a && id !== MAIN) a.savings = !!on;
}

/**
 * Removes an account. Money still in it is moved to the main account first, with a transfer per
 * currency, so no balance disappears. An account that was ever used is only hidden: its entries keep
 * its name and past months keep their totals. One never used is deleted outright.
 * @param {import("./types.js").CoreState} state
 * @param {string} id
 */
export function removeAccount(state, id) {
  const a = state.accounts.find((x) => x.id === id);
  if (!a || id === MAIN) return false;
  const b = balances(state)[id] || { USD: 0, LBP: 0 };
  /** @type {import("./types.js").Cur[]} */ (['USD', 'LBP']).forEach((cur) => {
    const left = Math.round(b[cur] * 100) / 100;
    if (!left) return;
    // An overdrawn account is topped back up to zero from the main account instead.
    state.tx.push({
      id: uid(),
      type: 'transfer',
      date: ymd(new Date()),
      createdAt: Date.now(),
      amount: Math.abs(left),
      currency: cur,
      from: left > 0 ? id : MAIN,
      to: left > 0 ? MAIN : id,
      note: a.name + ' removed',
    });
  });
  if (hasEntries(state, id)) a.hidden = true;
  else {
    state.accounts = state.accounts.filter((x) => x.id !== id);
    delete state.opening[id];
  }
  return true;
}

/**
 * Brings a removed account back, with its history.
 * @param {import("./types.js").CoreState} state
 * @param {string} id
 */
export function restoreAccount(state, id) {
  const a = state.accounts.find((x) => x.id === id);
  if (!a || accounts(state).length >= MAX_ACCOUNTS) return false;
  delete a.hidden;
  return true;
}
