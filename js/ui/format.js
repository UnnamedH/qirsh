/* Shared HTML snippets for transaction rows and budgets. */
import { advanceOf, fmtAdv, owed } from '../advances.js';
import { accName } from '../config.js';
import { budgetName, budgetStatus, catName, catOf } from '../ledger.js';
import { backParts, fmt, fromUSD, payParts } from '../money.js';
import { cap, esc } from '../util.js';

export function txTitle(t) {
  if (t.type === 'transfer') return t.from === t.to ? 'Exchange' : accName(t.from) + ' → ' + accName(t.to);
  if (t.type === 'advance') return 'Paid for ' + (t.who || 'someone');
  if (t.type === 'adjust') return 'Balance correction';
  if (t.type === 'repay') {
    const a = advanceOf(t);
    return 'Paid back by ' + ((a && a.who) || 'someone');
  }
  return catName(t.categoryId);
}

export function txRate(t) {
  if (t.type !== 'transfer' || !t.toCurrency || t.toCurrency === t.currency) return 0;
  const usd = t.currency === 'USD' ? t.amount : +t.toAmount,
    lbp = t.currency === 'LBP' ? t.amount : +t.toAmount;
  return usd > 0 ? lbp / usd : 0;
}

const rateTxt = (r) => Math.round(r).toLocaleString('en-US') + ' LL/$';

export function rowSub(t) {
  if (t.type === 'transfer') {
    const p = [];
    if (t.note) p.push(txTitle(t));
    if (t.from === t.to && t.from !== 'wallet') p.push(accName(t.from));
    const r = txRate(t);
    if (r) p.push('at ' + rateTxt(r));
    return p.join(' · ') || 'Transfer';
  }
  if (t.type === 'advance') {
    const o = owed(t),
      p = [];
    if (t.note) p.push(txTitle(t));
    p.push(
      t.closed
        ? o.left > 0.005
          ? 'Closed · ' + fmtAdv(t, o.left) + ' kept as spending'
          : 'Closed'
        : o.left < 0.005
          ? 'Paid back'
          : fmtAdv(t, o.left) + ' still owed',
    );
    return p.join(' · ');
  }
  if (t.type === 'repay') return t.note ? txTitle(t) : 'Not counted as income';
  if (t.type === 'adjust') {
    const p = [];
    if (t.note) p.push(txTitle(t));
    p.push(accName(t.account || 'wallet'));
    if (t.target != null) p.push('set to ' + fmt(t.target, t.currency));
    return p.join(' · ');
  }
  if (t.correction)
    return (t.note ? txTitle(t) + ' · ' : '') + 'Balance correction · ' + accName(t.account || 'wallet');
  return t.note ? txTitle(t) : cap(t.type);
}

export function txGlyph(t) {
  if (t.type === 'adjust') return '<span class="glyph tr" aria-hidden="true">±</span>';
  if (t.type === 'advance' || t.type === 'repay')
    return '<span class="glyph tr" aria-hidden="true">' + (t.type === 'advance' ? '↗' : '↙') + '</span>';
  if (t.type === 'transfer')
    return '<span class="glyph tr" aria-hidden="true">' + (t.from === t.to ? '⇄' : '→') + '</span>';
  const c = catOf(t.categoryId);
  const g = c && c.icon ? c.icon : catName(t.categoryId).charAt(0);
  return (
    '<span class="glyph' +
    (t.type === 'income' && !(c && c.icon) ? ' in' : '') +
    '" aria-hidden="true">' +
    esc(g) +
    '</span>'
  );
}

export function txAmt(t) {
  if (t.type === 'adjust')
    return '<span class="amt tr">' + fmt(t.amount, t.currency, { sign: true }) + '</span>';
  if (t.type === 'transfer') {
    const diff = (t.toCurrency || t.currency) !== t.currency;
    return (
      '<span class="amt tr">' +
      fmt(t.amount, t.currency) +
      (diff ? ' → ' + fmt(+t.toAmount, t.toCurrency) : '') +
      '</span>'
    );
  }
  const p = payParts(t),
    k = t.type === 'expense' ? backParts(t) : [];
  if (t.type === 'income')
    return (
      '<span class="amt in' +
      (p.length > 1 ? ' has-chg' : '') +
      '">' +
      p.map((x) => '<span>+' + x + '</span>').join('') +
      '</span>'
    );
  if (t.type === 'advance' || t.type === 'repay')
    return (
      '<span class="amt tr' +
      (p.length > 1 ? ' has-chg' : '') +
      '">' +
      p.map((x) => '<span>' + (t.type === 'repay' ? '+' : '') + x + '</span>').join('') +
      '</span>'
    );
  if (p.length === 1 && !k.length) return '<span class="amt">' + p[0] + '</span>';
  return (
    '<span class="amt has-chg">' +
    p.map((x) => '<span>' + x + '</span>').join('') +
    (k.length ? '<span class="chg">+' + k.join(' + ') + ' back</span>' : '') +
    '</span>'
  );
}

export function budgetHtml(b, clickable) {
  const s = budgetStatus(b);
  const c = b.currency;
  const per = b.period === 'week' ? 'Week' : 'Month';
  const pill =
    s.state === 'over'
      ? '<span class="pill over">Over</span>'
      : s.state === 'warn'
        ? '<span class="pill warn">' + Math.round(s.pct * 100) + '%</span>'
        : '<span class="pill">' + per + '</span>';
  const left =
    s.left >= 0
      ? fmt(fromUSD(s.left, c), c, { round: true }) + ' left'
      : fmt(fromUSD(-s.left, c), c, { round: true }) + ' over';
  const perDay =
    s.left > 0
      ? fmt(fromUSD(s.left / s.daysLeft, c), c, { round: true }) +
        '/day for ' +
        s.daysLeft +
        ' day' +
        (s.daysLeft > 1 ? 's' : '')
      : s.daysLeft + ' day' + (s.daysLeft > 1 ? 's' : '') + ' left in ' + b.period;
  const tag = clickable ? 'button' : 'div';
  return (
    '<' +
    tag +
    ' class="budget"' +
    (clickable ? ' data-act="editBudget" data-id="' + esc(b.id) + '"' : '') +
    '>' +
    '<div class="b-top"><span class="b-name"><span>' +
    esc(budgetName(b)) +
    '</span>' +
    pill +
    '</span>' +
    '<span class="b-nums">' +
    fmt(fromUSD(s.spent, c), c, { round: true }) +
    ' <span class="muted">/ ' +
    fmt(+b.amount, c) +
    '</span></span></div>' +
    '<div class="bar ' +
    s.state +
    '"><i style="width:' +
    Math.min(100, s.pct * 100).toFixed(1) +
    '%"></i></div>' +
    '<div class="b-foot"><span>' +
    left +
    '</span><span>' +
    perDay +
    '</span></div></' +
    tag +
    '>'
  );
}
