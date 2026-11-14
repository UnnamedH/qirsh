/* Quick add: entries the user repeats often or added recently. */
import { backVec, isMixed } from './money.js';
import { state } from './state.js';
import { uid, ymd } from './util.js';

function tplKey(t) {
  return [
    t.type,
    t.categoryId || '',
    t.who || '',
    t.type === 'transfer' ? '' : t.account || 'wallet',
    t.amount,
    t.currency,
    (t.note || '').trim().toLowerCase(),
    t.from || '',
    t.to || '',
    t.toCurrency || '',
    t.type === 'transfer' && t.toCurrency !== t.currency ? t.toAmount : '',
    t.amount2 || '',
    // The same amounts paid for a different price (price first) are a different entry.
    t.priceCur || '',
    t.priceCur ? t.rate || '' : '',
    ((t) => {
      const k = backVec(t);
      return k.USD + '/' + k.LBP;
    })(t),
  ].join('|');
}

export function templates() {
  const m = new Map();
  for (const t of state.tx) {
    // Paybacks and balance corrections are one-offs, never something to repeat.
    if (t.type === 'repay' || t.type === 'adjust' || t.correction) continue;
    const k = tplKey(t);
    const e = m.get(k) || { key: k, tx: t, count: 0, last: 0 };
    e.count++;
    if ((t.createdAt || 0) >= e.last) {
      e.last = t.createdAt || 0;
      e.tx = t;
    }
    m.set(k, e);
  }
  const all = [...m.values()];
  return {
    frequent: all
      .filter((e) => e.count >= 2)
      .sort((a, b) => b.count - a.count || b.last - a.last)
      .slice(0, 8),
    recent: all.sort((a, b) => b.last - a.last).slice(0, 8),
  };
}

export function cloneForToday(t) {
  const c = Object.assign({}, t, { id: uid(), date: ymd(new Date()), createdAt: Date.now() });
  delete c.closed;
  delete c.closedOn;
  delete c.keptCat;
  // Added again today, it counts at today's rate. An entry in both currencies keeps the rate that
  // made its amounts add up, such as the shop's rate for a price-first expense.
  if (c.type !== 'transfer' && !(c.type !== 'advance' && isMixed(c))) c.rate = state.rate;
  return c;
}
