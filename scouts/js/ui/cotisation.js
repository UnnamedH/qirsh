/* Cotisations: what each camp's attendees pay. Shared by the event page and each member's page. */
import { feeStatus } from '../../../js/core/fees.js';
import { fmt } from '../../../js/core/money.js';
import { esc } from '../../../js/util.js';

/** "Scout", "Leader", or either with "Left the group" once they have left. */
export const roleLine = (m) =>
  [m.role === 'leader' ? 'Leader' : 'Scout', m.active ? '' : 'Left the group'].filter(Boolean).join(' · ');

const STATE_PILL = {
  paid: '<span class="pill">Paid</span>',
  part: '<span class="pill warn">Part paid</span>',
  unpaid: '<span class="pill over">Not paid</span>',
};

/**
 * A cotisation's progress: collected out of expected, and how many attendees have paid.
 * `s` is the state with cotisations as fees (withCotisations).
 */
export function cotisationCard(s, fee) {
  const st = feeStatus(s, fee);
  return (
    '<div class="budget"><div class="b-top"><span class="b-name"><span>Cotisation</span></span><span class="b-nums priv">' +
    fmt(st.collected, fee.currency, { round: true }) +
    ' <span class="muted">/ ' +
    fmt(st.expected, fee.currency, { round: true }) +
    '</span></span></div><div class="bar"><i style="width:' +
    Math.min(100, st.pct * 100).toFixed(1) +
    '%"></i></div><div class="b-foot"><span>' +
    st.paidCount +
    ' of ' +
    st.members.length +
    ' paid · ' +
    fmt(fee.amount, fee.currency) +
    ' each</span><span class="priv">' +
    (st.outstanding > 0 ? fmt(st.outstanding, fee.currency, { round: true }) + ' still owed' : 'All paid') +
    '</span></div></div>'
  );
}

/**
 * One attendee on one cotisation: where they stand, and a button to record their payment. `x` is their
 * memberFeeStatus. What is left goes on the second line, not in a column of its own, so a long LL amount
 * never squeezes the name on a narrow phone.
 */
export function cotisationLine(fee, x, title, sub) {
  return (
    '<div class="row"><span class="row-main"><span class="row-title">' +
    esc(title) +
    '</span><span class="row-sub">' +
    STATE_PILL[x.state] +
    ' ' +
    [
      x.owed > 0
        ? '<span class="priv">' + esc(fmt(x.owed, fee.currency, { round: true })) + ' left</span>'
        : '',
      esc(sub),
    ]
      .filter(Boolean)
      .join(' · ') +
    '</span></span>' +
    (x.owed > 0
      ? '<button class="btn sm" data-act="newPayment" data-fee="' +
        esc(fee.id) +
        '" data-member="' +
        esc(x.memberId) +
        '">Record</button>'
      : '<span class="amt in priv">' + fmt(x.paid, fee.currency, { round: true }) + '</span>') +
    '</div>'
  );
}
