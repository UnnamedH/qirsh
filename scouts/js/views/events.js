/* Events: camps, outings and activities, each with what it cost, what it brought in and its budget. */
import {
  cotisationFee,
  eventBudget,
  eventOf,
  eventTotals,
  withCotisations,
} from '../../../js/core/events.js';
import { feeStatus, memberOf } from '../../../js/core/fees.js';
import { balances, catName } from '../../../js/core/ledger.js';
import { fmt } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { $, MONTHS, esc, parseYmd } from '../../../js/util.js';
import { state } from '../state.js';
import { cotisationCard, cotisationLine, roleLine } from '../ui/cotisation.js';
import { fold } from '../ui/fold.js';
import { fmtTotal, txRow } from '../ui/format.js';
import { eventView } from '../ui/ui-state.js';

const shortDate = (s) => {
  const d = parseYmd(s);
  return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
};

/** "3 Jul 2026 – 10 Jul 2026", one date, or nothing. */
export function eventDates(e) {
  if (e.start && e.end && e.end !== e.start) return shortDate(e.start) + ' – ' + shortDate(e.end);
  return e.start ? shortDate(e.start) : e.end ? 'Until ' + shortDate(e.end) : '';
}

/* Newest first by start date; events without one go last, newest added first. */
const byDate = (a, b) =>
  (b.start || '').localeCompare(a.start || '') || (b.createdAt || 0) - (a.createdAt || 0);

/** One event in the list: name, dates, and its budget bar or its net result. */
function eventCard(e) {
  const t = eventTotals(state, e.id, state.settings.display),
    b = eventBudget(state, e);
  const pill = e.closed
    ? '<span class="pill">Finished</span>'
    : b && b.state === 'over'
      ? '<span class="pill over">Over</span>'
      : b && b.state === 'warn'
        ? '<span class="pill warn">' + Math.round(b.pct * 100) + '%</span>'
        : '';
  const nums = b
    ? fmt(b.spent, e.budget.currency, { round: true }) +
      ' <span class="muted">/ ' +
      fmt(b.limit, e.budget.currency) +
      '</span>'
    : fmtTotal(t.spent) + ' <span class="muted">spent</span>';
  return (
    '<button class="budget" data-act="eventView" data-id="' +
    esc(e.id) +
    '"><div class="b-top"><span class="b-name"><span>' +
    esc(e.name) +
    '</span>' +
    pill +
    '</span><span class="b-nums priv">' +
    nums +
    '</span></div>' +
    (b
      ? '<div class="bar ' +
        b.state +
        '"><i style="width:' +
        Math.min(100, b.pct * 100).toFixed(1) +
        '%"></i></div>'
      : '') +
    '<div class="b-foot"><span>' +
    esc(eventDates(e) || 'No dates') +
    '</span><span class="priv">' +
    (t.count ? 'Net ' + fmtTotal(t.net, { sign: true }) : 'No entries yet') +
    '</span></div></button>'
  );
}

function renderList() {
  const open = state.events.filter((e) => !e.closed).sort(byDate),
    done = state.events.filter((e) => e.closed).sort(byDate);
  const count = (n) => n + (n === 1 ? ' camp' : ' camps');
  let h =
    '<div class="btn-row"><button class="btn primary" data-act="newEvent">New event</button></div>' +
    fold(
      'evRunning',
      'Coming up and running',
      count(open.length),
      '<div class="list">' +
        (open.length
          ? open.map(eventCard).join('')
          : '<p class="empty">Add a camp, an outing or an activity to see what it costs and brings in.</p>') +
        '</div>',
    );
  if (done.length)
    h += fold(
      'evFinished',
      'Finished',
      count(done.length),
      '<div class="list">' + done.map(eventCard).join('') + '</div>',
    );
  return h;
}

/*
 * Who attends, and with a cotisation, where each of them stands on it: who still owes first, so the
 * list works as a to-do at the start of the camp.
 */
function attendance(e) {
  const fee = cotisationFee(e),
    people = (e.attendees || []).map((id) => memberOf(state, id)).filter(Boolean);
  const title = 'Attending (' + people.length + ')',
    section = (summary, body) => fold('evAttending', title, summary, body);
  if (!people.length)
    return section(
      '',
      '<div class="list"><p class="empty">Edit the event to tick who is attending' +
        (fee ? ', then record their cotisation here.' : '.') +
        '</p></div>',
    );
  if (!fee)
    return section(
      '',
      '<div class="list">' +
        people
          .map(
            (m) =>
              '<div class="row"><span class="row-main"><span class="row-title">' +
              esc(m.name) +
              '</span><span class="row-sub">' +
              esc(roleLine(m)) +
              '</span></span></div>',
          )
          .join('') +
        '</div>',
    );
  const s = withCotisations(state),
    order = { unpaid: 0, part: 1, paid: 2 };
  const st = feeStatus(s, fee);
  const rows = st.members
    .map((x) => ({ x, m: memberOf(state, x.memberId) }))
    .filter((r) => r.m)
    .sort((a, c) => order[a.x.state] - order[c.x.state] || a.m.name.localeCompare(c.m.name));
  return section(
    st.paidCount + ' of ' + st.members.length + ' paid',
    '<div class="list">' +
      cotisationCard(s, fee) +
      '</div><div class="list">' +
      rows.map((r) => cotisationLine(fee, r.x, r.m.name, roleLine(r.m))).join('') +
      '</div>',
  );
}

