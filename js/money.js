/* Frata's money helpers: the shared core in js/core/money.js, bound to the app's saved rate and settings. */
import * as core from './core/money.js';
import { state } from './state.js';

export {
  backParts,
  backVec,
  fmt,
  isMixed,
  other,
  parseAmt,
  parseInput,
  payParts,
  payVec,
  priceCurrency,
  toInput,
} from './core/money.js';

export const toUSD = (a, c) => core.toUSD(a, c, state.rate);

export const fromUSD = (u, c) => core.fromUSD(u, c, state.rate);

export const vUSD = (v) => core.vUSD(v, state.rate);

/** What an entry is worth in `cur`, at the rate saved on it (see core/money.js). */
export const entryValueIn = (t, cur) => core.entryValueIn(t, cur, state.rate);

/**
 * An entry's value in USD, at the rate saved on it. Every entry keeps the rate of the day it was
 * saved, so changing the app's rate later doesn't change what past months cost.
 */
export const txCostUSD = (t) => entryValueIn(t, 'USD');

/** The currency totals are shown in, as picked in Settings. */
export const dispCur = () => state.settings.display;

/** Formats a total that is already in the display currency (see dispCur). */
export const fmtTotal = (n, o) => core.fmt(n, dispCur(), Object.assign({ round: true }, o || {}));

/** Formats a USD amount in the display currency at today's rate: for balances and what is owed now. */
export const fmtDisp = (usd, o) => {
  const c = state.settings.display;
  return core.fmt(fromUSD(usd, c), c, Object.assign({ round: true }, o || {}));
};
