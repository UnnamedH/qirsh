/* The saved app state: shape, loading, saving and repairing data from older versions or backups. */
import { ACCOUNTS, DEFAULT_CATS, PROTECTED } from './config.js';
import { sampleState } from './sample.js';

export const KEY = 'qirsh.v1';

export function blankState() {
  return {
    app: 'qirsh',
    version: 1,
    rate: 89500,
    settings: { display: 'USD', weekStart: 1, accent: null, theme: 'system', entryStyle: 'paid' },
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

const CURRENCIES = ['USD', 'LBP'];
const isCur = (c) => CURRENCIES.includes(c);
const isObj = (x) => !!x && typeof x === 'object';

/* Settings come from saved data or an imported backup, so each one is checked and replaced with its
   default when it is missing or not a value the app understands. */
function normalizeSettings(st, defaults) {
  st = isObj(st) ? st : {};
  const week = +st.weekStart;
  return {
    display: isCur(st.display) ? st.display : defaults.display,
    weekStart: Number.isInteger(week) && week >= 0 && week <= 6 ? week : defaults.weekStart,
    accent:
      typeof st.accent === 'string' && /^#[0-9a-f]{6}$/i.test(st.accent) ? st.accent.toUpperCase() : null,
    theme: ['system', 'light', 'dark'].includes(st.theme) ? st.theme : defaults.theme,
    // How expenses are typed in: 'price' first with "Paid with", or 'paid' amounts plus change back.
    entryStyle: st.entryStyle === 'price' ? 'price' : defaults.entryStyle,
  };
}

const validCategory = (c) =>
  isObj(c) &&
  typeof c.id === 'string' &&
  typeof c.name === 'string' &&
  (c.type === 'expense' || c.type === 'income');

const validBudget = (b) =>
  isObj(b) &&
  b.id != null &&
  +b.amount > 0 &&
  (b.period === 'week' || b.period === 'month') &&
  isCur(b.currency);

export function normalize(s) {
  const b = blankState();
  const out = Object.assign({}, b, s);
  out.rate = +s.rate > 0 ? +s.rate : b.rate;
  out.settings = normalizeSettings(s.settings, b.settings);
  out.opening = {};
  ACCOUNTS.forEach((a) => {
    const o = (s.opening || {})[a.id] || {};
    out.opening[a.id] = { USD: +o.USD || 0, LBP: +o.LBP || 0 };
  });
  const cats = Array.isArray(s.categories) ? s.categories.filter(validCategory) : [];
  out.categories = cats.length
    ? cats.map((c) => {
        const x = Object.assign({}, c);
        if (typeof x.icon !== 'string' || !x.icon) delete x.icon;
        return x;
      })
    : b.categories;
  PROTECTED.forEach((id) => {
    if (!out.categories.some((c) => c.id === id))
      out.categories.push(
        Object.assign(
          {},
          b.categories.find((c) => c.id === id),
        ),
      );
  });
  out.budgets = Array.isArray(s.budgets) ? s.budgets.filter(validBudget) : [];
  out.tx = s.tx
    .filter((t) => isObj(t) && t.type && isFinite(+t.amount) && t.date && isCur(t.currency))
    .map((t) => {
      const x = Object.assign({}, t, { amount: +t.amount });
      if (x.toCurrency != null && !isCur(x.toCurrency)) delete x.toCurrency;
      if (x.priceCur != null && !isCur(x.priceCur)) delete x.priceCur;
      if (x.rate != null && !(+x.rate > 0)) delete x.rate;
      // Entries from before rates were stored keep the rate they were last shown at. That covers advances
      // and paybacks, and expenses or income paid partly in each currency, whose value depends on a rate.
      const back = isObj(x.back) ? x.back : {};
      const mixed =
        (x.type === 'expense' || x.type === 'income') &&
        (+x.amount2 > 0 ||
          +back[x.currency === 'USD' ? 'LBP' : 'USD'] > 0 ||
          (x.priceCur && x.priceCur !== x.currency));
      if ((x.type === 'advance' || x.type === 'repay' || mixed) && !(+x.rate > 0)) x.rate = out.rate;
      // A balance correction belongs to one account and remembers the balance it was set to.
      if (x.type === 'adjust') {
        if (!ACCOUNTS.some((a) => a.id === x.account)) x.account = 'wallet';
        if (x.target != null && x.target !== '' && isFinite(+x.target)) x.target = +x.target;
        else delete x.target;
      }
      if (x.correction) x.correction = true;
      else delete x.correction;
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
  delete out.exportedAt;
  return out;
}

/* Saved data that could not be read is copied here, so starting over never destroys it. */
export const RESCUE_KEY = 'qirsh.v1.unreadable';

/** Parses saved or imported text into a state, or returns null if it is not usable Qirsh data. */
export function parseState(raw) {
  try {
    const s = JSON.parse(raw);
    return isValid(s) ? normalize(s) : null;
  } catch (e) {
    return null;
  }
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return sampleState();
  }
  if (!raw) return sampleState();
  const s = parseState(raw);
  if (s) return s;
  // Keep the unreadable data aside and start empty, rather than showing example data that the
  // next save would write over it.
  try {
    if (!localStorage.getItem(RESCUE_KEY)) localStorage.setItem(RESCUE_KEY, raw);
  } catch (e) {}
  return blankState();
}

export const rescuedData = () => {
  try {
    return localStorage.getItem(RESCUE_KEY);
  } catch (e) {
    return null;
  }
};

export function discardRescued() {
  try {
    localStorage.removeItem(RESCUE_KEY);
  } catch (e) {}
}

/* True when the last save failed, for example because storage is full or blocked. */
export let saveFailed = false;

export function save() {
  state.savedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch (e) {
    saveFailed = true;
  }
  return !saveFailed;
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
