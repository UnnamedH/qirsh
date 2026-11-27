/* Account balances, spending totals and budget progress. Pure: the state is passed in. */
import { leftIn } from './advances.js';
import { backVec, entryValueIn, payVec } from './money.js';
import { addDays, parseYmd, startOfDay } from '../util.js';

/**
 * @param {import("./types.js").CoreState} state
 * @returns {Record<string, import("./types.js").Vec>}
 */
export function balances(state) {
  /** @type {Record<string, import("./types.js").Vec>} */
  const b = {};
  state.accounts.forEach((a) => {
    const o = state.opening[a.id] || {};
    b[a.id] = { USD: +o.USD || 0, LBP: +o.LBP || 0 };
  });
  const acc = (/** @type {string} */ id) => (b[id] = b[id] || { USD: 0, LBP: 0 });
  for (const t of state.tx) {
    if (t.type === 'expense' || t.type === 'income' || t.type === 'advance' || t.type === 'repay') {
      const a = acc(t.account || 'wallet'),
        p = payVec(t),
        sg = t.type === 'expense' || t.type === 'advance' ? -1 : 1;
      a.USD += sg * p.USD;
      a.LBP += sg * p.LBP;
      if (t.type === 'expense') {
        const k = backVec(t);
        a.USD += k.USD;
        a.LBP += k.LBP;
      }
    } else if (t.type === 'adjust') {
      // A balance correction: amount is the signed difference, not spending or income.
      acc(t.account || 'wallet')[t.currency] += t.amount;
    } else if (t.type === 'transfer') {
      // normalize() keeps the funds a transfer names, so from and to are always set; String() only
      // spells out what an object key does anyway.
      acc(String(t.from))[t.currency] -= t.amount;
      acc(String(t.to))[t.toCurrency || t.currency] += t.toAmount != null ? +t.toAmount : t.amount;
    }
  }
  return b;
}

/**
 * @param {import("./types.js").Vec} x
 * @param {number} rate
 */
export const combinedUSD = (x, rate) => x.USD + x.LBP / rate;

/**
 * @param {string} period
 * @param {Date} [ref]
 * @param {number} [weekStart]
 * @returns {import("./types.js").Range}
 */
export function range(period, ref, weekStart = 1) {
  const d = startOfDay(ref || new Date());
  if (period === 'month')
    return {
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
    };
  const back = (d.getDay() - weekStart + 7) % 7;
  const start = addDays(d, -back);
  return { start, end: addDays(start, 7) };
}

/**
 * @param {{ date: string }} t
 * @param {import("./types.js").Range} r
 */
export const inRange = (t, r) => {
  const d = parseYmd(t.date);
  return d >= r.start && d < r.end;
};

/**
 * Total spending ('expense') or income ('income') in a date range, optionally for some categories, in
 * `cur`. Each entry counts at the rate saved on it, so the total doesn't move when the app's rate does.
 * Spending includes the part of a closed advance that was never paid back.
 * @param {import("./types.js").CoreState} state
 * @param {import("./types.js").Range} r
 * @param {string} type
 * @param {string | string[] | null | undefined} catId one category, several, or none for all of them
 * @param {string} cur
 * @param {string | null} [account]
 * @returns {number}
 */
export function sumIn(state, r, type, catId, cur, account) {
  const cats = catId == null ? null : Array.isArray(catId) ? (catId.length ? catId : null) : [catId];
  let s = 0;
  for (const t of state.tx) {
    if (account && (t.account || 'wallet') !== account) continue;
    if (type === 'expense' && t.type === 'advance') {
      if (
        t.closed &&
        t.keptCat &&
        (!cats || cats.includes(t.keptCat)) &&
        inRange({ date: t.closedOn || t.date }, r)
      )
        s += leftIn(state, t, cur);
      continue;
    }
    if (t.type !== type) continue;
    if (cats && !cats.includes(t.categoryId || '')) continue;
    if (!inRange(t, r)) continue;
    s += entryValueIn(t, cur, state.rate);
  }
  return s;
}

/**
 * @param {import("./types.js").CoreState} state
 * @param {import("./types.js").Range} r
 * @param {string} type
 * @param {string | null} [catId]
 */
export const sumUSD = (state, r, type, catId) => sumIn(state, r, type, catId, 'USD');

/**
 * A budget's progress, in the budget's own currency, so an LL budget counts LL spending exactly.
 * @param {import("./types.js").CoreState} state
 * @param {import("./types.js").Budget} b
 */
export function budgetStatus(state, b) {
  const r = range(b.period, undefined, state.settings.weekStart);
  const spent = sumIn(state, r, 'expense', budgetCats(b), b.currency);
  const limit = +b.amount;
  const pct = limit > 0 ? spent / limit : 0;
  const daysLeft = Math.max(1, Math.round((r.end.getTime() - startOfDay(new Date()).getTime()) / 864e5));
  return {
    spent,
    limit,
    pct,
    left: limit - spent,
    daysLeft,
    state: pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok',
  };
}

/**
 * A range's spending split by category, biggest first, in `cur` and each entry at its own rate, like
 * sumIn. Spending in no known category (for example a deleted one) is grouped as `id: null`.
 * @param {import("./types.js").CoreState} state
 * @param {import("./types.js").Range} r
 * @param {string} cur
 * @param {string | null} [account]
 * @returns {{ id: string | null, total: number }[]}
 */
export function spendByCategory(state, r, cur, account) {
  const known = state.categories.filter((c) => c.type !== 'income');
  const parts = known
    .map((c) => ({
      id: /** @type {string | null} */ (c.id),
      total: sumIn(state, r, 'expense', c.id, cur, account),
    }))
    .filter((x) => x.total > 0.005);
  const rest = sumIn(state, r, 'expense', null, cur, account) - parts.reduce((s, x) => s + x.total, 0);
  if (rest > 0.005) parts.push({ id: null, total: rest });
  return parts.sort((a, b) => b.total - a.total);
}

/**
 * @param {import("./types.js").CoreState} state
 * @param {string | undefined} id
 */
export const catOf = (state, id) => state.categories.find((c) => c.id === id);

/**
 * @param {import("./types.js").CoreState} state
 * @param {string | undefined} id
 * @returns {string}
 */
export const catName = (state, id) => (catOf(state, id) || { name: 'Uncategorised' }).name;

/**
 * The categories a budget covers; empty means all spending. Reads the older single `categoryId` too.
 * @param {import("./types.js").Budget} b
 * @returns {string[]}
 */
export const budgetCats = (b) =>
  Array.isArray(b.categoryIds) ? b.categoryIds : b.categoryId ? [b.categoryId] : [];

/**
 * "All spending", one category's name, two joined with "and", or the first two and how many more.
 * @param {import("./types.js").CoreState} state
 * @param {import("./types.js").Budget} b
 */
export const budgetName = (state, b) => {
  const names = budgetCats(b).map((id) => catName(state, id));
  if (!names.length) return 'All spending';
  if (names.length <= 2) return names.join(' and ');
  return names.slice(0, 2).join(', ') + ' and ' + (names.length - 2) + ' more';
};
