/* Recording a cotisation in one step: only the amount is asked, everything else is already known. */
import { withCotisations } from '../../../js/core/events.js';
import { feeOf, memberOf } from '../../../js/core/fees.js';
import { fmt } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { amountField } from '../../../js/ui/amount.js';
import { esc } from '../../../js/util.js';
import { state } from '../state.js';
import { buildTx, paymentForm } from './entry.js';

/**
 * The quick payment form: the full income form a payment would fill in (member, cotisation, camp,
 * Caisse, Cotisations, today), of which only the amount and its currency are shown.
 */
export function quickPaymentForm(fee, memberId) {
  return Object.assign(paymentForm(fee, memberId), { kind: 'pay' });
}

export function paymentSheet(f) {
  const fee = feeOf(withCotisations(state), f.feeId),
    m = memberOf(state, f.memberId);
  return (
    '<div class="sheet-head"><h2>Cotisation</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div><p class="note"><strong>' +
    esc(m ? m.name : '') +
    '</strong> for ' +
    esc(fee ? fee.name : '') +
    (fee ? ' · ' + esc(fmt(fee.amount, fee.currency)) + ' each' : '') +
    '</p><div class="amount-row">' +
    amountField({
      id: 'f-amount',
      value: f.amount,
      cur: f.cur,
      label: 'Amount paid',
      attrs: ' data-f="amount"',
    }) +
    '<div class="seg cur" role="group" aria-label="Currency">' +
    [
      ['USD', 'USD'],
      ['LBP', 'LL'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="fcur" data-v="' +
          k +
          '" aria-pressed="' +
          (f.cur === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div></div><p class="form-error" id="f-err" hidden></p><div class="sheet-actions">' +
    '<button class="btn primary" data-act="fsave">Record</button></div>'
  );
}

/** Builds the payment from the quick form: the income entry, exactly as the full form would. */
export const buildPayment = (f) => buildTx(Object.assign({}, f, { kind: 'tx' }), null);
