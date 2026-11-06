/* History view. */
import { ICON } from '../icons.js';
import { inRange, sumUSD } from '../ledger.js';
import { fmtDisp, txCostUSD } from '../money.js';
import { state } from '../state.js';
import { rowSub, txAmt, txGlyph, txTitle } from '../ui/format.js';
import { hist } from '../ui/ui-state.js';
import { $, MONTHS, dayLabel, esc } from '../util.js';

export function renderHistory() {
  const m = hist.month;
  const r = { start: m, end: new Date(m.getFullYear(), m.getMonth() + 1, 1) };
  const q = hist.q.trim().toLowerCase();
  let txs = state.tx.filter((t) => inRange(t, r) && histMatch(t));
  if (q)
    txs = txs.filter(
      (t) =>
        (t.note || '').toLowerCase().includes(q) ||
        txTitle(t).toLowerCase().includes(q) ||
        (String(t.amount) + ' ' + (t.amount2 || '')).includes(q),
    );
  txs.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const spent = sumUSD(r, 'expense'),
    inc = sumUSD(r, 'income');
  let h =
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
    fmtDisp(spent) +
    '</span></div><div class="stat"><span class="label">Earned</span><span class="amt in">' +
    fmtDisp(inc) +
    '</span></div><div class="stat"><span class="label">Entries</span><span class="amt">' +
    txs.length +
    '</span></div></div>';
  h +=
    '<div class="filters"><div class="seg">' +
    [
      ['all', 'All'],
      ['expense', 'Out'],
      ['income', 'In'],
      ['transfer', 'Moves'],
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
    '</div>' +
    '<input class="input search" id="hq" type="search" placeholder="Search notes" value="' +
    esc(hist.q) +
    '" aria-label="Search notes"></div>';
  h += '<div id="histList">' + historyList(txs) + '</div>';
  $('#v-history').innerHTML = h;
}

/* Paying for others and paybacks are money moves, not spending or income, so they sit under Moves. */
export const histMatch = (t) =>
  hist.filter === 'all' ||
  t.type === hist.filter ||
  (hist.filter === 'transfer' && (t.type === 'advance' || t.type === 'repay'));

export function historyList(txs) {
  if (!txs.length) return '<div class="list"><p class="empty">Nothing here for this month.</p></div>';
  let h = '',
    cur = null,
    group = [];
  const flush = () => {
    if (!group.length) return;
    let out = 0;
    group.forEach((t) => {
      if (t.type === 'expense') out += txCostUSD(t);
    });
    h +=
      '<div class="day-head"><span>' +
      dayLabel(cur) +
      '</span><span class="num">' +
      (out ? fmtDisp(out) : '') +
      '</span></div><div class="list">' +
      group
        .map(
          (t) =>
            '<button class="row" data-act="editTx" data-id="' +
            esc(t.id) +
            '">' +
            txGlyph(t) +
            '<span class="row-main"><span class="row-title">' +
            esc(t.note || txTitle(t)) +
            '</span><span class="row-sub">' +
            esc(rowSub(t)) +
            '</span></span>' +
            txAmt(t) +
            '</button>',
        )
        .join('') +
      '</div>';
    group = [];
  };
  txs.forEach((t) => {
    if (t.date !== cur) {
      flush();
      cur = t.date;
    }
    group.push(t);
  });
  flush();
  return h;
}
