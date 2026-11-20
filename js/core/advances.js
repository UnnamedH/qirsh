/* Money paid on someone else's behalf ("advances") and their paybacks. Pure: the state is passed in. */
import { fmt, fromUSD, payVec, toUSD } from './money.js';

/* An 'advance' is money paid on someone else's behalf: it leaves the wallet but is not spending. Paybacks ('repay',
   linked by advanceId) bring money back without being income. Closing an advance counts only the part never
   returned as spending, in the chosen category, on the day it was closed. */
/**
 * @param {import("./types.js").CoreState} s
 * @param {string} id
 */
export const paybacksOf = (s, id) =>
  s.tx
    .filter((t) => t.type === 'repay' && t.advanceId === id)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));

/**
 * @param {import("./types.js").CoreState} s
 * @param {import("./types.js").Tx} r
 */
export const advanceOf = (s, r) => s.tx.find((t) => t.id === r.advanceId && t.type === 'advance');

/* Amounts are compared in the advance's own currency. An amount in the other currency is converted
   at the rate stored on its entry when it was saved, so changing the app's rate later does not change
   how much is still owed. */
/**
 * @param {import("./types.js").CoreState} s
 * @param {Pick<import("./types.js").Tx, "amount" | "currency" | "rate" | "amount2">} t
 * @param {string} cur
 */
function inCurrency(s, t, cur) {
  const v = payVec(t),
    rate = Number(t.rate) > 0 ? Number(t.rate) : s.rate;
  return cur === 'USD' ? v.USD + v.LBP / rate : v.LBP + v.USD * rate;
}

/**
 * What an advance cost, how much came back and how much is left, each as USD at today's rate.
 * @param {import("./types.js").CoreState} s
 * @param {import("./types.js").Tx} a
 */
export function owed(s, a) {
  const cur = a.currency,
    cost = inCurrency(s, a, cur),
    back = paybacksOf(s, a.id).reduce((n, r) => n + inCurrency(s, r, cur), 0),
    left = Math.max(0, cost - back),
    // Less than a cent, or less than 500 LL, counts as fully paid back.
    paid = left < (cur === 'USD' ? 0.005 : 500);
  return {
    cost: toUSD(cost, cur, s.rate),
    back: toUSD(back, cur, s.rate),
    left: paid ? 0 : toUSD(left, cur, s.rate),
    settled: paid || !!a.closed,
  };
}

/**
 * What was never paid back, in `cur` at the advance's own rate: the part kept as spending once closed.
 * @param {import("./types.js").CoreState} s
 * @param {import("./types.js").Tx} a
 * @param {string} cur
 * @returns {number}
 */
export function leftIn(s, a, cur) {
  const left = Math.max(
    0,
    inCurrency(s, a, a.currency) - paybacksOf(s, a.id).reduce((n, r) => n + inCurrency(s, r, a.currency), 0),
  );
  if (left < (a.currency === 'USD' ? 0.005 : 500)) return 0;
  return inCurrency(s, { amount: left, currency: a.currency, rate: a.rate }, cur);
}

/**
 * @param {import("./types.js").CoreState} s
 * @param {import("./types.js").Tx} a
 * @param {number} usd
 */
export const fmtAdv = (s, a, usd) => fmt(fromUSD(usd, a.currency, s.rate), a.currency, { round: true });
