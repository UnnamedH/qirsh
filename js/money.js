/* Currency amounts: formatting, parsing and USD/LL conversion. */
import { state } from './state.js';

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

export const toUSD = (a, c) => (c === 'USD' ? a : a / state.rate);

export const fromUSD = (u, c) => (c === 'USD' ? u : u * state.rate);

export const other = (c) => (c === 'USD' ? 'LBP' : 'USD');

export const vUSD = (v) => v.USD + v.LBP / state.rate;

export function payVec(t) {
  const v = { USD: 0, LBP: 0 };
  v[t.currency] += +t.amount || 0;
  if (t.amount2) v[other(t.currency)] += +t.amount2;
  return v;
}

export function backVec(t) {
  if (t.back) return { USD: +t.back.USD || 0, LBP: +t.back.LBP || 0 };
  const v = { USD: 0, LBP: 0 };
  if (t.change) v[t.change.currency] += +t.change.amount || 0;
  return v;
}

export const txCostUSD = (t) => vUSD(payVec(t)) - (t.type === 'expense' ? vUSD(backVec(t)) : 0);

export const payParts = (t) => {
  const p = [fmt(t.amount, t.currency)];
  if (t.amount2) p.push(fmt(+t.amount2, other(t.currency)));
  return p;
};

export const backParts = (t) => {
  const b = backVec(t),
    p = [];
  if (b.USD > 0) p.push(fmt(b.USD, 'USD'));
  if (b.LBP > 0) p.push(fmt(b.LBP, 'LBP'));
  return p;
};

export const fmtDisp = (usd, o) => {
  const c = state.settings.display;
  return fmt(fromUSD(usd, c), c, Object.assign({ round: true }, o || {}));
};

export function parseAmt(s) {
  s = String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[,\s]/g, '');
  let m = 1;
  if (/k$/.test(s)) {
    m = 1e3;
    s = s.slice(0, -1);
  } else if (/m$/.test(s)) {
    m = 1e6;
    s = s.slice(0, -1);
  }
  const n = parseFloat(s);
  return isFinite(n) ? n * m : NaN;
}
