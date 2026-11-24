/* Home: the unité's funds, the caisse générale this year, and the latest entries. */
import { accounts } from '../../../js/core/accounts.js';
import { balances, combinedUSD } from '../../../js/core/ledger.js';
import { fmt } from '../../../js/core/money.js';
import { $, esc } from '../../../js/util.js';
import { state } from '../state.js';
import { generalTotals, withCotisations } from '../../../js/core/events.js';
import { outstandingUSD } from '../../../js/core/fees.js';
import { fmtDisp, fmtTotal, txRow } from '../ui/format.js';

export function renderHome() {
  const b = balances(state),
    list = accounts(state);
  const all = list.reduce((s, a) => ({ USD: s.USD + b[a.id].USD, LBP: s.LBP + b[a.id].LBP }), {
    USD: 0,
    LBP: 0,
  });
  let h =
    '<section class="balance" aria-label="Total of all funds"><div class="balance-head"><span class="label">' +
    esc(state.group.name || 'Your unité') +
    '</span></div><button class="balance-total priv" data-act="toggleDisplay" title="Switch currency">' +
    fmtDisp(combinedUSD(all, state.rate)) +
    '<small>in all funds</small></button><div class="balance-split priv"><span>' +
    fmt(all.USD, 'USD') +
    '<em>in dollars</em></span><span>' +
    fmt(all.LBP, 'LBP') +
    '<em>in lira</em></span></div></section>';
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
  // The caisse générale: the year's spending and income outside every camp. Each entry at its own rate.
  const year = new Date().getFullYear(),
    g = generalTotals(
      state,
      { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) },
      state.settings.display,
    );
  h +=
    '<section class="sec"><div class="sec-head"><h2>Caisse générale ' +
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
      '<div class="list"><div class="row"><button class="row-btn" data-act="nav" data-v="members"><span class="row-main"><span class="row-title">Cotisations still owed</span><span class="row-sub">By camp attendees</span></span><span class="amt priv">' +
      fmtDisp(owed) +
      '</span></button></div></div>';
  h +=
    '<div class="btn-row"><button class="btn primary" data-act="new" data-v="expense">Expense</button>' +
    '<button class="btn" data-act="new" data-v="income">Income</button>' +
    '<button class="btn" data-act="new" data-v="transfer">Move money</button></div>';
  const recent = state.tx
    .slice()
    .sort((a, c) => c.date.localeCompare(a.date) || (c.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6);
  h +=
    '<section class="sec"><h2>Latest</h2><div class="list">' +
    (recent.length
      ? recent.map((t) => txRow(t)).join('')
      : '<p class="empty">Add your first expense or income and it shows up here.</p>') +
    '</div></section>';
  $('#v-home').innerHTML = h;
}
