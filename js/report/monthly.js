/*
 * The monthly report: an Excel workbook with a summary and the detail behind it, and a CSV of the
 * month's entries. Totals use the same rules as the app: paying for others is not spending and
 * paybacks are not income, but the part of an advance you chose to keep counts as spending.
 */
import { owed, paybacksOf } from '../advances.js';
import { accName } from '../config.js';
import { catName, inRange, sumIn, sumUSD } from '../ledger.js';
import { backVec, other, toUSD, txCostUSD } from '../money.js';
import { state } from '../state.js';
import { txTitle } from '../ui/format.js';
import { DAYS, MONTHS, addDays, ymd } from '../util.js';
import { STYLE, workbook } from './xlsx.js';

const monthRange = (m) => ({
  start: new Date(m.getFullYear(), m.getMonth(), 1),
  end: new Date(m.getFullYear(), m.getMonth() + 1, 1),
});
const monthLabel = (m) => MONTHS[m.getMonth()] + ' ' + m.getFullYear();
const monthKey = (m) => m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
const txUSD = (t) => toUSD(t.amount, t.currency);
const round2 = (n) => Math.round(n * 100) / 100;

const TYPE_LABEL = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  advance: 'Paid for others',
  repay: 'Payback',
  adjust: 'Balance correction',
};
const typeLabel = (t) =>
  t.type === 'transfer' && t.from === t.to
    ? 'Exchange'
    : (TYPE_LABEL[t.type] || t.type) + (t.correction ? ' (correction)' : '');

/** Spending per category for a month, including the kept part of closed advances, like sumUSD. */
function spendingByCategory(r) {
  const by = new Map();
  const add = (id, usd) => {
    const e = by.get(id) || { usd: 0, count: 0 };
    e.usd += usd;
    e.count += 1;
    by.set(id, e);
  };
  for (const t of state.tx) {
    if (t.type === 'expense' && inRange(t, r)) add(t.categoryId, txCostUSD(t));
    if (t.type === 'advance' && t.closed && t.keptCat && inRange({ date: t.closedOn || t.date }, r)) {
      const left = owed(t).left;
      if (left > 0) add(t.keptCat, left);
    }
  }
  return by;
}

function incomeByCategory(r) {
  const by = new Map();
  for (const t of state.tx) {
    if (t.type !== 'income' || !inRange(t, r)) continue;
    const e = by.get(t.categoryId) || { usd: 0, count: 0 };
    e.usd += txCostUSD(t);
    e.count += 1;
    by.set(t.categoryId, e);
  }
  return by;
}

