/* History view. */
import { ICON } from '../icons.js';
import { balances, catOf, inRange, spendByCategory, sumIn } from '../ledger.js';
import { dispCur, entryValueIn, fmt, fmtTotal } from '../money.js';
import { accName } from '../accounts.js';
import { hasPlus } from '../plus.js';
import { state } from '../state.js';
import { rowSub, txAmt, txGlyph, txTitle } from '../ui/format.js';
import { hist } from '../ui/ui-state.js';
import { $, MONTHS, dayLabel, esc } from '../util.js';

const monthRange = (m) => ({ start: m, end: new Date(m.getFullYear(), m.getMonth() + 1, 1) });

/** Entries for the month, filter and search shown in History, newest first. */
export function historyTxs() {
  const r = monthRange(hist.month);
  const q = hist.q.trim().toLowerCase();
  let txs = state.tx.filter((t) => inRange(t, r) && histMatch(t));
  if (q)
    txs = txs.filter(
      (t) =>
        (t.note || '').toLowerCase().includes(q) ||
        txTitle(t).toLowerCase().includes(q) ||
        (String(t.amount) + ' ' + (t.amount2 || '')).includes(q),
    );
  return txs.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

export function renderHistory() {
  const m = hist.month;
  const r = monthRange(m);
  const txs = historyTxs();
  const acc = hist.account;
  const spent = sumIn(r, 'expense', null, dispCur(), acc),
    inc = sumIn(r, 'income', null, dispCur(), acc);
  let h = acc ? accountHead(acc) : '';
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
    '<div class="seg wide" role="tablist" aria-label="Show">' +
    [
      ['list', 'List'],
      ['chart', 'By category'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="hmode" data-v="' +
          k +
          '" aria-pressed="' +
          (hist.mode === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div>';
  if (hist.mode === 'chart') {
    h += hasPlus() ? spendingChart(r, acc) : plusTeaser();
    $('#v-history').innerHTML = h;
    return;
  }
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
  // The monthly report covers every account, so it's offered only on the full History, after the list.
  if (!acc)
    h +=
      '<div class="btn-row"><button class="btn sm" data-act="reportXlsx">Monthly report (Excel)</button>' +
      '<button class="btn sm ghost" data-act="reportCsv">Entries (CSV)</button></div>';
  $('#v-history').innerHTML = h;
}

/* An account's page: its balance now, and the one action that belongs to the account itself. */
function accountHead(id) {
  const b = balances()[id] || { USD: 0, LBP: 0 };
  return (
    '<div class="acct-head"><button class="icon-btn" data-act="accAll" aria-label="Back to Home">' +
    ICON.left +
    '</button><div class="acct-name"><h2>' +
    esc(accName(id)) +
    '</h2><p class="num priv">' +
    fmt(b.USD, 'USD') +
    (Math.abs(b.LBP) > 0 ? ' · ' + fmt(b.LBP, 'LBP') : '') +
    '</p></div><button class="btn sm" data-act="newAdjust" data-v="' +
    esc(id) +
    '">Correct balance</button></div>'
  );
}

/* Money moved in or out of an account, or spent or earned in it. An exchange stays in one account. */
const inAccount = (t, id) =>
  t.type === 'transfer' ? t.from === id || t.to === id : (t.account || 'wallet') === id;

/* Paying for others, paybacks and balance-only corrections are not spending or income, so they sit
   under Moves. */
const histMatch = (t) =>
  (!hist.account || inAccount(t, hist.account)) &&
  (hist.filter === 'all' ||
    t.type === hist.filter ||
    (hist.filter === 'transfer' && (t.type === 'advance' || t.type === 'repay' || t.type === 'adjust')));

export function historyList(txs) {
  if (!txs.length)
    return (
      '<div class="list"><p class="empty">Nothing here for ' +
      (hist.account ? esc(accName(hist.account)) + ' ' : '') +
      'this month.</p></div>'
    );
  let h = '',
    cur = null,
    group = [];
  const flush = () => {
    if (!group.length) return;
    let out = 0;
    group.forEach((t) => {
      if (t.type === 'expense') out += entryValueIn(t, dispCur());
    });
    h +=
      '<div class="day-head"><span>' +
      dayLabel(cur) +
      '</span><span class="num">' +
      (out ? fmtTotal(out) : '') +
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

/* In place of the chart while Plus is locked: what it would show, and the way in. */
const plusTeaser = () =>
  '<div class="card plus-teaser"><h3>Spending by category</h3>' +
  '<p class="note">See where this month’s money went, as a chart. It’s part of Frata Plus.</p>' +
  '<div class="btn-row"><button class="btn primary" data-act="plusOpen">Get Frata Plus</button></div></div>';

/* Slices beyond this many are added up as "Everything else", so the chart stays readable. */
const SLICES = 6;

/* The month's spending as a ring split by category, biggest first, with a legend. Each slice is a
   circle drawn as a dash of its share of the ring (a circle of circumference 100), like the budget rings. */
function spendingChart(r, acc) {
  const cur = dispCur();
  let parts = spendByCategory(r, cur, acc);
  if (!parts.length) return '<div class="list"><p class="empty">No spending this month.</p></div>';
  if (parts.length > SLICES + 1)
    parts = parts
      .slice(0, SLICES)
      .concat([{ id: 'rest', total: parts.slice(SLICES).reduce((s, x) => s + x.total, 0) }]);
  const total = parts.reduce((s, x) => s + x.total, 0);
  const label = (id) => {
    if (id === 'rest') return 'Everything else';
    const c = id && catOf(id);
    return c ? (c.icon ? c.icon + ' ' : '') + c.name : 'Uncategorised';
  };
  let at = 0;
  const slices = parts
    .map((x, i) => {
      const share = (x.total / total) * 100;
      const dash =
        '<circle class="pie-' +
        (x.id === 'rest' ? 'rest' : i) +
        '" cx="21" cy="21" r="15.9155" stroke-dasharray="' +
        share.toFixed(3) +
        ' ' +
        (100 - share).toFixed(3) +
        '" stroke-dashoffset="' +
        (25 - at).toFixed(3) +
        '"/>';
      at += share;
      return dash;
    })
    .join('');
  return (
    '<div class="card pie-card"><div class="pie"><svg viewBox="0 0 42 42" role="img" aria-label="Spending by category">' +
    slices +
    '</svg><div class="pie-total"><span class="label">Spent</span><strong class="amt priv">' +
    fmtTotal(total) +
    '</strong></div></div><div class="pie-legend">' +
    parts
      .map(
        (x, i) =>
          '<div class="pie-row"><i class="pie-dot pie-' +
          (x.id === 'rest' ? 'rest' : i) +
          '"></i><span class="pie-name">' +
          esc(label(x.id)) +
          '</span><span class="amt priv">' +
          fmtTotal(x.total) +
          '</span><span class="pie-pct">' +
          Math.round((x.total / total) * 100) +
          '%</span></div>',
      )
      .join('') +
    '</div></div>'
  );
}
