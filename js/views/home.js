/* Home view. */
import { fmtAdv, owed } from '../advances.js';
import { MAIN, accName, accounts } from '../accounts.js';
import { ICON } from '../icons.js';
import { balances, budgetCats, budgetName, budgetStatus, combinedUSD, range, sumIn } from '../ledger.js';
import { dispCur, fmt, fmtDisp, fmtTotal } from '../money.js';
import { safariTip } from '../pwa.js';
import { priceTipBanner, showPriceTip } from '../sheets/demo.js';
import { state } from '../state.js';
import { templates } from '../templates.js';
import { budgetHtml, txAmt, txGlyph, txTitle } from '../ui/format.js';
import { dueNow, recAmount, recName } from '../recurring.js';
import { quickTab } from '../ui/ui-state.js';
import { $, MONTHS, cap, dayLabel, esc } from '../util.js';

/* Safari's Share icon, so the note shows exactly what to tap. */
const SHARE_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v9h14v-9h-1"/></svg>';

export function renderHome() {
  const b = balances(),
    w = b[MAIN],
    tpl = templates(),
    list = tpl[quickTab];
  const mr = range('month');
  const spent = sumIn(mr, 'expense', null, dispCur()),
    inc = sumIn(mr, 'income', null, dispCur());
  const overall =
    state.budgets.find((x) => !budgetCats(x).length && x.period === 'month') ||
    state.budgets.find((x) => !budgetCats(x).length);
  const watchAll = state.budgets
    .filter((x) => budgetCats(x).length)
    .map((x) => ({ b: x, s: budgetStatus(x) }))
    .sort((a, c) => c.s.pct - a.s.pct);
  const watch = watchAll.slice(0, 3);
  let h = '';
  const tip = safariTip();
  if (tip === 'start')
    h +=
      '<div class="banner"><p><strong>Add Frata to your Home Screen</strong> before you start: Safari can clear a website’s data after a week without a visit. Tap <strong>Share</strong> ' +
      SHARE_ICON +
      ' then <strong>Add to Home Screen</strong>.</p><button class="icon-btn" data-act="safariTipDone" data-v="start" aria-label="Dismiss">' +
      ICON.close +
      '</button></div>';
  else if (tip === 'move')
    h +=
      '<div class="banner"><p><strong>Keep your entries safe.</strong> Safari can clear them after a week without a visit. Back up, add Frata to your Home Screen, then import the backup there.</p><button class="btn sm primary" data-act="backupNow">Back up</button><button class="icon-btn" data-act="safariTipDone" data-v="move" aria-label="Dismiss">' +
      ICON.close +
      '</button></div>';
  if (showPriceTip()) h += priceTipBanner();
  if (state.sample)
    h +=
      '<div class="banner"><p>These are example transactions so you can see how it works.</p><button class="btn sm primary" data-act="clearSample">Start fresh</button></div>';
  h +=
    '<section class="balance" aria-label="' +
    esc(accName(MAIN)) +
    ' balance"><div class="balance-head"><button class="label acc-open" data-act="accView" data-id="' +
    MAIN +
    '">' +
    esc(accName(MAIN)) +
    ICON.right +
    '</button>' +
    '<button class="icon-btn" data-act="toggleHide" aria-pressed="' +
    state.settings.hide +
    '" aria-label="' +
    (state.settings.hide ? 'Show amounts' : 'Hide amounts') +
    '">' +
    (state.settings.hide ? ICON.eyeOff : ICON.eye) +
    '</button></div>' +
    '<button class="balance-total priv" data-act="toggleDisplay" title="Switch currency">' +
    fmtDisp(combinedUSD(w)) +
    '</button>' +
    '<div class="balance-split priv"><span>' +
    fmt(w.USD, 'USD') +
    '</span><span>' +
    fmt(w.LBP, 'LBP') +
    '</span></div>' +
    '<div class="moves"><button class="btn sm" data-act="newMove" data-v="exchange"><b aria-hidden="true">⇄</b>Exchange</button></div></section>';
  h += otherAccounts(b);
  h += dueCard();
  const open = state.tx
    .filter((t) => t.type === 'advance')
    .map((t) => ({ t, o: owed(t) }))
    .filter((x) => !x.o.settled)
    .sort((a, c) => c.t.date.localeCompare(a.t.date));
  if (open.length)
    h += fold(
      'owed',
      'Owed to you',
      '<span class="num priv">' + fmtDisp(open.reduce((s, x) => s + x.o.left, 0)) + '</span>',
      '',
      '<div class="list">' +
        open
          .map(
            ({ t, o }) =>
              '<div class="row"><button class="row-btn" data-act="editTx" data-id="' +
              esc(t.id) +
              '">' +
              txGlyph(t) +
              '<span class="row-main"><span class="row-title">' +
              esc(t.who || 'Someone') +
              '</span><span class="row-sub">' +
              esc(
                (t.note ? t.note + ' · ' : '') +
                  dayLabel(t.date) +
                  (o.back > 0 ? ' · ' + fmtAdv(t, o.back) + ' back so far' : ''),
              ) +
              '</span></span>' +
              '<span class="amt priv">' +
              fmtAdv(t, o.left) +
              '</span></button><button class="btn sm" data-act="newRepay" data-id="' +
              esc(t.id) +
              '">Paid back</button></div>',
          )
          .join('') +
        '</div>',
    );
  let quickBody = '';
  if (!list.length)
    quickBody +=
      '<div class="list"><p class="empty">' +
      (quickTab === 'frequent'
        ? 'Anything you add twice shows up here, ready to repeat with one tap.'
        : 'Your latest transactions will show up here.') +
      '</p></div>';
  else
    quickBody +=
      '<div class="list">' +
      list
        .map((e) => {
          const t = e.tx;
          return (
            '<div class="row"><button class="row-btn" data-act="repeat" data-key="' +
            esc(e.key) +
            '" aria-label="Add again: ' +
            esc(txTitle(t)) +
            '">' +
            txGlyph(t) +
            '<span class="row-main"><span class="row-title">' +
            esc(t.note || txTitle(t)) +
            '</span><span class="row-sub">' +
            esc(t.note ? txTitle(t) : '') +
            (quickTab === 'frequent'
              ? (t.note ? ' · ' : '') + '×' + e.count
              : (t.note ? ' · ' : '') + dayLabel(t.date)) +
            '</span></span>' +
            txAmt(t) +
            '</button>' +
            '<button class="icon-btn" data-act="repeatEdit" data-key="' +
            esc(e.key) +
            '" aria-label="Edit before adding">' +
            ICON.edit +
            '</button></div>'
          );
        })
        .join('') +
      '</div>';
  h += fold(
    'quick',
    'Quick add',
    [...new Set(tpl.frequent.map((e) => txGlyph(e.tx)))].slice(0, 5).join(''),
    '<div class="seg" role="tablist">' +
      ['frequent', 'recent']
        .map(
          (k) =>
            '<button data-act="quickTab" data-v="' +
            k +
            '" aria-pressed="' +
            (quickTab === k) +
            '">' +
            cap(k) +
            '</button>',
        )
        .join('') +
      '</div>',
    quickBody,
  );
  const net = inc - spent;
  h += fold(
    'month',
    MONTHS[new Date().getMonth()],
    '<span class="mini-stats priv" aria-label="' +
      esc(
        'Spent ' +
          fmtTotal(spent) +
          ', earned ' +
          fmtTotal(inc) +
          ', net ' +
          fmtTotal(net, { sign: net > 0 }),
      ) +
      '"><span aria-hidden="true">' +
      fmtTotal(spent, { whole: true }) +
      '</span><span class="in" aria-hidden="true">' +
      fmtTotal(inc, { whole: true }) +
      '</span><span aria-hidden="true">' +
      fmtTotal(net, { sign: net > 0, whole: true }) +
      '</span></span>',
    '<button class="link" data-act="nav" data-v="history">History</button>',
    '<div class="stats priv"><div class="stat"><span class="label">Spent</span><span class="amt">' +
      fmtTotal(spent) +
      '</span></div>' +
      '<div class="stat"><span class="label">Earned</span><span class="amt in">' +
      fmtTotal(inc) +
      '</span></div>' +
      '<div class="stat"><span class="label">Net</span><span class="amt">' +
      fmtTotal(net, { sign: net > 0 }) +
      '</span></div></div>',
  );
  const rings = (overall ? [overall] : []).concat(watchAll.map((x) => x.b)).slice(0, 5);
  h += fold(
    'budgets',
    'Budgets',
    rings.map(budgetRing).join(''),
    '<button class="link" data-act="nav" data-v="budgets">All budgets</button>',
    !overall && !watch.length
      ? '<div class="list"><p class="empty">No budgets yet. <button class="link" data-act="newBudget">Add one</button></p></div>'
      : '<div class="list">' +
          (overall ? budgetHtml(overall, true) : '') +
          watch.map((x) => budgetHtml(x.b, true)).join('') +
          '</div>',
  );
  $('#v-home').innerHTML = h;
}

