/* Frata's ledger: the shared core in js/core/ledger.js, bound to the app's saved data. */
import * as core from './core/ledger.js';
import * as trends from './core/trends.js';
import { state } from './state.js';

export { inRange } from './core/ledger.js';

export const balances = () => core.balances(state);

export const combinedUSD = (x) => core.combinedUSD(x, state.rate);

export const range = (period, ref) => core.range(period, ref, state.settings.weekStart);

/**
 * Total spending ('expense') or income ('income') in a date range, optionally for one category, in
 * `cur`. Each entry counts at the rate saved on it, so the total doesn't move when the app's rate does.
 */
export const sumIn = (r, type, catId, cur, account) => core.sumIn(state, r, type, catId, cur, account);

export const sumUSD = (r, type, catId) => core.sumUSD(state, r, type, catId);

/** A budget's progress, in the budget's own currency, so an LL budget counts LL spending exactly. */
export const budgetStatus = (b) => core.budgetStatus(state, b);

export const catOf = (id) => core.catOf(state, id);

export const catName = (id) => core.catName(state, id);

export const budgetName = (b) => core.budgetName(state, b);

/** A range's spending by category, biggest first (see core). */
export const spendByCategory = (r, cur, account) => core.spendByCategory(state, r, cur, account);

/** The categories a budget covers; empty means all spending. */
export const budgetCats = (b) => core.budgetCats(b);

/** Month-by-month spending ending with `endMonth`, and the month against the one before it (see core/trends.js). */
export const monthlyTrend = (endMonth, n, cur, opts) =>
  trends.monthlyTrend(state, endMonth, n, cur, new Date(), opts);

export const compareMonth = (month, cur, opts) => trends.compareMonth(state, month, new Date(), cur, opts);
