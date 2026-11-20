/* Frata's accounts: the shared core in js/core/accounts.js, bound to the app's saved data. */
import * as core from './core/accounts.js';
import { state } from './state.js';

export { MAIN, MAX_ACCOUNTS, MAX_NAME } from './core/accounts.js';

/** Accounts that are in use: shown on Home and offered in pickers, main account first. */
export const accounts = () => core.accounts(state);

/** Accounts offered in a picker, plus `keep` if it's a removed account an entry being edited still uses. */
export const pickable = (keep) => core.pickable(state, keep);

export const accName = (id) => core.accName(state, id);

/** Savings accounts are added up as money set aside in the monthly report. */
export const isSavings = (id) => core.isSavings(state, id);

/** Another account in use than `id`, for example the other side of a new transfer. */
export const otherAccount = (id) => core.otherAccount(state, id);

/** Whether any entry uses the account, so removing it must keep its name for History. */
export const hasEntries = (id) => core.hasEntries(state, id);

/** Adds an account and returns its id, or null when the name is empty or there are too many. */
export const addAccount = (name) => core.addAccount(state, name);

/** Renames an account. An empty name is refused, so every account stays recognisable in History. */
export const renameAccount = (id, name) => core.renameAccount(state, id, name);

export const setSavings = (id, on) => core.setSavings(state, id, on);

/** Removes an account, moving any money left in it to the main account (see core/accounts.js). */
export const removeAccount = (id) => core.removeAccount(state, id);

/** Brings a removed account back, with its history. */
export const restoreAccount = (id) => core.restoreAccount(state, id);
