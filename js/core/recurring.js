/* Recurring entries: when the next one is due, and the entry it becomes. Pure: today's date is passed in. */
import { addDays, parseYmd, ymd } from '../util.js';

/** @typedef {import("./types.js").Recurring} Recurring */

/** The most recurring entries a person can set up. */
export const MAX_RECURRING = 50;
/** If the app wasn't opened for a long while, only the latest this many of an entry's dates are offered. */
export const MAX_DUE = 12;

/**
 * Whether `s` is a real calendar date written yyyy-mm-dd.
 * @param {unknown} s
 */
export const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseYmd(s)) === s;

/**
 * The date after `from` that `rec` falls due: a week on, or the same day of next month, which for a short
 * month is its last day (the 31st becomes 28 February, then 31 March again).
 * @param {Pick<Recurring, 'every' | 'day'>} rec
 * @param {string} from
 */
export function nextDate(rec, from) {
  const d = parseYmd(from);
  if (rec.every === 'week') return ymd(addDays(d, 7));
  const y = d.getFullYear(),
    m = d.getMonth() + 1;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return ymd(new Date(y, m, Math.min(rec.day || d.getDate(), lastDay)));
}

/**
 * Every date `rec` is due up to and including `today`, oldest first, keeping only the latest `cap`.
 * @param {Recurring} rec
 * @param {string} today
 * @param {number} [cap]
 * @returns {string[]}
 */
export function occurrences(rec, today, cap = MAX_DUE) {
  /** @type {string[]} */
  const out = [];
  let d = rec.next;
  // The guard stops a date from long ago, or a mistake, from looping for ever.
  for (let i = 0; d <= today && i < 6000; i++) {
    out.push(d);
    d = nextDate(rec, d);
  }
  return out.slice(-cap);
}

/**
 * What needs a decision today: for each entry that's due, its oldest due date (the next after that
 * waits its turn), and how many more come after it. Oldest first.
 * @param {Recurring[]} list
 * @param {string} today
 * @returns {{ rec: Recurring, date: string, more: number }[]}
 */
export function dueNow(list, today) {
  /** @type {{ rec: Recurring, date: string, more: number }[]} */
  const out = [];
  for (const rec of list) {
    const o = occurrences(rec, today);
    if (o.length) out.push({ rec, date: o[0], more: o.length - 1 });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Every due date of every entry, oldest first: what "Add all" works through.
 * @param {Recurring[]} list
 * @param {string} today
 * @returns {{ rec: Recurring, date: string }[]}
 */
export function allDue(list, today) {
  return list
    .flatMap((rec) => occurrences(rec, today).map((date) => ({ rec, date })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The entry a due date becomes. It counts at `rate`, today's, like anything added today.
 * @param {Recurring} rec
 * @param {string} date
 * @param {number} rate
 * @param {string} id
 * @param {number} now
 */
export function entryFor(rec, date, rate, id, now) {
  return {
    id,
    type: rec.type,
    amount: rec.amount,
    currency: rec.currency,
    categoryId: rec.categoryId,
    account: rec.account,
    note: rec.note,
    date,
    createdAt: now,
    rate,
  };
}
