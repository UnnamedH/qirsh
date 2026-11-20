/* Home: the group's funds, what they hold in total, and the latest entries. */
import { accounts } from '../../../js/core/accounts.js';
import { balances, combinedUSD } from '../../../js/core/ledger.js';
import { fmt } from '../../../js/core/money.js';
import { $, esc } from '../../../js/util.js';
import { state } from '../state.js';
import { fmtDisp, txRow } from '../ui/format.js';

export function renderHome() {
  const b = balances(state),
    list = accounts(state);
  const all = list.reduce((s, a) => ({ USD: s.USD + b[a.id].USD, LBP: s.LBP + b[a.id].LBP }), {
    USD: 0,
    LBP: 0,
  });
  let h =
    '<section class="balance" aria-label="Total of all funds"><div class="balance-head"><span class="label">' +
    esc(state.group.name || 'Group funds') +
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
