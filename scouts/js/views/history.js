/* History: every entry for a month, with a filter and an optional single fund. */
import { accName } from '../../../js/core/accounts.js';
import { balances, inRange, sumIn } from '../../../js/core/ledger.js';
import { fmt } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { $, MONTHS, esc } from '../../../js/util.js';
import { state } from '../state.js';
import { fmtTotal, txRow } from '../ui/format.js';
import { hist } from '../ui/ui-state.js';

const monthRange = (m) => ({ start: m, end: new Date(m.getFullYear(), m.getMonth() + 1, 1) });

/* Money moved in or out of a fund, or spent or earned from it. An exchange stays in one fund. */
const inAccount = (t, id) =>
  t.type === 'transfer' ? t.from === id || t.to === id : (t.account || 'wallet') === id;

const matches = (t) =>
  (!hist.account || inAccount(t, hist.account)) &&
  (hist.filter === 'all' ||
    (hist.filter === 'move' ? t.type === 'transfer' || t.type === 'adjust' : t.type === hist.filter));

/** The entries shown for the chosen month, filter and fund, newest first. */
export function historyTxs() {
  const r = monthRange(hist.month);
  return state.tx
    .filter((t) => inRange(t, r) && matches(t))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

export function renderHistory() {
  const m = hist.month,
    r = monthRange(m),
    txs = historyTxs(),
    acc = hist.account;
  const spent = sumIn(state, r, 'expense', null, state.settings.display, acc),
    inc = sumIn(state, r, 'income', null, state.settings.display, acc);
  let h = '';
  if (acc) {
    const b = balances(state)[acc] || { USD: 0, LBP: 0 };
    h +=
      '<div class="acct-head"><button class="icon-btn" data-act="accAll" aria-label="Back to all funds">' +
      ICON.left +
      '</button><div class="acct-name"><h2>' +
      esc(accName(state, acc)) +
      '</h2><p class="num priv">' +
      fmt(b.USD, 'USD') +
      (Math.abs(b.LBP) > 0 ? ' · ' + fmt(b.LBP, 'LBP') : '') +
      '</p></div><button class="btn sm" data-act="newAdjust" data-v="' +
      esc(acc) +
      '">Correct balance</button></div>';
  }
  h +=
    '<div class="month-switch"><button class="icon-btn" data-act="month" data-v="-1" aria-label="Previous month">' +
    ICON.left +
    '</button><strong>' +
    MONTHS[m.getMonth()] +
    ' ' +
    m.getFullYear() +
    '</strong><button class="icon-btn" data-act="month" data-v="1" aria-label="Next month">' +
    ICON.right +
    '</button></div>';
  h +=
    '<div class="stats"><div class="stat"><span class="label">Spent</span><span class="amt">' +
    fmtTotal(spent) +
    '</span></div><div class="stat"><span class="label">Earned</span><span class="amt in">' +
    fmtTotal(inc) +
    '</span></div><div class="stat"><span class="label">Entries</span><span class="amt">' +
    txs.length +
    '</span></div></div>';
  h +=
    '<div class="filters"><div class="seg">' +
    [
      ['all', 'All'],
      ['expense', 'Out'],
      ['income', 'In'],
      ['move', 'Moves'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="hfilter" data-v="' +
          k +
          '" aria-pressed="' +
          (hist.filter === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div></div>';
  h +=
    '<div class="list">' +
    (txs.length ? txs.map((t) => txRow(t)).join('') : '<p class="empty">Nothing here for this month.</p>') +
    '</div>';
  $('#v-history').innerHTML = h;
}
