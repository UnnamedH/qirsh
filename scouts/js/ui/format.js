/* Text and HTML for entries and amounts: titles, glyphs, and totals in the display currency. */
import { accName } from '../../../js/core/accounts.js';
import { eventOf } from '../../../js/core/events.js';
import { memberOf } from '../../../js/core/fees.js';
import { catName, catOf } from '../../../js/core/ledger.js';
import { fmt, fromUSD, payParts } from '../../../js/core/money.js';
import { dayLabel, esc } from '../../../js/util.js';
import { state } from '../state.js';

/** A USD amount in the display currency at today's rate: for what the funds hold now. */
export const fmtDisp = (usd, o) => {
  const c = state.settings.display;
  return fmt(fromUSD(usd, c, state.rate), c, Object.assign({ round: true }, o || {}));
};

/** A total already in the display currency. */
export const fmtTotal = (n, o) => fmt(n, state.settings.display, Object.assign({ round: true }, o || {}));

export function txTitle(t) {
  if (t.type === 'adjust') return 'Balance correction';
  if (t.type === 'transfer') {
    return t.from === t.to ? 'Exchange' : accName(state, t.from) + ' → ' + accName(state, t.to);
  }
  return t.note || catName(state, t.categoryId);
}

/**
 * The line under an entry's title. `hide` leaves out what the page is already about: the event on an
 * event's page ({ event: true }), the member on a member's page ({ member: true }).
 */
export function rowSub(t, hide = {}) {
  // A camp's own account has the camp's name, which the event part below already gives.
  const camp = eventOf(state, t.eventId),
    where =
      t.type === 'transfer' || (camp && camp.accountId === t.account)
        ? ''
        : accName(state, t.account || 'wallet');
  const note = t.note && t.type !== 'transfer' ? catName(state, t.categoryId) : t.note || '';
  const ev = hide.event ? undefined : eventOf(state, t.eventId),
    who = hide.member ? undefined : memberOf(state, t.memberId);
  return [dayLabel(t.date), where, who ? who.name : '', ev ? ev.name : '', note].filter(Boolean).join(' · ');
}

export function txGlyph(t) {
  if (t.type === 'adjust') return '<span class="glyph tr" aria-hidden="true">±</span>';
  if (t.type === 'transfer')
    return '<span class="glyph tr" aria-hidden="true">' + (t.from === t.to ? '⇄' : '→') + '</span>';
  const c = catOf(state, t.categoryId);
  const g = c && c.icon ? c.icon : catName(state, t.categoryId).charAt(0);
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
  const p = payParts(t);
  return t.type === 'income'
    ? '<span class="amt in"><span>+' + p.join(' + ') + '</span></span>'
    : '<span class="amt">' + p.join(' + ') + '</span>';
}

/** One tappable row of an entry, as in Frata's History. */
export function txRow(t, hide = {}) {
  return (
    '<div class="row"><button class="row-btn" data-act="editTx" data-id="' +
    esc(t.id) +
    '">' +
    txGlyph(t) +
    '<span class="row-main"><span class="row-title">' +
    esc(txTitle(t)) +
    '</span><span class="row-sub">' +
    esc(rowSub(t, hide)) +
    '</span></span><span class="priv">' +
    txAmt(t) +
    '</span></button></div>'
  );
}
