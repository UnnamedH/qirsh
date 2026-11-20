/* Events: camps, outings and activities, each with what it cost, what it brought in and its budget. */
import { eventBudget, eventOf, eventTotals } from '../../../js/core/events.js';
import { catName } from '../../../js/core/ledger.js';
import { fmt } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { $, MONTHS, esc, parseYmd } from '../../../js/util.js';
import { state } from '../state.js';
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
  let h =
    '<div class="btn-row"><button class="btn primary" data-act="newEvent">New event</button></div>' +
    '<section class="sec"><h2>Coming up and running</h2><div class="list">' +
    (open.length
      ? open.map(eventCard).join('')
      : '<p class="empty">Add a camp, an outing or an activity to see what it costs and brings in.</p>') +
    '</div></section>';
  if (done.length)
    h +=
      '<section class="sec"><h2>Finished</h2><div class="list">' +
      done.map(eventCard).join('') +
      '</div></section>';
  return h;
}

function renderEvent(e) {
  const cur = state.settings.display,
    t = eventTotals(state, e.id, cur),
    b = eventBudget(state, e);
  let h =
    '<div class="acct-head"><button class="icon-btn" data-act="eventsAll" aria-label="Back to all events">' +
    ICON.left +
    '</button><div class="acct-name"><h2>' +
    esc(e.name) +
    '</h2><p>' +
    esc(eventDates(e) || 'No dates') +
    (e.closed ? ' · Finished' : '') +
    '</p></div><button class="btn sm" data-act="editEvent" data-id="' +
    esc(e.id) +
    '">Edit</button></div>';
  h +=
    '<div class="stats"><div class="stat"><span class="label">Spent</span><span class="amt priv">' +
    fmtTotal(t.spent) +
    '</span></div><div class="stat"><span class="label">Brought in</span><span class="amt in priv">' +
    fmtTotal(t.earned) +
    '</span></div><div class="stat"><span class="label">Net</span><span class="amt priv">' +
    fmtTotal(t.net, { sign: true }) +
    '</span></div></div>';
  if (b)
    h +=
      '<div class="list"><div class="budget"><div class="b-top"><span class="b-name"><span>Budget</span></span><span class="b-nums priv">' +
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
      '</span></div></div></div>';
  if (!e.closed)
    h +=
      '<div class="btn-row"><button class="btn primary" data-act="new" data-v="expense" data-event="' +
      esc(e.id) +
      '">Add expense</button><button class="btn" data-act="new" data-v="income" data-event="' +
      esc(e.id) +
      '">Add income</button></div>';
  const cats = Object.entries(t.byCat).sort((x, y) => y[1] - x[1]);
  if (cats.length)
    h +=
      '<section class="sec"><h2>Where the money went</h2><div class="list">' +
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
      '</div></section>';
  const txs = state.tx
    .filter((x) => x.eventId === e.id)
    .sort((a, c) => c.date.localeCompare(a.date) || (c.createdAt || 0) - (a.createdAt || 0));
  h +=
    '<section class="sec"><h2>Entries</h2><div class="list">' +
    (txs.length
      ? txs.map((x) => txRow(x, true)).join('')
      : '<p class="empty">No entries for this event yet.</p>') +
    '</div></section>';
  return h;
}

export function renderEvents() {
  const e = eventOf(state, eventView || undefined);
  $('#v-events').innerHTML = e ? renderEvent(e) : renderList();
}
