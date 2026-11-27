/* Spending month by month, and this month against last. Pure: the state and today's date are passed in. */
import { addDays, parseYmd, startOfDay } from '../util.js';
import { spendByCategory, sumIn } from './ledger.js';

/** @typedef {{ start: Date, spent: number, earned: number | null, partial: boolean, empty: boolean }} TrendMonth */

const monthStart = (/** @type {Date} */ d) => new Date(d.getFullYear(), d.getMonth(), 1);

/**
 * `n` months ending with the month of `endMonth`, oldest first, in `cur`. Each entry counts at its own rate,
 * so a past month never moves when the app's rate does. The month `today` is in is still going on, so it's
 * marked `partial`; months before the first entry, and after today's month, are `empty`. The average leaves
 * both out, so neither a half-finished month nor a month before Frata was used drags it down.
 * @param {import("./types.js").CoreState} state
 * @param {Date} endMonth
 * @param {number} n
 * @param {string} cur
 * @param {Date} today
 * @param {{ catId?: string | null, account?: string | null }} [opts] one category, and/or one account
 * @returns {{ months: TrendMonth[], average: number | null }}
 */
export function monthlyTrend(state, endMonth, n, cur, today, opts = {}) {
  const now = monthStart(today).getTime();
  let first = Infinity;
  for (const t of state.tx) {
    const d = parseYmd(t.date).getTime();
    if (d < first) first = d;
  }
  const firstMonth = isFinite(first) ? monthStart(new Date(first)).getTime() : Infinity;
  /** @type {TrendMonth[]} */
  const months = [];
  for (let i = 0; i < n; i++) {
    const start = new Date(endMonth.getFullYear(), endMonth.getMonth() - (n - 1 - i), 1);
    const r = { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
    const at = start.getTime();
    months.push({
      start,
      spent: sumIn(state, r, 'expense', opts.catId || null, cur, opts.account || undefined),
      // Income has its own categories, so it says nothing about one spending category.
      earned: opts.catId ? null : sumIn(state, r, 'income', null, cur, opts.account || undefined),
      partial: at === now,
      empty: at < firstMonth || at > now,
    });
  }
  const full = months.filter((m) => !m.partial && !m.empty);
  return { months, average: full.length ? full.reduce((s, m) => s + m.spent, 0) / full.length : null };
}

/**
 * The month shown against the one before it. For the month still going on, that's the days so far against
 * the same days of last month, so half a month isn't set beside a whole one. `changes` are the categories
 * that moved most, biggest move first.
 * @param {import("./types.js").CoreState} state
 * @param {Date} month first day of the month shown
 * @param {Date} today
 * @param {string} cur
 * @param {{ account?: string | null, catId?: string | null }} [opts] one account and/or one category (then there are no `changes`)
 * @returns {{ partial: boolean, day: number, now: number, before: number, changes: { id: string | null, now: number, before: number }[] }}
 */
export function compareMonth(state, month, today, cur, opts = {}) {
  const acc = opts.account || undefined;
  const partial = monthStart(today).getTime() === month.getTime();
  const day = partial ? startOfDay(today).getDate() : 0;
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const nowR = partial
    ? { start: month, end: addDays(startOfDay(today), 1) }
    : { start: month, end: nextMonth };
  const beforeR = {
    start: prev,
    // The same days of last month, though never into this one when last month was shorter.
    end: partial
      ? new Date(Math.min(new Date(prev.getFullYear(), prev.getMonth(), day + 1).getTime(), month.getTime()))
      : month,
  };
  const catId = opts.catId || null;
  const now = sumIn(state, nowR, 'expense', catId, cur, acc);
  const before = sumIn(state, beforeR, 'expense', catId, cur, acc);
  /** @type {Map<string | null, { id: string | null, now: number, before: number }>} */
  const by = new Map();
  if (!catId) {
    for (const x of spendByCategory(state, nowR, cur, acc))
      by.set(x.id, { id: x.id, now: x.total, before: 0 });
    for (const x of spendByCategory(state, beforeR, cur, acc)) {
      const e = by.get(x.id) || { id: x.id, now: 0, before: 0 };
      e.before = x.total;
      by.set(x.id, e);
    }
  }
  const changes = [...by.values()]
    .filter((c) => Math.abs(c.now - c.before) > 0.005)
    .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
    .slice(0, 4);
  return { partial, day, now, before, changes };
}
