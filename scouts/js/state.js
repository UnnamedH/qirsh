/* The saved scouts data: shape, loading, saving and repairing data from older versions or backups.
   It lives under its own key, so it never mixes with the personal Frata app on the same address. */
import { ensureCampAccount } from './camps.js';
import { APP_ID, DEFAULT_ACCOUNTS, DEFAULT_CATS, PROTECTED } from './config.js';

export const KEY = 'frata-scouts.v1';

export function blankState() {
  return {
    app: APP_ID,
    version: 1,
    group: { name: '' },
    rate: 89500,
    settings: { display: 'USD', weekStart: 1, theme: 'system' },
    accounts: DEFAULT_ACCOUNTS.map((a) => Object.assign({}, a)),
    opening: { wallet: { USD: 0, LBP: 0 }, bank: { USD: 0, LBP: 0 } },
    categories: DEFAULT_CATS.map((c) => Object.assign({}, c)),
    tx: [],
    // Reserved for later steps (events, members and their fees), so saved data never needs migrating.
    events: [],
    members: [],
    fees: [],
    lastExport: null,
  };
}

const CURRENCIES = ['USD', 'LBP'];
const TYPES = ['expense', 'income', 'transfer', 'adjust'];
/* Entry types that save the rate of their day. Transfers store both amounts, so they need none. */
const RATED = ['expense', 'income', 'adjust'];
/* Links from an entry to other records, by id: its event or camp, the member it is for, the fee it pays,
   and the leader who paid out of pocket (`paidBy`). Reserved now so later versions need no migration. */
const LINKS = ['eventId', 'memberId', 'feeId', 'paidBy'];
const isCur = (c) => CURRENCIES.includes(c);
const isObj = (x) => !!x && typeof x === 'object';
const ACCOUNT_ID = /^[\w-]{1,40}$/;

const validCategory = (c) =>
  isObj(c) &&
  typeof c.id === 'string' &&
  typeof c.name === 'string' &&
  (c.type === 'expense' || c.type === 'income');

/** True for parsed data that is Frata Scouts data. A personal Frata backup is refused here. */
export function isValid(s) {
  return isObj(s) && s.app === APP_ID && Array.isArray(s.tx);
}

/* Accounts come from saved data or a backup, so each is checked. The main fund is always there and
   first. An account that an entry or starting balance points to is kept even if the list lost it, so
   no money goes missing. */
function normalizeAccounts(s) {
  const list = Array.isArray(s.accounts) ? s.accounts : DEFAULT_ACCOUNTS;
  const out = [],
    seen = new Set();
  const add = (a) => {
    if (!isObj(a) || typeof a.id !== 'string' || !ACCOUNT_ID.test(a.id) || seen.has(a.id)) return;
    seen.add(a.id);
    const name = typeof a.name === 'string' ? a.name.trim().slice(0, 30) : '';
    const x = { id: a.id, name: name || (a.id === 'wallet' ? 'Caisse' : a.id) };
    if (a.hidden === true && a.id !== 'wallet') x.hidden = true;
    out.push(x);
  };
  add(list.find((a) => isObj(a) && a.id === 'wallet') || DEFAULT_ACCOUNTS[0]);
  list.forEach(add);
  const used = Object.keys(isObj(s.opening) ? s.opening : {});
  s.tx.forEach((t) => {
    if (isObj(t)) used.push(t.account, t.from, t.to);
  });
  used.forEach((id) => {
    if (typeof id === 'string') add({ id, name: id.charAt(0).toUpperCase() + id.slice(1) });
  });
  return out;
}