/** Everything the report shows for one month, as plain numbers (USD unless the name says LL). */
export function monthlyData(month) {
  const r = monthRange(month);
  const prev = monthRange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const inMonth = (type) => state.tx.filter((t) => t.type === type && inRange(t, r));

  const transfers = inMonth('transfer');
  const intoSavings = transfers.filter((t) => t.to === 'savings' && t.from !== 'savings');
  const outOfSavings = transfers.filter((t) => t.from === 'savings' && t.to !== 'savings');
  const toSavingsUSD = intoSavings.reduce(
    (s, t) => s + toUSD(+t.toAmount || t.amount, t.toCurrency || t.currency),
    0,
  );
  const fromSavingsUSD = outOfSavings.reduce((s, t) => s + txUSD(t), 0);

  const advances = state.tx.filter((t) => t.type === 'advance');
  const monthEnd = ymd(addDays(r.end, -1));

  return {
    month,
    rate: state.rate,
    earned: sumUSD(r, 'income'),
    spent: sumUSD(r, 'expense'),
    prevEarned: sumUSD(prev, 'income'),
    prevSpent: sumUSD(prev, 'expense'),
    toSavings: toSavingsUSD,
    fromSavings: fromSavingsUSD,
    paidForOthers: inMonth('advance').reduce((s, t) => s + owed(t).cost, 0),
    paidBack: inMonth('repay').reduce((s, t) => s + txCostUSD(t), 0),
    stillOwed: advances.filter((t) => !owed(t).settled).reduce((s, t) => s + owed(t).left, 0),
    spending: spendingByCategory(r),
    prevSpending: spendingByCategory(prev),
    income: incomeByCategory(r),
    budgets: state.budgets
      .filter((b) => b.period === 'month')
      .map((b) => {
        // In the budget's own currency, each entry at its own rate, like the Budgets screen.
        const limit = +b.amount;
        const spent = sumIn(r, 'expense', b.categoryId || null, b.currency);
        return {
          name: b.categoryId ? catName(b.categoryId) : 'All spending',
          limit,
          spent,
          currency: b.currency,
        };
      }),
    biggest: inMonth('expense')
      .map((t) => ({ t, usd: txCostUSD(t) }))
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 5),
    days: (() => {
      const out = [];
      for (let d = new Date(r.start); d < r.end; d = addDays(d, 1)) {
        const day = ymd(d);
        const on = (type) => sumUSD({ start: d, end: addDays(d, 1) }, type);
        out.push({ day, dow: DAYS[d.getDay()], spent: on('expense'), earned: on('income') });
      }
      return out;
    })(),
    entries: state.tx
      .filter((t) => inRange(t, r))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0)),
    owedList: advances
      .filter((t) => t.date <= monthEnd)
      .filter((t) => !owed(t).settled || inRange(t, r) || paybacksOf(t.id).some((p) => inRange(p, r)))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/* ---------- Excel ---------- */

const usd = (n, bold) => ({ v: round2(n), s: bold ? STYLE.usdBold : STYLE.usd });
const lbp = (usdValue, bold) => ({
  v: Math.round(usdValue * state.rate),
  s: bold ? STYLE.lbpBold : STYLE.lbp,
});
const pct = (n) => (n == null || !isFinite(n) ? null : { v: n, s: STYLE.percent });
const head = (...cols) => cols.map((v) => ({ v, s: STYLE.header }));
const bold = (v) => ({ v, s: STYLE.bold });
const muted = (v) => ({ v, s: STYLE.muted });
const change = (now, before) => (before > 0 ? (now - before) / before : null);
const share = (part, whole) => (whole > 0 ? part / whole : null);

function summarySheet(d) {
  const net = d.earned - d.spent,
    prevNet = d.prevEarned - d.prevSpent;
  const top = [...d.spending].sort((a, b) => b[1].usd - a[1].usd).slice(0, 5);
  const rows = [
    [{ v: 'Qirsh · ' + monthLabel(d.month), s: STYLE.title }],
    [
      muted(
        'USD amounts use each entry’s own rate. The LL column converts them at 1 USD = ' +
          d.rate.toLocaleString('en-US') +
          ' LL, your rate when this was made.',
      ),
    ],
    [],
    head('', 'USD', 'LL', 'Last month', 'Change'),
    ['Earned', usd(d.earned), lbp(d.earned), usd(d.prevEarned), pct(change(d.earned, d.prevEarned))],
    ['Spent', usd(d.spent), lbp(d.spent), usd(d.prevSpent), pct(change(d.spent, d.prevSpent))],
    [bold('Net (earned − spent)'), usd(net, true), lbp(net, true), usd(prevNet), null],
    [],
    head('Set aside', 'USD', 'LL'),
    ['Moved into Savings', usd(d.toSavings), lbp(d.toSavings)],
    ['Taken out of Savings', usd(d.fromSavings), lbp(d.fromSavings)],
    [bold('Net set aside'), usd(d.toSavings - d.fromSavings, true), lbp(d.toSavings - d.fromSavings, true)],
    [],
    head('Paid for others', 'USD', 'LL'),
    ['Paid for others this month', usd(d.paidForOthers), lbp(d.paidForOthers)],
    ['Paid back to you this month', usd(d.paidBack), lbp(d.paidBack)],
    ['Still owed to you, all time', usd(d.stillOwed), lbp(d.stillOwed)],
    [muted('Not counted as spending or income.')],
    [],
    head('Where the money went', 'USD', 'Share of spending'),
    ...(top.length
      ? top.map(([id, e]) => [catName(id), usd(e.usd), pct(share(e.usd, d.spent))])
      : [[muted('No spending this month.')]]),
    [],
    head('Biggest expenses', 'USD', 'Category', 'Date'),
    ...(d.biggest.length
      ? d.biggest.map(({ t, usd: u }) => [
          t.note || catName(t.categoryId),
          usd(u),
          catName(t.categoryId),
          t.date,
        ])
      : [[muted('No expenses this month.')]]),
  ];
  if (d.budgets.length) {
    rows.push(
      [],
      head('Monthly budgets', 'Limit', 'Spent', 'Left', 'Used'),
      // Each budget is shown in the currency it was set in.
      ...d.budgets.map((b) => {
        const money = (n) => (b.currency === 'USD' ? usd(n) : { v: Math.round(n), s: STYLE.lbp });
        return [
          b.name,
          money(b.limit),
          money(b.spent),
          money(b.limit - b.spent),
          pct(share(b.spent, b.limit)),
        ];
      }),
    );
  }
  return { name: 'Summary', rows, widths: [34, 15, 17, 15, 12] };
}