/* Accounts besides the main one. They fold into one row so a long list doesn't push the rest of Home
   down; with one or two they start open, and the choice is remembered once made. */
function otherAccounts(b) {
  const list = accounts().filter((a) => a.id !== MAIN);
  if (!list.length) return '';
  const open = state.settings.accountsOpen ?? list.length <= 2;
  const total = list.reduce((s, a) => s + combinedUSD(b[a.id]), 0);
  let h =
    '<section class="accs"><button class="accs-head" data-act="toggleAccs" aria-expanded="' +
    open +
    '"><span class="label">Other accounts</span><span class="accs-total priv">' +
    fmtDisp(total) +
    '</span>' +
    ICON.right +
    '</button>';
  if (open)
    h +=
      '<div class="accounts">' +
      list
        .map((a) => {
          const x = b[a.id];
          return (
            '<button class="acc" data-act="accView" data-id="' +
            esc(a.id) +
            '"><span class="acc-name"><span class="label">' +
            esc(a.name) +
            '</span>' +
            ICON.right +
            '</span>' +
            '<span class="amt priv" style="text-align:left">' +
            fmt(x.USD, 'USD') +
            '</span>' +
            (Math.abs(x.LBP) > 0
              ? '<span class="amt sub priv" style="text-align:left">' + fmt(x.LBP, 'LBP') + '</span>'
              : '') +
            '</button>'
          );
        })
        .join('') +
      '</div>';
  return h + '</section>';
}

