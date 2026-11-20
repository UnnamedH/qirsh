/* Events and camps: what each one cost and brought in. Pure: the state is passed in. */
import { entryValueIn } from './money.js';

/**
 * @typedef {object} Event
 * @property {string} id
 * @property {string} name
 * @property {string} [start]  ymd, or '' when not set
 * @property {string} [end]    ymd, or '' when not set
 * @property {{ amount: number, currency: import("./types.js").Cur } | null} [budget]
 * @property {boolean} [closed]
 */

/**
 * The event an entry belongs to, if it still exists.
 * @param {{ events?: Event[] }} s
 * @param {string | undefined} id
 */
export const eventOf = (s, id) => (id ? (s.events || []).find((e) => e.id === id) : undefined);

/**
 * Events offered in the entry form: the open ones, plus `keep` if a closed event is already picked.
 * @param {{ events?: Event[] }} s
 * @param {string} [keep]
 */
export const pickableEvents = (s, keep) => (s.events || []).filter((e) => !e.closed || e.id === keep);

/**
 * What an event cost and brought in, in `cur`. Each entry counts at the rate saved on it, so the totals
 * don't move when the app's rate changes. Moves between funds and balance corrections are not spending.
 * @param {import("./types.js").CoreState & { events?: Event[] }} s
 * @param {string} eventId
 * @param {string} cur
 */
export function eventTotals(s, eventId, cur) {
  let spent = 0,
    earned = 0,
    count = 0;
  /** @type {Record<string, number>} */
  const byCat = {};
  for (const t of s.tx) {
    if (/** @type {{ eventId?: string }} */ (t).eventId !== eventId) continue;
    if (t.type !== 'expense' && t.type !== 'income') continue;
    const v = entryValueIn(t, cur, s.rate);
    count++;
    if (t.type === 'expense') {
      spent += v;
      const c = t.categoryId || 'other';
      byCat[c] = (byCat[c] || 0) + v;
    } else earned += v;
  }
  return { spent, earned, net: earned - spent, count, byCat };
}

/**
 * Progress against an event's budget, in the budget's own currency, or null when it has none.
 * @param {import("./types.js").CoreState & { events?: Event[] }} s
 * @param {Event} e
 */
export function eventBudget(s, e) {
  if (!e.budget || !(e.budget.amount > 0)) return null;
  const spent = eventTotals(s, e.id, e.budget.currency).spent;
  const pct = spent / e.budget.amount;
  return {
    spent,
    limit: e.budget.amount,
    pct,
    left: e.budget.amount - spent,
    state: pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok',
  };
}
