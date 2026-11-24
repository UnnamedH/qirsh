/* Home: a tab for the caisse and one for each open camp. The caisse tab has the unité's general funds,
   the year's caisse totals and its latest entries; a camp's tab is that camp's page. */
import { accounts } from '../../../js/core/accounts.js';
import { generalTotals, withCotisations } from '../../../js/core/events.js';
import { outstandingUSD } from '../../../js/core/fees.js';
import { balances, combinedUSD } from '../../../js/core/ledger.js';
import { fmt } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { $, esc } from '../../../js/util.js';
import { campAccountIds } from '../camps.js';
import { state } from '../state.js';
import { fmtDisp, fmtTotal, txRow } from '../ui/format.js';
import { homeTab } from '../ui/ui-state.js';
import { eventPage } from './events.js';

/* The open camps, soonest first; camps on the same day, or without dates (last), in the order added. */
export const openCamps = () =>
  state.events
    .filter((e) => !e.closed)
    .sort(
      (a, b) => (a.start || '9').localeCompare(b.start || '9') || (a.createdAt || 0) - (b.createdAt || 0),
    );

/** The tab Home shows: the one picked, unless that camp has since finished or gone. */
export const currentHomeTab = () => (openCamps().some((e) => e.id === homeTab) ? homeTab : 'caisse');

function tabs(current) {
  const camps = openCamps();
  if (!camps.length) return '';
  const tab = (id, label) =>
    '<button data-act="homeTab" data-v="' +
    esc(id) +
    '" aria-pressed="' +
    (current === id) +
    '">' +
    esc(label) +
    '</button>';
  return (
    '<div class="home-tabs" role="group" aria-label="Show">' +
    tab('caisse', 'Caisse') +
    camps.map((e) => tab(e.id, e.name)).join('') +
    '</div>'
  );
}

function caisse() {
  const b = balances(state),
    camps = campAccountIds(state),
    list = accounts(state).filter((a) => !camps.has(a.id));
  const all = list.reduce((s, a) => ({ USD: s.USD + b[a.id].USD, LBP: s.LBP + b[a.id].LBP }), {
    USD: 0,
    LBP: 0,
  });
  let h =
    '<section class="balance" aria-label="Total of the caisse"><div class="balance-head">' +
    // With no list of funds, the name opens the caisse's page: its entries, and Correct balance.
    (list.length === 1
      ? '<button class="label acc-open" data-act="accView" data-id="' +
        esc(list[0].id) +
        '">' +
        esc(state.group.name || 'Your unité') +
        ICON.right +
        '</button>'
      : '<span class="label">' + esc(state.group.name || 'Your unité') + '</span>') +
    '</div><button class="balance-total priv" data-act="toggleDisplay" title="Switch currency">' +
    fmtDisp(combinedUSD(all, state.rate)) +
    '<small>in the caisse</small></button><div class="balance-split priv"><span>' +
    fmt(all.USD, 'USD') +
    '<em>in dollars</em></span><span>' +
    fmt(all.LBP, 'LBP') +
    '<em>in lira</em></span></div></section>';
  // With the caisse as the only fund, the total above already says what it holds.
  if (list.length > 1)
    h +=
      '<section class="accs"><div class="accounts">' +
      list
        .map((a) => {
          const x = b[a.id];
          return (
            '<button class="acc" data-act="accView" data-id="' +
            esc(a.id) +
            '"><span class="acc-name"><span class="label">' +
            esc(a.name) +
            '</span></span><span class="amt priv" style="text-align:left">' +
            fmt(x.USD, 'USD') +
            '</span><span class="amt sub priv" style="text-align:left">' +
            fmt(x.LBP, 'LBP') +
            '</span></button>'
          );
        })
        .join('') +
      '</div></section>';
  // The year's spending and income outside every camp. Each entry at its own rate.
  const year = new Date().getFullYear(),
    g = generalTotals(
      state,
      { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) },
      state.settings.display,
    );
  h +=
    '<section class="sec"><div class="sec-head"><h2>Caisse ' +
    year +
    '</h2><button class="btn sm ghost" data-act="historyGeneral">See entries</button></div><div class="stats"><div class="stat"><span class="label">Spent</span><span class="amt priv">' +
    fmtTotal(g.spent) +
    '</span></div><div class="stat"><span class="label">Brought in</span><span class="amt in priv">' +
    fmtTotal(g.earned) +
    '</span></div><div class="stat"><span class="label">Net</span><span class="amt priv">' +
    fmtTotal(g.net, { sign: true }) +
    '</span></div></div></section>';
  // What attendees still owe on cotisations: money still to come in, so valued at today's rate.
  const owed = outstandingUSD(withCotisations(state));
  if (owed > 0)
    h +=
      '<div class="list"><div class="row"><button class="row-btn" data-act="nav" data-v="events"><span class="row-main"><span class="row-title">Cotisations still owed</span><span class="row-sub">By camp attendees</span></span><span class="amt priv">' +
      fmtDisp(owed) +
      '</span></button></div></div>';
  h +=
    '<div class="btn-row"><button class="btn primary" data-act="new" data-v="expense">Expense</button>' +
    '<button class="btn" data-act="new" data-v="income">Income</button>' +
    '<button class="btn" data-act="new" data-v="transfer">Move money</button></div>';
  // The caisse's own latest entries: camps' entries are on their tabs.
  const recent = state.tx
    .filter((t) => !t.eventId)
    .sort((a, c) => c.date.localeCompare(a.date) || (c.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6);
  h +=
    '<section class="sec"><h2>Latest</h2><div class="list">' +
    (recent.length
      ? recent.map((t) => txRow(t)).join('')
      : '<p class="empty">Add your first expense or income and it shows up here.</p>') +
    '</div></section>';
  return h;
}

export function renderHome() {
  const current = currentHomeTab(),
    camp = state.events.find((e) => e.id === current);
  $('#v-home').innerHTML = tabs(current) + (camp ? eventPage(camp, true) : caisse());
}