/* A Home section whose header folds it down to a one-line summary of what's inside. `extra` (a link
   or tabs) shows in the header only while open; the summary only while folded, except where the
   header always had it (the total owed). */
function fold(key, title, summary, extra, body) {
  const shut = !!state.settings.homeFold[key],
    always = key === 'owed';
  return (
    '<section class="sec fold' +
    (shut ? ' shut' : '') +
    '"><div class="sec-head"><h2 class="fold-title"><button class="fold-head" data-act="fold" data-v="' +
    key +
    '" aria-expanded="' +
    !shut +
    '"><span>' +
    title +
    '</span>' +
    ICON.right +
    (summary && (shut || always) ? '<span class="fold-sum">' + summary + '</span>' : '') +
    '</button></h2>' +
    (shut ? '' : extra) +
    '</div>' +
    (shut ? '' : body) +
    '</section>'
  );
}

/* A budget as a tiny ring for a folded Budgets section, coloured like its bar. */
function budgetRing(b) {
  const s = budgetStatus(b),
    r = 7,
    len = 2 * Math.PI * r,
    filled = Math.min(1, Math.max(0, s.pct)) * len;
  return (
    '<svg class="ring ' +
    s.state +
    '" viewBox="0 0 18 18" role="img" aria-label="' +
    esc(budgetName(b)) +
    ' ' +
    Math.round(s.pct * 100) +
    '%"><circle cx="9" cy="9" r="' +
    r +
    '"/><circle class="fill" cx="9" cy="9" r="' +
    r +
    '" stroke-dasharray="' +
    filled.toFixed(2) +
    ' ' +
    len.toFixed(2) +
    '"/></svg>'
  );
}

/* Recurring entries that have come due, to add or skip with a tap. Tapping the name edits it first, for a bill
   that came to a different amount. Only the oldest due date of each shows; the next waits behind it. */
function dueCard() {
  const due = dueNow();
  if (!due.length) return '';
  const count = due.reduce((n, x) => n + 1 + x.more, 0);
  return (
    '<section class="sec" id="dueSec"><div class="sec-head"><h2>Due</h2>' +
    (count > 1 ? '<button class="link" data-act="dueAll">Add all ' + count + '</button>' : '') +
    '</div><div class="list">' +
    due
      .map(({ rec, date, more }) => {
        const key = 'data-id="' + esc(rec.id) + '" data-v="' + date + '"';
        return (
          '<div class="due-row"><button class="row-btn" data-act="dueEdit" ' +
          key +
          ' aria-label="Edit before adding: ' +
          esc(recName(rec)) +
          '">' +
          txGlyph(rec) +
          '<span class="row-main"><span class="row-title">' +
          esc(recName(rec)) +
          '</span><span class="row-sub">Due ' +
          esc(dayLabel(date)) +
          (more ? ' · ' + more + ' more after it' : '') +
          '</span></span><span class="amt priv' +
          (rec.type === 'income' ? ' in' : '') +
          '">' +
          recAmount(rec) +
          '</span></button><div class="due-actions"><button class="btn sm primary" data-act="dueAdd" ' +
          key +
          '>Add</button><button class="btn sm" data-act="dueSkip" ' +
          key +
          '>Skip</button></div></div>'
        );
      })
      .join('') +
    '</div></section>'
  );
}