function normalizeTx(t, out) {
  const x = Object.assign({}, t, { amount: +t.amount });
  if (x.toCurrency != null && !isCur(x.toCurrency)) delete x.toCurrency;
  if (x.toAmount != null) x.toAmount = +x.toAmount || 0;
  if (x.rate != null && !(+x.rate > 0)) delete x.rate;
  // Every entry keeps the rate of the day it was saved, so past months don't change with the app's rate.
  if (RATED.includes(x.type) && !(+x.rate > 0)) x.rate = out.rate;
  if (x.type === 'adjust') {
    if (!out.accounts.some((a) => a.id === x.account)) x.account = 'wallet';
    if (x.target != null && x.target !== '' && isFinite(+x.target)) x.target = +x.target;
    else delete x.target;
  }
  // Links to events, members and fees are plain ids; anything else in their place is dropped.
  LINKS.forEach((k) => {
    if (typeof x[k] !== 'string' || !x[k]) delete x[k];
  });
  // The leader expenses a reimbursement pays back.
  const claims = Array.isArray(x.claimIds) ? x.claimIds.filter((id) => typeof id === 'string' && id) : [];
  if (claims.length) x.claimIds = [...new Set(claims)];
  else delete x.claimIds;
  return x;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

const money = (b) =>
  isObj(b) && +b.amount > 0 && isCur(b.currency) ? { amount: +b.amount, currency: b.currency } : null;

/* Events and camps: each needs an id and a name; dates, a budget, a cotisation and who attends are
   optional. Attendees must be members. */
function normalizeEvents(list, memberIds) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((e) => isObj(e) && typeof e.id === 'string' && e.id && !seen.has(e.id) && seen.add(e.id))
    .map((e) => {
      const name = typeof e.name === 'string' ? e.name.trim().slice(0, 60) : '';
      const x = {
        id: e.id,
        name: name || 'Untitled event',
        start: typeof e.start === 'string' && YMD.test(e.start) ? e.start : '',
        end: typeof e.end === 'string' && YMD.test(e.end) ? e.end : '',
        budget: money(e.budget),
        cotisation: money(e.cotisation),
        attendees: [
          ...new Set((Array.isArray(e.attendees) ? e.attendees : []).filter((id) => memberIds.has(id))),
        ],
        closed: e.closed === true,
        createdAt: +e.createdAt || 0,
      };
      if (typeof e.accountId === 'string' && e.accountId) x.accountId = e.accountId;
      // An end before the start is a slip; the start is the date people type first.
      if (x.start && x.end && x.end < x.start) x.end = '';
      return x;
    });
}

/* Keeps the first record with each id, dropping anything without one. */
function uniqueById(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).filter(
    (r) => isObj(r) && typeof r.id === 'string' && r.id && !seen.has(r.id) && seen.add(r.id),
  );
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* Members: scouts and leaders. Someone who left stays, inactive, so past payments keep their name. */
function normalizeMembers(list) {
  return uniqueById(list).map((m) => ({
    id: m.id,
    name: text(m.name, 60) || 'Unnamed',
    role: m.role === 'leader' ? 'leader' : 'scout',
    unit: text(m.unit, 30),
    active: m.active !== false,
    createdAt: +m.createdAt || 0,
  }));
}

/* Fees: an amount each listed member owes. A fee without a usable amount can't be tracked, so it goes. */
function normalizeFees(list, out) {
  const members = new Set(out.members.map((m) => m.id)),
    events = new Set(out.events.map((e) => e.id));
  return uniqueById(list)
    .filter((f) => +f.amount > 0 && isCur(f.currency))
    .map((f) => {
      const x = {
        id: f.id,
        name: text(f.name, 60) || 'Fee',
        amount: +f.amount,
        currency: f.currency,
        due: typeof f.due === 'string' && YMD.test(f.due) ? f.due : '',
        memberIds: [
          ...new Set((Array.isArray(f.memberIds) ? f.memberIds : []).filter((id) => members.has(id))),
        ],
        createdAt: +f.createdAt || 0,
      };
      if (typeof f.eventId === 'string' && events.has(f.eventId)) x.eventId = f.eventId;
      return x;
    });
}

/* Version 0.2 of the scouts app had fees of their own, optionally tied to an event. A camp's fee is now
   the event's cotisation, with its members as the attendees, so a fee tied to an event that has no
   cotisation yet becomes it, and its payments move along. Other fees stay in the data, unseen. */
function moveEventFees(out) {
  out.fees = out.fees.filter((f) => {
    const e = f.eventId && out.events.find((x) => x.id === f.eventId);
    if (!e || e.cotisation) return true;
    e.cotisation = { amount: f.amount, currency: f.currency };
    e.attendees = [...new Set([...e.attendees, ...f.memberIds])];
    out.tx.forEach((t) => {
      if (t.feeId === f.id) {
        t.feeId = e.id;
        t.eventId = e.id;
      }
    });
    return false;
  });
}

