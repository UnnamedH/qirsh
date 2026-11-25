/* The saved app state: shape, loading, saving and repairing data from older versions or backups. */
import { DEFAULT_ACCOUNTS, DEFAULT_CATS, PROTECTED } from './config.js';
import { sampleState } from './sample.js';

export const KEY = 'qirsh.v1';

export function blankState() {
  return {
    app: 'qirsh',
    version: 1,
    rate: 89500,
    settings: {
      display: 'USD',
      weekStart: 1,
      accent: null,
      theme: 'system',
      entryStyle: 'paid',
      hide: false,
      accountsOpen: null,
      homeFold: {},
    },
    accounts: DEFAULT_ACCOUNTS.map((a) => Object.assign({}, a)),
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
/* Entry types that save the rate of their day. Transfers store both amounts, so they need none. */
const RATED = ['expense', 'income', 'advance', 'repay', 'adjust'];
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
    // Balances blurred on Home, for showing the app to someone.
    hide: st.hide === true,
    // Other accounts on Home shown or folded away; null until chosen, then the number of accounts decides.
    accountsOpen: typeof st.accountsOpen === 'boolean' ? st.accountsOpen : null,
    // Home sections folded down to a one-line summary; anything else in a backup is dropped.
    homeFold: Object.fromEntries(
      HOME_SECTIONS.filter((k) => isObj(st.homeFold) && st.homeFold[k] === true).map((k) => [k, true]),
    ),
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

/* Sections on Home that can be folded (js/views/home.js). */
export const HOME_SECTIONS = ['owed', 'quick', 'month', 'budgets'];

const ACCOUNT_ID = /^[\w-]{1,40}$/;

/* Accounts come from saved data or a backup, so each is checked. Data from before accounts could be
   changed has none, and gets the original three. Wallet is always there and always first. When there
   is a list, an account an entry or starting balance points to is kept even if the list lost it, so
   no money goes missing; without one, the original three were all there was. */
function normalizeAccounts(s, defaults) {
  const list = Array.isArray(s.accounts) ? s.accounts : defaults;
  const out = [],
    seen = new Set();
  const add = (a) => {
    if (!isObj(a) || typeof a.id !== 'string' || !ACCOUNT_ID.test(a.id) || seen.has(a.id)) return;
    seen.add(a.id);
    const name = typeof a.name === 'string' ? a.name.trim().slice(0, 30) : '';
    const x = { id: a.id, name: name || (a.id === 'wallet' ? 'Wallet' : a.id) };
    if (a.savings === true && a.id !== 'wallet') x.savings = true;
    if (a.hidden === true && a.id !== 'wallet') x.hidden = true;
    out.push(x);
  };
  add(list.find((a) => isObj(a) && a.id === 'wallet') || defaults[0]);
  list.forEach(add);
  if (!Array.isArray(s.accounts)) return out;
  const used = Object.keys(isObj(s.opening) ? s.opening : {});
  (Array.isArray(s.tx) ? s.tx : []).forEach((t) => {
    if (isObj(t)) used.push(t.account, t.from, t.to);
  });
  used.forEach((id) => {
    if (typeof id === 'string') add({ id, name: id.charAt(0).toUpperCase() + id.slice(1) });
  });
  return out;
}

export function normalize(s) {
  const b = blankState();
  const out = Object.assign({}, b, s);
  out.rate = +s.rate > 0 ? +s.rate : b.rate;
  out.settings = normalizeSettings(s.settings, b.settings);
  out.accounts = normalizeAccounts(s, b.accounts);
  out.opening = {};
  out.accounts.forEach((a) => {
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
  // A budget covers all spending or a list of categories. Older data had one category in `categoryId`.
  out.budgets = (Array.isArray(s.budgets) ? s.budgets.filter(validBudget) : []).map((b) => {
    const x = Object.assign({}, b);
    const ids = Array.isArray(b.categoryIds) ? b.categoryIds : b.categoryId ? [b.categoryId] : [];
    x.categoryIds = [...new Set(ids.filter((id) => typeof id === 'string' && id))];
    delete x.categoryId;
    return x;
  });
  out.tx = s.tx
    .filter((t) => isObj(t) && t.type && isFinite(+t.amount) && t.date && isCur(t.currency))
    .map((t) => {
      const x = Object.assign({}, t, { amount: +t.amount });
      if (x.toCurrency != null && !isCur(x.toCurrency)) delete x.toCurrency;
      if (x.priceCur != null && !isCur(x.priceCur)) delete x.priceCur;
      if (x.rate != null && !(+x.rate > 0)) delete x.rate;
      // Every entry keeps the rate of the day it was saved, so past months don't change with the app's
      // rate. Entries from before rates were stored get the rate they were last shown at, once.
      if (RATED.includes(x.type) && !(+x.rate > 0)) x.rate = out.rate;
      // A balance correction belongs to one account and remembers the balance it was set to.
      if (x.type === 'adjust') {
        if (!out.accounts.some((a) => a.id === x.account)) x.account = 'wallet';
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

/** Parses saved or imported text into a state, or returns null if it is not usable Frata data. */
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

/* True when the last change was dropped because another copy of the app had saved since (see save). */
export let saveConflict = false;

/* When the data in storage was saved, read from its text without parsing all of it. `"savedAt":` can
   only be the top-level field: inside a note the quotes would be escaped. */
function storedStamp(raw) {
  const m = /"savedAt":(\d+)/.exec(raw || '');
  return m ? +m[1] : 0;
}

/* The save time of the data this copy of the app last loaded or wrote. */
let knownStamp = 0;

/**
 * Takes the data from storage if another copy of the app (a second tab, or the installed app next to
 * a browser tab) saved after this one last looked. Returns true when the state was replaced.
 * Copies normally hear about each other's saves through the `storage` event, but a copy asleep in
 * the background can miss it, so this is also called when the app comes back and before every save.
 */
export function syncFromStorage() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
  if (!raw || storedStamp(raw) <= knownStamp) return false;
  const next = parseState(raw);
  if (!next) return false;
  state = next;
  knownStamp = storedStamp(raw);
  return true;
}

/**
 * Saves the state. If another copy saved since this one last looked, writing would erase its changes,
 * so instead this copy takes the newer data, drops its own last change and reports a conflict.
 */
export function save() {
  if (syncFromStorage()) {
    saveConflict = true;
    return false;
  }
  saveConflict = false;
  state.savedAt = Math.max(Date.now(), knownStamp + 1);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
    knownStamp = state.savedAt;
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
knownStamp = +state.savedAt || 0;

/** Replaces the whole state, for example with an imported backup. The next save writes it. */
export function setState(value) {
  state = value;
  return value;
}
