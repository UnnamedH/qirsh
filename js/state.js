/* The saved app state: shape, loading, saving and repairing data from older versions or backups. */
import { ACCOUNTS, DEFAULT_CATS, PROTECTED } from './config.js';
import { sampleState } from './sample.js';

export const KEY = 'qirsh.v1';

export function blankState() {
  return {
    app: 'qirsh',
    version: 1,
    rate: 89500,
    settings: { display: 'USD', weekStart: 1, accent: null, theme: 'system' },
    opening: { wallet: { USD: 0, LBP: 0 }, savings: { USD: 0, LBP: 0 }, whish: { USD: 0, LBP: 0 } },
    categories: DEFAULT_CATS.map((c) => Object.assign({}, c)),
    tx: [],
    budgets: [],
    lastExport: null,
    sample: false,
  };
}

export function isValid(s) {
  return !!s && typeof s === 'object' && Array.isArray(s.tx);
}

export function normalize(s) {
  const b = blankState();
  const out = Object.assign({}, b, s);
  out.settings = Object.assign({}, b.settings, s.settings || {});
  out.opening = {};
  ACCOUNTS.forEach((a) => {
    const o = (s.opening || {})[a.id] || {};
    out.opening[a.id] = { USD: +o.USD || 0, LBP: +o.LBP || 0 };
  });
  out.categories = Array.isArray(s.categories) && s.categories.length ? s.categories : b.categories;
  PROTECTED.forEach((id) => {
    if (!out.categories.some((c) => c.id === id))
      out.categories.push(
        Object.assign(
          {},
          b.categories.find((c) => c.id === id),
        ),
      );
  });
  out.budgets = Array.isArray(s.budgets) ? s.budgets : [];
  out.tx = s.tx
    .filter((t) => t && t.type && isFinite(+t.amount) && t.date)
    .map((t) => {
      const x = Object.assign({}, t, { amount: +t.amount });
      if (x.amount2 != null) {
        x.amount2 = +x.amount2 || 0;
        if (!x.amount2) delete x.amount2;
      }
      if (x.change) {
        const b = { USD: 0, LBP: 0 };
        b[x.change.currency] = +x.change.amount || 0;
        x.back = b;
        delete x.change;
      }
      if (x.back) {
        x.back = { USD: +x.back.USD || 0, LBP: +x.back.LBP || 0 };
        if (!x.back.USD && !x.back.LBP) delete x.back;
      }
      return x;
    });
  out.rate = +s.rate > 0 ? +s.rate : b.rate;
  delete out.exportedAt;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (isValid(s)) return normalize(s);
    }
  } catch (e) {}
  return sampleState();
}

export function save() {
  state.savedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {}
}

/* Ask the browser not to evict our data when the device is low on space. */
export function persistStorage() {
  try {
    const st = navigator.storage;
    if (st && st.persist && st.persisted)
      st.persisted()
        .then((p) => p || st.persist())
        .catch(() => {});
  } catch (e) {}
}

export let state = load();

export function setState(value) {
  state = value;
  return value;
}