/** Repairs any parsed data into a state the app can use. It never throws on bad data. */
export function normalize(s) {
  const b = blankState();
  const out = Object.assign({}, b, s);
  out.app = APP_ID;
  out.rate = +s.rate > 0 ? +s.rate : b.rate;
  const g = isObj(s.group) ? s.group : {};
  out.group = { name: typeof g.name === 'string' ? g.name.trim().slice(0, 60) : '' };
  const st = isObj(s.settings) ? s.settings : {};
  const week = +st.weekStart;
  out.settings = {
    display: isCur(st.display) ? st.display : b.settings.display,
    weekStart: Number.isInteger(week) && week >= 0 && week <= 6 ? week : b.settings.weekStart,
    theme: ['system', 'light', 'dark'].includes(st.theme) ? st.theme : b.settings.theme,
  };
  const txs = Array.isArray(s.tx) ? s.tx : [];
  out.accounts = normalizeAccounts(Object.assign({}, s, { tx: txs }));
  out.opening = {};
  out.accounts.forEach((a) => {
    const o = (isObj(s.opening) ? s.opening : {})[a.id] || {};
    out.opening[a.id] = { USD: +o.USD || 0, LBP: +o.LBP || 0 };
  });
  const cats = Array.isArray(s.categories) ? s.categories.filter(validCategory) : [];
  out.categories = cats.length ? cats.map((c) => Object.assign({}, c)) : b.categories;
  PROTECTED.forEach((id) => {
    if (!out.categories.some((c) => c.id === id))
      out.categories.push(
        Object.assign(
          {},
          b.categories.find((c) => c.id === id),
        ),
      );
  });
  out.tx = txs
    .filter(
      (t) =>
        isObj(t) &&
        typeof t.id === 'string' &&
        TYPES.includes(t.type) &&
        isFinite(+t.amount) &&
        typeof t.date === 'string' &&
        isCur(t.currency),
    )
    .map((t) => normalizeTx(t, out));
  out.members = normalizeMembers(s.members);
  const memberIds = new Set(out.members.map((m) => m.id));
  out.events = normalizeEvents(s.events, memberIds);
  // Every camp has its own account (camps from before then get one, empty, so no balance moves).
  out.events.forEach((e) => ensureCampAccount(out, e));
  // An entry linked to an event that no longer exists is an ordinary entry again.
  const eventIds = new Set(out.events.map((e) => e.id));
  out.tx.forEach((t) => {
    if (t.eventId && !eventIds.has(t.eventId)) delete t.eventId;
  });
  out.fees = normalizeFees(s.fees, out);
  moveEventFees(out);
  // Links to a member or fee that no longer exists are dropped, as for events. A cotisation is paid
  // toward its event, so an event with one is also a fee.
  const feeIds = new Set([
    ...out.fees.map((f) => f.id),
    ...out.events.filter((e) => e.cotisation).map((e) => e.id),
  ]);
  out.tx.forEach((t) => {
    if (t.memberId && !memberIds.has(t.memberId)) delete t.memberId;
    if (t.paidBy && !memberIds.has(t.paidBy)) delete t.paidBy;
    if (t.feeId && !feeIds.has(t.feeId)) delete t.feeId;
  });
  out.lastExport = typeof s.lastExport === 'string' ? s.lastExport : null;
  delete out.exportedAt;
  return out;
}

/** Parses saved or imported text into a state, or returns null if it is not usable scouts data. */
export function parseState(raw) {
  try {
    const s = JSON.parse(raw);
    return isValid(s) ? normalize(s) : null;
  } catch (e) {
    return null;
  }
}

/* Saved data that could not be read is copied here, so starting over never destroys it. */
export const RESCUE_KEY = KEY + '.unreadable';

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return blankState();
  }
  if (!raw) return blankState();
  const s = parseState(raw);
  if (s) return s;
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

/* True when the last save failed, for example because storage is full or blocked. */
export let saveFailed = false;

/* True when the last change was dropped because another copy of the app had saved since (see save). */
export let saveConflict = false;

/* When the data in storage was saved, read from its text without parsing all of it. */
const storedStamp = (raw) => {
  const m = /"savedAt":(\d+)/.exec(raw || '');
  return m ? +m[1] : 0;
};

let knownStamp = 0;

/** Takes newer data from storage if another copy of the app saved since this one looked. */
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
 * so this copy takes the newer data instead, drops its own last change and reports a conflict.
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
