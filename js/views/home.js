/* Home view. */
import { fmtAdv, owed } from '../advances.js';
import { accName } from '../config.js';
import { ICON } from '../icons.js';
import { balances, budgetStatus, combinedUSD, range, sumIn } from '../ledger.js';
import { dispCur, fmt, fmtDisp, fmtTotal } from '../money.js';
import { showInstallHint } from '../pwa.js';
import { priceTipBanner, showPriceTip } from '../sheets/demo.js';
import { state } from '../state.js';
import { templates } from '../templates.js';
import { budgetHtml, txAmt, txGlyph, txTitle } from '../ui/format.js';
import { quickTab } from '../ui/ui-state.js';
import { $, MONTHS, cap, dayLabel, esc } from '../util.js';

export function renderHome() {
  const b = balances(),
    w = b.wallet,
    tpl = templates(),
    list = tpl[quickTab];
  const mr = range('month');
  const spent = sumIn(mr, 'expense', null, dispCur()),
    inc = sumIn(mr, 'income', null, dispCur());
  const overall =
    state.budgets.find((x) => !x.categoryId && x.period === 'month') ||
    state.budgets.find((x) => !x.categoryId);
  const watch = state.budgets
    .filter((x) => x.categoryId)
    .map((x) => ({ b: x, s: budgetStatus(x) }))
    .sort((a, c) => c.s.pct - a.s.pct)
    .slice(0, 3);
  let h = '';
  if (showInstallHint())
    h +=
      '<div class="banner"><p>Install Qirsh: tap <strong>Share</strong> <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v9h14v-9h-1"/></svg> in Safari, then <strong>Add to Home Screen</strong>. It opens full screen and works offline.</p><button class="icon-btn" data-act="hideInstallHint" aria-label="Dismiss install tip">' +
      ICON.close +
      '</button></div>';
  if (showPriceTip()) h += priceTipBanner();
  if (state.sample)
    h +=
      '<div class="banner"><p>These are example transactions so you can see how it works.</p><button class="btn sm primary" data-act="clearSample">Start fresh</button></div>';
  h +=
    '<section class="balance" aria-label="Wallet balance"><p class="label">Wallet</p>' +
    '<button class="balance-total" data-act="toggleDisplay" title="Switch currency">' +
    fmtDisp(combinedUSD(w)) +
    '<small>total</small></button>' +
    '<div class="balance-split"><span>' +
    fmt(w.USD, 'USD') +
    '<em>cash USD</em></span><span>' +
    fmt(w.LBP, 'LBP') +
    '<em>cash LL</em></span></div>' +
    '<div class="moves"><button class="btn sm" data-act="newMove" data-v="exchange"><b aria-hidden="true">⇄</b>Exchange</button><button class="btn sm" data-act="newMove" data-v="transfer"><b aria-hidden="true">→</b>Transfer</button></div></section>';
  h +=
    '<div class="accounts">' +
    ['savings', 'whish']
      .map((id) => {
        const x = b[id];
        return (
          '<button class="acc" data-act="transferTo" data-id="' +
          id +
          '"><span class="acc-name"><span class="label">' +
          accName(id) +
          '</span><span class="move">Move</span></span>' +
          '<span class="amt" style="text-align:left">' +
          fmt(x.USD, 'USD') +
          '</span>' +
          (Math.abs(x.LBP) > 0
            ? '<span class="amt sub" style="text-align:left">' + fmt(x.LBP, 'LBP') + '</span>'
            : '') +
          '</button>'
        );
      })
      .join('') +
    '</div>';
  const open = state.tx
    .filter((t) => t.type === 'advance')
    .map((t) => ({ t, o: owed(t) }))
    .filter((x) => !x.o.settled)
    .sort((a, c) => c.t.date.localeCompare(a.t.date));
  if (open.length)
    h +=
      '<section class="sec"><div class="sec-head"><h2>Owed to you</h2><span class="num muted">' +
      fmtDisp(open.reduce((s, x) => s + x.o.left, 0)) +
      '</span></div><div class="list">' +
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
            '<span class="amt">' +
            fmtAdv(t, o.left) +
            '</span></button><button class="btn sm" data-act="newRepay" data-id="' +
            esc(t.id) +
            '">Paid back</button></div>',
        )
        .join('') +
      '</div><p class="note">Money you paid for others. It isn’t counted in your budgets or spending.</p></section>';
  h +=
    '<section class="sec"><div class="sec-head"><h2>Quick add</h2><div class="seg" role="tablist">' +
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
    '</div></div>';
  if (!list.length)
    h +=
      '<div class="list"><p class="empty">' +
      (quickTab === 'frequent'
        ? 'Anything you add twice shows up here, ready to repeat with one tap.'
        : 'Your latest transactions will show up here.') +
      '</p></div>';
  else
    h +=
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
  h += '<p class="note">Tap to add again for today. Use the pencil to change the amount first.</p></section>';
  h +=
    '<section class="sec"><div class="sec-head"><h2>' +
    MONTHS[new Date().getMonth()] +
    '</h2><button class="link" data-act="nav" data-v="history">History</button></div>' +
    '<div class="stats"><div class="stat"><span class="label">Spent</span><span class="amt">' +
    fmtTotal(spent) +
    '</span></div>' +
    '<div class="stat"><span class="label">Earned</span><span class="amt in">' +
    fmtTotal(inc) +
    '</span></div>' +
    '<div class="stat"><span class="label">Net</span><span class="amt">' +
    fmtTotal(inc - spent, { sign: inc - spent > 0 }) +
    '</span></div></div></section>';
  h +=
    '<section class="sec"><div class="sec-head"><h2>Budgets</h2><button class="link" data-act="nav" data-v="budgets">All budgets</button></div>';
  if (!overall && !watch.length)
    h +=
      '<div class="list"><p class="empty">No budgets yet. <button class="link" data-act="newBudget">Add one</button></p></div>';
  else
    h +=
      '<div class="list">' +
      (overall ? budgetHtml(overall, true) : '') +
      watch.map((x) => budgetHtml(x.b, true)).join('') +
      '</div>';
  h += '</section>';
  $('#v-home').innerHTML = h;
}
