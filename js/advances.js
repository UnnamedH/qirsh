/* Money paid on someone else's behalf ("advances") and their paybacks. */
import { fmt, fromUSD, payVec, vUSD } from './money.js';
import { state } from './state.js';

/* An 'advance' is money paid on someone else's behalf: it leaves the wallet but is not spending. Paybacks ('repay',
   linked by advanceId) bring money back without being income. Closing an advance counts only the part never
   returned as spending, in the chosen category, on the day it was closed. */
export const paybacksOf = (id) =>
  state.tx
    .filter((t) => t.type === 'repay' && t.advanceId === id)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));

export const advanceOf = (r) => state.tx.find((t) => t.id === r.advanceId && t.type === 'advance');

export function owed(a) {
  const cost = vUSD(payVec(a)),
    back = paybacksOf(a.id).reduce((s, r) => s + vUSD(payVec(r)), 0),
    left = Math.max(0, cost - back);
  return { cost, back, left, settled: left < 0.005 || !!a.closed };
}

export const fmtAdv = (a, usd) => fmt(fromUSD(usd, a.currency), a.currency, { round: true });
