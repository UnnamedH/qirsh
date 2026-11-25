/* The member form: a scout or leader, and whether they are still in the unité. */
import { ICON } from '../../../js/icons.js';
import { esc, uid } from '../../../js/util.js';
import { state } from '../state.js';
import { armed } from '../ui/ui-state.js';

export function newMemberForm() {
  return { mode: 'new', kind: 'member', name: '', role: 'scout' };
}

export function formFromMember(m) {
  return {
    mode: 'edit',
    kind: 'member',
    id: m.id,
    name: m.name,
    role: m.role,
    active: m.active,
  };
}

/** How many entries name the member, as the one who paid in or the leader who paid out. */
export const memberEntries = (id) => state.tx.filter((t) => t.memberId === id || t.paidBy === id).length;

export function memberSheet(f) {
  const used = f.id ? memberEntries(f.id) : 0;
  return (
    '<div class="sheet-head"><h2>' +
    (f.mode === 'edit' ? 'Edit member' : 'New member') +
    '</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>' +
    '<label class="field"><span>Name</span><input id="f-name" data-f="name" maxlength="60" autocomplete="off" value="' +
    esc(f.name) +
    '"></label>' +
    '<div class="seg wide" role="group" aria-label="Role">' +
    [
      ['scout', 'Scout'],
      ['leader', 'Leader'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="frole" data-v="' +
          k +
          '" aria-pressed="' +
          (f.role === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div>' +
    (f.mode === 'edit' && used
      ? '<p class="note">' +
        used +
        (used === 1 ? ' entry names ' : ' entries name ') +
        'this member, so they can’t be deleted. Mark them as left instead: their payments keep their name.</p>'
      : '') +
    '<p class="form-error" id="f-err" hidden></p><div class="sheet-actions">' +
    (f.mode === 'edit' && !used
      ? '<button class="btn danger' +
        (armed === 'tx' ? ' armed' : '') +
        '" data-act="fdel">' +
        (armed === 'tx' ? 'Tap to confirm' : 'Delete') +
        '</button>'
      : '') +
    (f.mode === 'edit'
      ? '<button class="btn" data-act="memberActive">' +
        (f.active ? 'Mark as left' : 'Back in the group') +
        '</button>'
      : '') +
    '<button class="btn primary" data-act="fsave">' +
    (f.mode === 'edit' ? 'Save changes' : 'Add member') +
    '</button></div>'
  );
}

export function buildMember(f, old) {
  const name = f.name.trim().slice(0, 60);
  if (!name) return { error: 'Type the member’s name.' };
  return {
    member: Object.assign({}, old, {
      id: (old && old.id) || 'm' + uid(),
      name,
      role: f.role === 'leader' ? 'leader' : 'scout',
      active: old ? old.active !== false : true,
      createdAt: (old && old.createdAt) || Date.now(),
    }),
  };
}
