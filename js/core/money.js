/* Currency amounts: formatting, parsing and USD/LL conversion. Pure: the rate is always passed in. */

/**
 * @param {number} n
 * @param {string} cur
 * @param {import("./types.js").FmtOptions} [o]
 * @returns {string}
 */
export function fmt(n, cur, o) {
  o = o || {};
  const neg = n < 0,
    a = Math.abs(n);
  let s;
  if (cur === 'USD') {
    const r = Math.round(a * 100) / 100;
    s =
      '$' +
      r.toLocaleString('en-US', {
        minimumFractionDigits: o.whole || Number.isInteger(r) ? 0 : 2,
        maximumFractionDigits: o.whole ? 0 : 2,
      });
  } else {
    const r = o.round ? Math.round(a / 1000) * 1000 : Math.round(a);
    s = r.toLocaleString('en-US') + ' LL';
  }
  return (neg && Math.abs(n) >= 0.005 ? '−' : o.sign ? '+' : '') + s;
}

/**
 * @param {number} a @param {string} c @param {number} rate
 * @param {number} a
 * @param {string} c
 * @param {number} rate
 */
export const toUSD = (a, c, rate) => (c === 'USD' ? a : a / rate);

/**
 * @param {number} u @param {string} c @param {number} rate
 * @param {number} u
 * @param {string} c
 * @param {number} rate
 */
export const fromUSD = (u, c, rate) => (c === 'USD' ? u : u * rate);

/**
 * @param {import("./types.js").Cur} c
 * @returns {import("./types.js").Cur}
 */
export const other = (c) => (c === 'USD' ? 'LBP' : 'USD');

/**
 * @param {{USD: number, LBP: number}} v @param {number} rate
 * @param {import("./types.js").Vec} v
 * @param {number} rate
 */
export const vUSD = (v, rate) => v.USD + v.LBP / rate;

/**
 * @param {Pick<import("./types.js").Tx, "amount" | "currency" | "amount2">} t
 * @returns {import("./types.js").Vec}
 */
export function payVec(t) {
  const v = { USD: 0, LBP: 0 };
  v[t.currency] += +t.amount || 0;
  if (t.amount2) v[other(t.currency)] += +t.amount2;
  return v;
}

/**
 * @param {import("./types.js").Tx} t
 * @returns {import("./types.js").Vec}
 */
export function backVec(t) {
  if (t.back) return { USD: +t.back.USD || 0, LBP: +t.back.LBP || 0 };
  const v = { USD: 0, LBP: 0 };
  if (t.change) v[t.change.currency] += +t.change.amount || 0;
  return v;
}

/**
 * What an entry is worth in `cur`: what it cost for an expense (paid minus change back) or what came in
 * for income. An entry paid in both currencies is converted at the rate stored on it, which for a
 * price-first expense is the rate the shop used, so it keeps its exact price after the app's rate changes.
 * `rate0` is the app's rate, used only for an entry that has none of its own.
 * @param {import("./types.js").Tx} t
 * @param {string} cur
 * @param {number} rate0
 */
export function entryValueIn(t, cur, rate0) {
  const v = payVec(t),
    k = t.type === 'expense' ? backVec(t) : { USD: 0, LBP: 0 },
    net = { USD: v.USD - k.USD, LBP: v.LBP - k.LBP },
    rate = Number(t.rate) > 0 ? Number(t.rate) : rate0;
  return cur === 'USD' ? net.USD + net.LBP / rate : net.LBP + net.USD * rate;
}

/**
 * The currency an entry is priced in: the price the user typed, or else the one they paid in.
 * @param {import("./types.js").Tx} t
 */
export const priceCurrency = (t) => t.priceCur || t.currency;

/**
 * True when an entry's amounts are in both currencies, so its value depends on a rate.
 * @param {import("./types.js").Tx} t
 */
export function isMixed(t) {
  const k = backVec(t);
  return !!(Number(t.amount2) > 0 || k[other(t.currency)] > 0 || (t.priceCur && t.priceCur !== t.currency));
}

/**
 * @param {import("./types.js").Tx} t
 */
export const payParts = (t) => {
  const p = [fmt(t.amount, t.currency)];
  if (t.amount2) p.push(fmt(+t.amount2, other(t.currency)));
  return p;
};

/**
 * @param {import("./types.js").Tx} t
 */
export const backParts = (t) => {
  const b = backVec(t),
    p = [];
  if (b.USD > 0) p.push(fmt(b.USD, 'USD'));
  if (b.LBP > 0) p.push(fmt(b.LBP, 'LBP'));
  return p;
};

/**
 * Reads a typed number, or returns NaN when it isn't one. Anything that isn't plainly a number is
 * refused rather than guessed at, so a slip like "12abc" is never saved as 12.
 * Commas work both ways: "1,500" and "89,500" group thousands, while "4,50" is a decimal comma, as
 * typed on phones set to a region that writes decimals that way.
 * @param {unknown} input
 * @returns {number}
 */
export function parseAmt(input) {
  let s = String(input == null ? '' : input)
    .trim()
    .toLowerCase()
    .replace(/\s/g, '');
  let m = 1;
  if (/k$/.test(s)) {
    m = 1e3;
    s = s.slice(0, -1);
  } else if (/m$/.test(s)) {
    m = 1e6;
    s = s.slice(0, -1);
  }
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d*,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return parseFloat(s) * m;
}

/**
 * Typed amounts. LL is always typed in thousands, so "385" means 385,000 LL and "0.5" means 500 LL.
 * Shortcuts stay literal: "385k" is 385,000 and "1.5m" is 1,500,000. Dollars are typed as they are.
 * @param {unknown} s
 * @param {string} cur
 * @returns {number}
 */
export function parseInput(s, cur) {
  const raw = String(s == null ? '' : s)
    .trim()
    .toLowerCase();
  const n = parseAmt(raw);
  if (cur !== 'LBP' || !isFinite(n)) return n;
  // LL has no fractions, and 1.1 * 1000 is 1100.0000000000002 in floating point.
  return Math.round(/[km]$/.test(raw) ? n : n * 1000);
}

/**
 * The text to show in an amount field for a stored amount.
 * @param {number | string | null | undefined} n
 * @param {string} cur
 * @returns {string}
 */
export function toInput(n, cur) {
  if (n == null || n === '' || !isFinite(+n)) return '';
  n = +n;
  if (cur !== 'LBP') return String(Math.round(n * 100) / 100);
  return String(Math.round(n) / 1000);
}