/* What the camp's own account holds now: its cotisations in, its expenses out. */
function campBalance(e) {
  if (!e.accountId || e.closed) return '';
  const b = balances(state)[e.accountId] || { USD: 0, LBP: 0 };
  return (
    '<p class="num priv">' +
    fmt(b.USD, 'USD') +
    (Math.abs(b.LBP) > 0 ? ' · ' + fmt(b.LBP, 'LBP') : '') +
    ' in the camp’s account</p>'
  );
}

/**
 * An event's page: its totals, who attends and their cotisation, its budget and its entries. On Home,
 * where it is one of the tabs, it has no way back to the list (`inHome`).
 */
export function eventPage(e, inHome = false) {
  const cur = state.settings.display,
    t = eventTotals(state, e.id, cur),
    b = eventBudget(state, e);
  let h =
    '<div class="acct-head">' +
    (inHome
      ? ''
      : '<button class="icon-btn" data-act="eventsAll" aria-label="Back to all events">' +
        ICON.left +
        '</button>') +
    '<div class="acct-name"><h2>' +
    esc(e.name) +
    '</h2><p>' +
    esc(eventDates(e) || 'No dates') +
    (e.closed ? ' · Finished' : '') +
    '</p>' +
    campBalance(e) +
    '</div><button class="btn sm" data-act="editEvent" data-id="' +
    esc(e.id) +
    '">Edit</button></div>';
  h += fold(
    'evTotals',
    'Totals',
    '<span class="priv">Net ' + fmtTotal(t.net, { sign: true }) + '</span>',
    '<div class="stats"><div class="stat"><span class="label">Spent</span><span class="amt priv">' +
      fmtTotal(t.spent) +
      '</span></div><div class="stat"><span class="label">Brought in</span><span class="amt in priv">' +
      fmtTotal(t.earned) +
      '</span></div><div class="stat"><span class="label">Net</span><span class="amt priv">' +
      fmtTotal(t.net, { sign: true }) +
      '</span></div></div>',
  );
  h += attendance(e);
  if (b)
    h += fold(
      'evBudget',
      'Budget',
      '<span class="priv">' +
        fmt(b.spent, e.budget.currency, { round: true }) +
        ' / ' +
        fmt(b.limit, e.budget.currency) +
        '</span>',
      '<div class="list"><div class="budget"><div class="b-top"><span class="b-name"><span>Spent</span></span><span class="b-nums priv">' +
        fmt(b.spent, e.budget.currency, { round: true }) +
        ' <span class="muted">/ ' +
        fmt(b.limit, e.budget.currency) +
        '</span></span></div><div class="bar ' +
        b.state +
        '"><i style="width:' +
        Math.min(100, b.pct * 100).toFixed(1) +
        '%"></i></div><div class="b-foot"><span class="priv">' +
        (b.left >= 0
          ? fmt(b.left, e.budget.currency, { round: true }) + ' left'
          : fmt(-b.left, e.budget.currency, { round: true }) + ' over') +
        '</span></div></div></div>',
    );
  if (!e.closed)
    h +=
      '<div class="btn-row"><button class="btn primary" data-act="new" data-v="expense" data-event="' +
      esc(e.id) +
      '">Add expense</button><button class="btn" data-act="new" data-v="income" data-event="' +
      esc(e.id) +
      '">Add income</button></div>';
  const cats = Object.entries(t.byCat).sort((x, y) => y[1] - x[1]);
  if (cats.length)
    h += fold(
      'evSpend',
      'Where the money went',
      '<span class="priv">' + esc(catName(state, cats[0][0])) + ' ' + fmtTotal(cats[0][1]) + '</span>',
      '<div class="list">' +
        cats
          .map(
            ([id, v]) =>
              '<div class="row"><span class="row-main"><span class="row-title">' +
              esc(catName(state, id)) +
              '</span></span><span class="amt priv">' +
              fmtTotal(v) +
              '</span></div>',
          )
          .join('') +
        '</div>',
    );
  const txs = state.tx
    .filter((x) => x.eventId === e.id)
    .sort((a, c) => c.date.localeCompare(a.date) || (c.createdAt || 0) - (a.createdAt || 0));
  h += fold(
    'evEntries',
    'Entries',
    txs.length + (txs.length === 1 ? ' entry' : ' entries'),
    '<div class="list">' +
      (txs.length
        ? txs.map((x) => txRow(x, { event: true })).join('')
        : '<p class="empty">No entries for this event yet.</p>') +
      '</div>',
  );
  return h;
}

export function renderEvents() {
  const e = eventOf(state, eventView || undefined);
  $('#v-events').innerHTML = e ? eventPage(e) : renderList();
}
