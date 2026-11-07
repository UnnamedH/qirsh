/* Account balances, spending totals and budget progress. */
import { owed } from './advances.js';
import { ACCOUNTS } from './config.js';
import { backVec, payVec, toUSD, txCostUSD } from './money.js';
import { state } from './state.js';
import { addDays, parseYmd, startOfDay } from './util.js';

export function balances() {
  const b = {};
  ACCOUNTS.forEach((a) => {
    const o = state.opening[a.id] || {};
    b[a.id] = { USD: +o.USD || 0, LBP: +o.LBP || 0 };
  });
  const acc = (id) => (b[id] = b[id] || { USD: 0, LBP: 0 });
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
      acc(t.from)[t.currency] -= t.amount;
      acc(t.to)[t.toCurrency || t.currency] += t.toAmount != null ? +t.toAmount : t.amount;
    }
  }
  return b;
}

export const combinedUSD = (x) => x.USD + x.LBP / state.rate;

export function range(period, ref) {
  const d = startOfDay(ref || new Date());
  if (period === 'month')
    return {
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
    };
  const back = (d.getDay() - state.settings.weekStart + 7) % 7;
  const start = addDays(d, -back);
  return { start, end: addDays(start, 7) };
}

export const inRange = (t, r) => {
  const d = parseYmd(t.date);
  return d >= r.start && d < r.end;
};

export function sumUSD(r, type, catId) {
  let s = 0;
  for (const t of state.tx) {
    if (type === 'expense' && t.type === 'advance') {
      if (
        t.closed &&
        t.keptCat &&
        (!catId || t.keptCat === catId) &&
        inRange({ date: t.closedOn || t.date }, r)
      )
        s += owed(t).left;
      continue;
    }
    if (t.type !== type) continue;
    if (catId && t.categoryId !== catId) continue;
    if (!inRange(t, r)) continue;
    s += txCostUSD(t);
  }
  return s;
}

export function budgetStatus(b) {
  const r = range(b.period);
  const spent = sumUSD(r, 'expense', b.categoryId || null);
  const limit = toUSD(+b.amount, b.currency);
  const pct = limit > 0 ? spent / limit : 0;
  const daysLeft = Math.max(1, Math.round((r.end - startOfDay(new Date())) / 864e5));
  return {
    spent,
    limit,
    pct,
    left: limit - spent,
    daysLeft,
    state: pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok',
  };
}

export const catOf = (id) => state.categories.find((c) => c.id === id);

export const catName = (id) => (catOf(id) || { name: 'Uncategorised' }).name;

export const budgetName = (b) => (b.categoryId ? catName(b.categoryId) : 'All spending');
