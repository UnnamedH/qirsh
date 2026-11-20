/* Members: the group's fees and who has paid them, and each member's own page. */
import { feeOf, feeStatus, memberFees, memberOf, outstandingUSD } from '../../../js/core/fees.js';
import { eventOf } from '../../../js/core/events.js';
import { fmt } from '../../../js/core/money.js';
import { ICON } from '../../../js/icons.js';
import { $, MONTHS, esc, parseYmd, ymd } from '../../../js/util.js';
import { state } from '../state.js';
import { fmtDisp, txRow } from '../ui/format.js';
import { peopleView } from '../ui/ui-state.js';

const shortDate = (s) => {
  const d = parseYmd(s);
  return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
};

const roleLine = (m) =>
  [m.role === 'leader' ? 'Leader' : 'Scout', m.unit, m.active ? '' : 'Left the group']
    .filter(Boolean)
    .join(' · ');

const STATE_PILL = {
  paid: '<span class="pill">Paid</span>',
  part: '<span class="pill warn">Part paid</span>',
  unpaid: '<span class="pill over">Not paid</span>',
};

/* "Due 1 Mar", or "Overdue" once that day has passed with money still owed. */
function duePill(f, owed) {
  if (!f.due) return '';
  if (owed > 0 && f.due < ymd(new Date())) return '<span class="pill over">Overdue</span>';
  return '<span class="pill">Due ' + esc(shortDate(f.due)) + '</span>';
}

/* A fee's progress card. On the fee's own page it is not a button. */
function feeCard(f, clickable = true) {
  const st = feeStatus(state, f);
  return (
    (clickable
      ? '<button class="budget" data-act="feeView" data-id="' + esc(f.id) + '">'
      : '<div class="budget">') +
    '<div class="b-top"><span class="b-name"><span>' +
    // On the fee's own page the heading already names it.
    (clickable ? esc(f.name) : 'Collected') +
    '</span>' +
    duePill(f, st.outstanding) +
    '</span><span class="b-nums priv">' +
    fmt(st.collected, f.currency, { round: true }) +
    ' <span class="muted">/ ' +
    fmt(st.expected, f.currency, { round: true }) +
    '</span></span></div><div class="bar"><i style="width:' +
    Math.min(100, st.pct * 100).toFixed(1) +
    '%"></i></div><div class="b-foot"><span>' +
    st.paidCount +
    ' of ' +
    st.members.length +
    ' paid</span><span class="priv">' +
    (st.outstanding > 0 ? fmt(st.outstanding, f.currency, { round: true }) + ' still owed' : 'All paid') +
    '</span></div>' +
    (clickable ? '</button>' : '</div>')
  );
}

function memberRow(m) {
  const fees = memberFees(state, m.id),
    owed = outstandingUSD(state, m.id);
  return (
    '<div class="row"><button class="row-btn" data-act="memberView" data-id="' +
    esc(m.id) +
    '"><span class="glyph' +
    (m.role === 'leader' ? ' tr' : '') +
    '" aria-hidden="true">' +
    esc(m.name.charAt(0).toUpperCase()) +
    '</span><span class="row-main"><span class="row-title">' +
    esc(m.name) +
    '</span><span class="row-sub">' +
    esc(roleLine(m)) +
    '</span></span><span class="amt priv' +
    (owed > 0 ? '' : ' in') +
    '">' +
    (!fees.length ? '' : owed > 0 ? 'owes ' + fmtDisp(owed) : 'Paid up') +
    '</span></button></div>'
  );
}

function renderList() {
  const owed = outstandingUSD(state),
    active = state.members.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name)),
    left = state.members.filter((m) => !m.active).sort((a, b) => a.name.localeCompare(b.name)),
    fees = state.fees.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  let h =
    '<div class="stats"><div class="stat"><span class="label">Still owed</span><span class="amt priv">' +
    fmtDisp(owed) +
    '</span></div><div class="stat"><span class="label">Members</span><span class="amt">' +
    active.length +
    '</span></div><div class="stat"><span class="label">Fees</span><span class="amt">' +
    fees.length +
    '</span></div></div>';
  h +=
    '<section class="sec"><div class="sec-head"><h2>Fees</h2><button class="btn sm" data-act="newFee">New fee</button></div><div class="list">' +
    (fees.length
      ? fees.map((f) => feeCard(f)).join('')
      : '<p class="empty">Add the yearly dues or a camp fee to see who has paid and who still owes.</p>') +
    '</div></section>';
  h +=
    '<section class="sec"><div class="sec-head"><h2>Members</h2><button class="btn sm" data-act="newMember">Add member</button></div><div class="list">' +
    (active.length
      ? active.map(memberRow).join('')
      : '<p class="empty">Add your scouts and leaders, then the fees they pay.</p>') +
    '</div></section>';
  if (left.length)
    h +=
      '<section class="sec"><h2>Left the group</h2><div class="list">' +
      left.map(memberRow).join('') +
      '</div></section>';
  return h;
}

