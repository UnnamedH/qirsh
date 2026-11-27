/* History view. */
import { ICON } from '../icons.js';
import { balances, catOf, compareMonth, inRange, monthlyTrend, spendByCategory, sumIn } from '../ledger.js';
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
      ['trends', 'Trends'],
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
    h += hasPlus()
      ? spendingChart(r, acc)
      : plusTeaser('Spending by category', 'See where this month’s money went, as a chart.');
    $('#v-history').innerHTML = h;
    return;
  }
  if (hist.mode === 'trends') {
    h += hasPlus()
      ? trendsView(m, acc)
      : plusTeaser(
          'Trends',
          'See how your spending moves from month to month, and what changed since last month.',
        );
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
    '<input class="input search" id="hq" type="search" autocomplete="off" placeholder="Search notes…" value="' +
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
const plusTeaser = (title, text) =>
  '<div class="card plus-teaser"><h3>' +
  title +
  '</h3><p class="note">' +
  text +
  ' It’s part of Frata Plus.</p>' +
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

const catLabel = (id) => {
  const c = id && catOf(id);
  return c ? (c.icon ? c.icon + ' ' : '') + c.name : 'Uncategorised';
};

/* Spending month by month, ending with the month shown: bars, then the numbers as text (the bars are only
   a picture), how this month compares with last, and the categories that moved most. The month still going
   on is drawn lighter and marked "so far", and is left out of the average. */
function trendsView(m, acc) {
  const cur = dispCur();
  const span = hist.span === 12 ? 12 : 6;
  const cat = hist.cat && catOf(hist.cat) ? hist.cat : null;
  const { months, average } = monthlyTrend(m, span, cur, { catId: cat, account: acc });
  const cmp = compareMonth(m, cur, { catId: cat, account: acc });
  const max = Math.max(...months.map((x) => x.spent));
  const spendCats = state.categories.filter((c) => c.type !== 'income');
  const short = (d) => MONTHS[d.getMonth()].slice(0, 3);
  const tail = (d) => (d.getFullYear() !== m.getFullYear() ? ' ' + d.getFullYear() : '');
  let h =
    '<div class="card trends"><div class="trend-head"><div class="seg" role="group" aria-label="Months shown">' +
    [6, 12]
      .map(
        (n) =>
          '<button data-act="tspan" data-v="' +
          n +
          '" aria-pressed="' +
          (span === n) +
          '">' +
          n +
          ' months</button>',
      )
      .join('') +
    '</div><select class="input" id="tcat" aria-label="Category"><option value="">All spending</option>' +
    spendCats
      .map(
        (c) =>
          '<option value="' +
          esc(c.id) +
          '"' +
          (c.id === cat ? ' selected' : '') +
          '>' +
          (c.icon ? esc(c.icon) + ' ' : '') +
          esc(c.name) +
          '</option>',
      )
      .join('') +
    '</select></div>';
  if (!(max > 0)) return h + '<p class="empty">Nothing spent in these months.</p></div>';
  h +=
    '<div class="trend-bars" aria-hidden="true">' +
    months
      .map(
        (x) =>
          '<div class="trend-col' +
          (x.partial ? ' partial' : '') +
          (x.empty ? ' none' : '') +
          '"><div class="trend-bar" style="height:' +
          Math.max(x.spent > 0 ? 3 : 0, Math.round((x.spent / max) * 100)) +
          '%"></div><span>' +
          short(x.start) +
          '</span></div>',
      )
      .join('') +
    '</div>';
  h += '<div class="trend-facts">';
  if (average != null)
    h +=
      '<div><span class="label">Average a month</span><span class="amt priv">' +
      fmtTotal(average) +
      '</span></div>';
  const diff = cmp.now - cmp.before;
  const name = (d) => MONTHS[d.getMonth()];
  const prev = new Date(m.getFullYear(), m.getMonth() - 1, 1);
  h +=
    '<div><span class="label">' +
    (cmp.partial ? 'So far this month' : name(m)) +
    '</span><span class="amt priv">' +
    fmtTotal(cmp.now) +
    '</span><span class="trend-diff priv ' +
    (diff > 0.005 ? 'up' : diff < -0.005 ? 'down' : '') +
    '">' +
    (Math.abs(diff) <= 0.005
      ? 'same as '
      : fmtTotal(Math.abs(diff)) + (diff > 0 ? ' more than ' : ' less than ')) +
    (cmp.partial ? 'the same days of ' : '') +
    name(prev) +
    '</span></div></div>';
  h += '</div>';
  // The numbers as text, newest first. Months before the first entry are left out.
  h +=
    '<div class="list trend-list">' +
    months
      .filter((x) => !x.empty)
      .reverse()
      .map(
        (x) =>
          '<div class="row"><span class="row-main"><span class="row-title">' +
          short(x.start) +
          tail(x.start) +
          (x.partial ? ' <span class="muted">(so far)</span>' : '') +
          '</span></span><span class="amt priv">' +
          fmtTotal(x.spent) +
          '</span>' +
          // Months with no income leave the spot empty, so the column of what was earned stays readable.
          (x.earned == null
            ? ''
            : '<span class="amt in priv">' + (x.earned > 0 ? '+' + fmtTotal(x.earned) : '') + '</span>') +
          '</div>',
      )
      .join('') +
    '</div>';
  if (!cat && cmp.changes.length)
    h +=
      '<div class="sec"><h3 class="terms-h">Biggest changes' +
      (cmp.partial ? ' so far' : '') +
      '</h3><div class="list">' +
      cmp.changes
        .map((c) => {
          const d = c.now - c.before;
          return (
            '<div class="row"><span class="row-main"><span class="row-title">' +
            esc(catLabel(c.id)) +
            '</span><span class="row-sub priv">' +
            fmtTotal(c.before) +
            ' → ' +
            fmtTotal(c.now) +
            '</span></span><span class="amt priv trend-diff ' +
            (d > 0 ? 'up' : 'down') +
            '">' +
            (d > 0 ? '+' : '−') +
            fmtTotal(Math.abs(d)) +
            '</span></div>'
          );
        })
        .join('') +
      '</div></div>';
  return h;
}