function categorySheet(name, by, total, prevBy) {
  const list = [...by].sort((a, b) => b[1].usd - a[1].usd);
  const cols = prevBy
    ? head('Category', 'USD', 'LL', 'Share', 'Entries', 'Last month', 'Change')
    : head('Category', 'USD', 'LL', 'Share', 'Entries');
  const rows = [cols];
  for (const [id, e] of list) {
    const row = [catName(id), usd(e.usd), lbp(e.usd), pct(share(e.usd, total)), { v: e.count, s: STYLE.int }];
    if (prevBy) {
      const before = (prevBy.get(id) || { usd: 0 }).usd;
      row.push(usd(before), pct(change(e.usd, before)));
    }
    rows.push(row);
  }
  if (prevBy) {
    // Categories with spending last month but none this month.
    for (const [id, e] of prevBy)
      if (!by.has(id)) rows.push([catName(id), usd(0), lbp(0), null, null, usd(e.usd), pct(-1)]);
  }
  if (list.length)
    rows.push([
      bold('Total'),
      usd(total, true),
      lbp(total, true),
      pct(1),
      { v: list.reduce((s, x) => s + x[1].count, 0), s: STYLE.int },
    ]);
  else rows.push([muted('Nothing this month.')]);
  return { name, rows, widths: [26, 14, 17, 10, 9, 14, 10] };
}

function daysSheet(d) {
  return {
    name: 'By day',
    rows: [
      head('Date', 'Day', 'Spent', 'Earned'),
      ...d.days.map((x) => [x.day, x.dow, x.spent ? usd(x.spent) : null, x.earned ? usd(x.earned) : null]),
      [bold('Total'), null, usd(d.spent, true), usd(d.earned, true)],
    ],
    widths: [12, 6, 13, 13],
  };
}

const accountLabel = (t) =>
  t.type === 'transfer'
    ? t.from === t.to
      ? accName(t.from)
      : accName(t.from) + ' → ' + accName(t.to)
    : accName(t.account || 'wallet');

/** USD value used in reports: what an entry cost or brought in, or the amount moved. */
const valueUSD = (t) => (t.type === 'transfer' || t.type === 'adjust' ? txUSD(t) : txCostUSD(t));

