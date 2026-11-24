/* Members: the unité's scouts and leaders, and on each one's page their cotisations and payments. */
import { withCotisations } from '../../../js/core/events.js';
import { memberFees, memberOf, outstandingUSD } from '../../../js/core/fees.js';
import { ICON } from '../../../js/icons.js';
import { $, esc } from '../../../js/util.js';
import { state } from '../state.js';
import { cotisationLine, roleLine } from '../ui/cotisation.js';
import { fmtDisp, txRow } from '../ui/format.js';
import { peopleView } from '../ui/ui-state.js';

function memberRow(s, m) {
  const fees = memberFees(s, m.id),
    owed = outstandingUSD(s, m.id);
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

const byName = (a, b) => a.name.localeCompare(b.name);

function renderList(s) {
  const active = state.members.filter((m) => m.active).sort(byName),
    left = state.members.filter((m) => !m.active).sort(byName);
  let h =
    '<div class="stats"><div class="stat"><span class="label">Cotisations owed</span><span class="amt priv">' +
    fmtDisp(outstandingUSD(s)) +
    '</span></div><div class="stat"><span class="label">Scouts</span><span class="amt">' +
    active.filter((m) => m.role === 'scout').length +
    '</span></div><div class="stat"><span class="label">Leaders</span><span class="amt">' +
    active.filter((m) => m.role === 'leader').length +
    '</span></div></div>';
  h +=
    '<section class="sec"><div class="sec-head"><h2>Members</h2><button class="btn sm" data-act="newMember">Add member</button></div><div class="list">' +
    (active.length
      ? active.map((m) => memberRow(s, m)).join('')
      : '<p class="empty">Add your scouts and leaders once. Then pick who attends each camp, and track their cotisation there.</p>') +
    '</div></section>';
  if (left.length)
    h +=
      '<section class="sec"><h2>Left the group</h2><div class="list">' +
      left.map((m) => memberRow(s, m)).join('') +
      '</div></section>';
  return h;
}

function renderMember(s, m) {
  const fees = memberFees(s, m.id);
  let h =
    '<div class="acct-head"><button class="icon-btn" data-act="peopleAll" aria-label="Back to members">' +
    ICON.left +
    '</button><div class="acct-name"><h2>' +
    esc(m.name) +
    '</h2><p>' +
    esc(roleLine(m)) +
    '</p></div><button class="btn sm" data-act="editMember" data-id="' +
    esc(m.id) +
    '">Edit</button></div>';
  h +=
    '<section class="sec"><h2>Cotisations</h2><div class="list">' +
    (fees.length
      ? fees.map((x) => cotisationLine(x.fee, x, x.fee.name, '')).join('')
      : '<p class="empty">Not attending any camp with a cotisation yet.</p>') +
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

export function renderMembers() {
  const s = withCotisations(state),
    m = peopleView && peopleView.kind === 'member' ? memberOf(state, peopleView.id) : undefined;
  $('#v-members').innerHTML = m ? renderMember(s, m) : renderList(s);
}