/* One member on one fee: where they stand, and a button to record their payment. */
function feeLine(f, x, title, sub) {
  return (
    '<div class="row"><span class="row-main"><span class="row-title">' +
    esc(title) +
    '</span><span class="row-sub">' +
    STATE_PILL[x.state] +
    ' ' +
    // What is left goes on this line, not in a column of its own, so a long LL amount never squeezes
    // the name on a narrow phone.
    (x.owed > 0
      ? '<span class="priv">' + esc(fmt(x.owed, f.currency, { round: true })) + ' left</span> · '
      : '') +
    esc(sub) +
    '</span></span>' +
    (x.owed > 0
      ? '<button class="btn sm" data-act="newPayment" data-fee="' +
        esc(f.id) +
        '" data-member="' +
        esc(x.memberId) +
        '">Record</button>'
      : '<span class="amt in priv">' + fmt(x.paid, f.currency, { round: true }) + '</span>') +
    '</div>'
  );
}

const head = (title, sub, act, id) =>
  '<div class="acct-head"><button class="icon-btn" data-act="peopleAll" aria-label="Back to members">' +
  ICON.left +
  '</button><div class="acct-name"><h2>' +
  esc(title) +
  '</h2><p>' +
  esc(sub) +
  '</p></div><button class="btn sm" data-act="' +
  act +
  '" data-id="' +
  esc(id) +
  '">Edit</button></div>';

function renderMember(m) {
  const fees = memberFees(state, m.id);
  let h = head(m.name, roleLine(m), 'editMember', m.id);
  h +=
    '<section class="sec"><h2>Fees</h2><div class="list">' +
    (fees.length
      ? fees
          .map((x) =>
            feeLine(
              x.fee,
              x,
              x.fee.name,
              fmt(x.fee.amount, x.fee.currency) + (x.fee.due ? ' · due ' + shortDate(x.fee.due) : ''),
            ),
          )
          .join('')
      : '<p class="empty">No fees for this member.</p>') +
    '</div></section>';
  const txs = state.tx
    .filter((t) => t.memberId === m.id || t.paidBy === m.id)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  h +=
    '<section class="sec"><h2>Payments</h2><div class="list">' +
    (txs.length
      ? txs.map((t) => txRow(t, { member: true })).join('')
      : '<p class="empty">No payments yet.</p>') +
    '</div></section>';
  return h;
}

function renderFee(f) {
  const st = feeStatus(state, f),
    ev = eventOf(state, f.eventId);
  const sub = [fmt(f.amount, f.currency) + ' each', f.due ? 'due ' + shortDate(f.due) : '', ev ? ev.name : '']
    .filter(Boolean)
    .join(' · ');
  let h = head(f.name, sub, 'editFee', f.id);
  h += '<div class="list">' + feeCard(f, false) + '</div>';
  // Who still owes first, so the list is a to-do; then everyone who has paid.
  const order = { unpaid: 0, part: 1, paid: 2 };
  const rows = st.members
    .map((x) => ({ x, m: memberOf(state, x.memberId) }))
    .filter((r) => r.m)
    .sort((a, b) => order[a.x.state] - order[b.x.state] || a.m.name.localeCompare(b.m.name));
  h +=
    '<section class="sec"><h2>Members</h2><div class="list">' +
    (rows.length
      ? rows.map((r) => feeLine(f, r.x, r.m.name, roleLine(r.m))).join('')
      : '<p class="empty">No one pays this fee yet. Edit it to tick who pays.</p>') +
    '</div></section>';
  return h;
}

export function renderMembers() {
  const v = peopleView,
    m = v && v.kind === 'member' ? memberOf(state, v.id) : undefined,
    f = v && v.kind === 'fee' ? feeOf(state, v.id) : undefined;
  $('#v-members').innerHTML = m ? renderMember(m) : f ? renderFee(f) : renderList();
}