function entriesSheet(d) {
  return {
    name: 'Entries',
    rows: [
      head(
        'Date',
        'Type',
        'What',
        'Note',
        'Amount',
        'Currency',
        'Also paid',
        'Change back',
        'Received',
        'Value (USD)',
        'Account',
      ),
      ...d.entries.map((t) => {
        const k = backVec(t);
        const back = [k.USD > 0 ? '$' + k.USD : '', k.LBP > 0 ? k.LBP.toLocaleString('en-US') + ' LL' : '']
          .filter(Boolean)
          .join(' + ');
        const also = t.amount2
          ? other(t.currency) === 'USD'
            ? '$' + t.amount2
            : t.amount2.toLocaleString('en-US') + ' LL'
          : '';
        const received =
          t.type === 'transfer' && t.toCurrency && t.toCurrency !== t.currency
            ? t.toCurrency === 'USD'
              ? '$' + t.toAmount
              : (+t.toAmount).toLocaleString('en-US') + ' LL'
            : '';
        return [
          t.date,
          typeLabel(t),
          txTitle(t),
          t.note || '',
          { v: t.amount, s: t.currency === 'USD' ? STYLE.usd : STYLE.lbp },
          t.currency === 'USD' ? 'USD' : 'LL',
          also,
          back,
          received,
          usd(valueUSD(t)),
          accountLabel(t),
        ];
      }),
    ],
    widths: [12, 15, 24, 26, 15, 9, 13, 14, 14, 13, 18],
  };
}

function owedSheet(d) {
  const amt = (a, usdValue) => ({
    v: a.currency === 'USD' ? round2(usdValue) : Math.round(usdValue * state.rate),
    s: a.currency === 'USD' ? STYLE.usd : STYLE.lbp,
  });
  const rows = [head('Who', 'For', 'Date', 'Paid', 'Paid back', 'Still owed', 'Status')];
  for (const a of d.owedList) {
    const o = owed(a);
    const status = a.closed ? 'Closed, rest kept as ' + catName(a.keptCat) : o.settled ? 'Paid back' : 'Open';
    rows.push([a.who || '', a.note || '', a.date, amt(a, o.cost), amt(a, o.back), amt(a, o.left), status]);
  }
  if (rows.length === 1) rows.push([muted('Nothing paid for others.')]);
  return { name: 'Owed to you', rows, widths: [16, 24, 12, 15, 15, 15, 30] };
}

/** The monthly report as an .xlsx Blob. */
export function monthlyWorkbook(month) {
  const d = monthlyData(month);
  return workbook([
    summarySheet(d),
    categorySheet('Spending', d.spending, d.spent, d.prevSpending),
    categorySheet('Income', d.income, d.earned, null),
    daysSheet(d),
    owedSheet(d),
    entriesSheet(d),
  ]);
}

export const reportName = (month) => 'qirsh-report-' + monthKey(month) + '.xlsx';

/* ---------- CSV ---------- */

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

/** The month's entries as CSV, one row each, with plain numbers for importing into other tools. */
export function monthlyCsv(month) {
  const d = monthlyData(month);
  const rows = [
    [
      'Date',
      'Type',
      'What',
      'Note',
      'Amount',
      'Currency',
      'Also paid',
      'Also paid currency',
      'Change back USD',
      'Change back LL',
      'Received',
      'Received currency',
      'Value USD',
      'Account',
    ],
    ...d.entries.map((t) => {
      const k = backVec(t);
      const diffCur = t.type === 'transfer' && t.toCurrency && t.toCurrency !== t.currency;
      return [
        t.date,
        typeLabel(t),
        txTitle(t),
        t.note || '',
        t.amount,
        t.currency,
        t.amount2 || '',
        t.amount2 ? other(t.currency) : '',
        k.USD || '',
        k.LBP || '',
        diffCur ? t.toAmount : '',
        diffCur ? t.toCurrency : '',
        round2(valueUSD(t)),
        accountLabel(t),
      ];
    }),
  ];
  // The byte order mark makes Excel read the file as UTF-8, so names and notes in any script survive.
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  return new Blob([text], { type: 'text/csv;charset=utf-8' });
}

export const csvName = (month) => 'qirsh-entries-' + monthKey(month) + '.csv';
