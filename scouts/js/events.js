/* All user interaction: one delegated listener per event type, dispatching on data-act (or data-f for
   the fields of the open form). */
import { addAccount, removeAccount, renameAccount, restoreAccount } from '../../js/core/accounts.js';
import { parseAmt, parseInput } from '../../js/core/money.js';
import { fitThousands } from '../../js/ui/amount.js';
import { setUndoFn, toast, undoFn } from '../../js/ui/toast.js';
import { $ } from '../../js/util.js';
import { exportSave, stageImport } from './backup.js';
import { KEY, save, setState, state, syncFromStorage } from './state.js';
import { buildAdjust, adjustForm, adjustFromTx, updateAdjustPreview } from './sheets/adjust.js';
import { buildTx, formFromTx, newTxForm, paymentForm } from './sheets/entry.js';
import { buildFee, formFromFee, newFeeForm } from './sheets/fee.js';
import { buildMember, formFromMember, memberEntries, newMemberForm } from './sheets/member.js';
import { buildEvent, formFromEvent, newEventForm } from './sheets/event.js';
import { closeSheet, drawSheet, form, openSheet, sheetOpen } from './sheets/sheet.js';
import { commit, render } from './ui/render.js';
import {
  armed,
  hist,
  pendingImport,
  setArmed,
  setEventView,
  setPeopleView,
  setPendingImport,
  setShowOpening,
  setView,
  showOpening,
  eventView,
  view,
} from './ui/ui-state.js';

const byId = (id) => state.tx.find((t) => t.id === id);

function showError(msg) {
  const el = $('#f-err');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

/* Saves the event form. A new event opens its own page, ready for its first entries. */
function saveEvent() {
  const old = form.mode === 'edit' ? state.events.find((e) => e.id === form.id) : null;
  const r = buildEvent(form, old);
  if (r.error) return showError(r.error);
  if (old) state.events[state.events.indexOf(old)] = r.event;
  else state.events.push(r.event);
  setArmed(null);
  closeSheet();
  if (!old) {
    setView('events');
    setEventView(r.event.id);
  }
  commit();
  toast(old ? 'Changes saved' : 'Event added');
}

/* Deletes an event. Its entries stay, as ordinary entries; Undo brings back the event and the links. */
function deleteEvent() {
  if (armed !== 'tx') {
    setArmed('tx');
    return drawSheet();
  }
  const i = state.events.findIndex((e) => e.id === form.id);
  if (i < 0) return;
  const [gone] = state.events.splice(i, 1);
  const linked = state.tx.filter((t) => t.eventId === gone.id);
  linked.forEach((t) => delete t.eventId);
  setArmed(null);
  closeSheet();
  setEventView(null);
  commit();
  toast('Event deleted', () => {
    state.events.splice(Math.min(i, state.events.length), 0, gone);
    linked.forEach((t) => (t.eventId = gone.id));
    commit();
  });
}

/* Saves the member form. A new member opens their page. */
function saveMember() {
  const old = form.mode === 'edit' ? state.members.find((m) => m.id === form.id) : null;
  const r = buildMember(form, old);
  if (r.error) return showError(r.error);
  if (old) state.members[state.members.indexOf(old)] = r.member;
  else state.members.push(r.member);
  setArmed(null);
  closeSheet();
  if (!old) setView('members');
  commit();
  toast(old ? 'Changes saved' : r.member.name + ' added');
}

/* Deletes a member nobody's entries name (the form offers it only then). They leave every fee, with Undo. */
function deleteMember() {
  if (memberEntries(form.id)) return;
  if (armed !== 'tx') {
    setArmed('tx');
    return drawSheet();
  }
  const i = state.members.findIndex((m) => m.id === form.id);
  if (i < 0) return;
  const [gone] = state.members.splice(i, 1);
  const onFees = state.fees.filter((f) => f.memberIds.includes(gone.id));
  onFees.forEach((f) => (f.memberIds = f.memberIds.filter((id) => id !== gone.id)));
  setArmed(null);
  closeSheet();
  setPeopleView(null);
  commit();
  toast(gone.name + ' deleted', () => {
    state.members.splice(Math.min(i, state.members.length), 0, gone);
    onFees.forEach((f) => f.memberIds.push(gone.id));
    commit();
  });
}

/* Saves the fee form. A new fee opens its page, which lists who still has to pay. */
function saveFee() {
  const old = form.mode === 'edit' ? state.fees.find((f) => f.id === form.id) : null;
  const r = buildFee(form, old);
  if (r.error) return showError(r.error);
  if (old) state.fees[state.fees.indexOf(old)] = r.fee;
  else state.fees.push(r.fee);
  setArmed(null);
  closeSheet();
  if (!old) {
    setView('members');
    setPeopleView({ kind: 'fee', id: r.fee.id });
  }
  commit();
  toast(old ? 'Changes saved' : 'Fee added');
}

/* Deletes a fee. Payments toward it stay, as ordinary income; Undo brings back the fee and the links. */
function deleteFee() {
  if (armed !== 'tx') {
    setArmed('tx');
    return drawSheet();
  }
  const i = state.fees.findIndex((f) => f.id === form.id);
  if (i < 0) return;
  const [gone] = state.fees.splice(i, 1);
  const linked = state.tx.filter((t) => t.feeId === gone.id);
  linked.forEach((t) => delete t.feeId);
  setArmed(null);
  closeSheet();
  setPeopleView(null);
  commit();
  toast('Fee deleted', () => {
    state.fees.splice(Math.min(i, state.fees.length), 0, gone);
    linked.forEach((t) => (t.feeId = gone.id));
    commit();
  });
}

const SAVE = { event: saveEvent, member: saveMember, fee: saveFee };
const DELETE = { event: deleteEvent, member: deleteMember, fee: deleteFee };

/* Saves the open form: a new entry is added, an edited one replaces the saved entry in place. */
function saveForm() {
  if (SAVE[form.kind]) return SAVE[form.kind]();
  const old = form.mode === 'edit' ? byId(form.id) : null;
  const r = form.kind === 'adjust' ? buildAdjust(form, old) : buildTx(form, old);
  if (r.error) return showError(r.error);
  if (old) state.tx[state.tx.indexOf(old)] = r.tx;
  else state.tx.push(r.tx);
  setArmed(null);
  closeSheet();
  commit();
  toast(old ? 'Changes saved' : 'Entry added');
}

function deleteForm() {
  if (DELETE[form.kind]) return DELETE[form.kind]();
  if (armed !== 'tx') {
    setArmed('tx');
    return drawSheet();
  }
  const i = state.tx.findIndex((t) => t.id === form.id);
  if (i < 0) return;
  const [gone] = state.tx.splice(i, 1);
  setArmed(null);
  closeSheet();
  commit();
  toast('Entry deleted', () => {
    state.tx.splice(Math.min(i, state.tx.length), 0, gone);
    commit();
  });
}

function click(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act,
    v = el.dataset.v,
    id = el.dataset.id;
  switch (act) {
    case 'nav':
      setView(v);
      if (v === 'history') hist.account = null;
      if (v === 'events') setEventView(null);
      if (v === 'members') setPeopleView(null);
      setArmed(null);
      render();
      window.scrollTo(0, 0);
      break;
    case 'new':
      setArmed(null);
      openSheet(
        newTxForm(
          v || 'expense',
          view === 'history' ? hist.account : null,
          el.dataset.event || eventView || '',
        ),
      );
      break;
    case 'newMember':
      setArmed(null);
      openSheet(newMemberForm());
      break;
    case 'editMember': {
      const m = state.members.find((x) => x.id === id);
      if (m) openSheet(formFromMember(m));
      break;
    }
    case 'memberView':
      setPeopleView({ kind: 'member', id });
      render();
      window.scrollTo(0, 0);
      break;
    case 'feeView':
      setPeopleView({ kind: 'fee', id });
      render();
      window.scrollTo(0, 0);
      break;
    case 'peopleAll':
      setPeopleView(null);
      render();
      break;
    case 'frole':
      if (!form) break;
      form.role = v;
      drawSheet();
      break;
    case 'memberActive': {
      const m = form && state.members.find((x) => x.id === form.id);
      if (!m) break;
      m.active = !m.active;
      closeSheet();
      commit();
      toast(m.active ? m.name + ' is back in the group' : m.name + ' marked as left');
      break;
    }
    case 'newFee':
      setArmed(null);
      openSheet(newFeeForm());
      break;
    case 'editFee': {
      const f = state.fees.find((x) => x.id === id);
      if (f) openSheet(formFromFee(f));
      break;
    }
    case 'feeAll':
      if (!form) break;
      form.memberIds = state.members
        .filter((m) => m.active || form.memberIds.includes(m.id))
        .map((m) => m.id);
      drawSheet();
      break;
    case 'feeNone':
      if (!form) break;
      form.memberIds = [];
      drawSheet();
      break;
    case 'newPayment': {
      const f = state.fees.find((x) => x.id === el.dataset.fee);
      if (!f) break;
      setArmed(null);
      openSheet(paymentForm(f, el.dataset.member));
      break;
    }
    case 'newEvent':
      setArmed(null);
      openSheet(newEventForm());
      break;
    case 'editEvent': {
      const e = state.events.find((x) => x.id === id);
      if (e) openSheet(formFromEvent(e));
      break;
    }
    case 'eventView':
      setEventView(id);
      render();
      window.scrollTo(0, 0);
      break;
    case 'eventsAll':
      setEventView(null);
      render();
      break;
    case 'eventClose': {
      const e = form && state.events.find((x) => x.id === form.id);
      if (!e) break;
      e.closed = !e.closed;
      closeSheet();
      commit();
      toast(e.closed ? 'Marked finished' : 'Reopened');
      break;
    }
    case 'newAdjust':
      openSheet(adjustForm(v));
      break;
    case 'close':
      setArmed(null);
      closeSheet();
      break;
    case 'undo': {
      const fn = undoFn;
      setUndoFn(null);
      $('#toast').hidden = true;
      if (fn) fn();
      break;
    }
    case 'editTx': {
      const t = byId(id);
      if (!t) break;
      setArmed(null);
      openSheet(t.type === 'adjust' ? adjustFromTx(t) : formFromTx(t));
      break;
    }
    case 'ftype':
      if (!form) break;
      form.type = v;
      form.categoryId = (
        state.categories.find((c) => c.type === (v === 'income' ? 'income' : 'expense')) || {}
      ).id;
      drawSheet();
      break;
    case 'fcur':
      if (!form) break;
      form.cur = v;
      drawSheet();
      break;
    case 'fsave':
      if (form) saveForm();
      break;
    case 'fdel':
      if (form) deleteForm();
      break;
    case 'hfilter':
      hist.filter = v;
      render();
      break;
    case 'month':
      hist.month = new Date(hist.month.getFullYear(), hist.month.getMonth() + +v, 1);
      render();
      break;
    case 'accView':
      hist.account = id;
      hist.filter = 'all';
      setView('history');
      render();
      window.scrollTo(0, 0);
      break;
    case 'accAll':
      hist.account = null;
      render();
      break;
    case 'toggleDisplay':
      state.settings.display = state.settings.display === 'USD' ? 'LBP' : 'USD';
      commit();
      break;
    case 'setDisplay':
      state.settings.display = v;
      commit();
      break;
    case 'setTheme':
      state.settings.theme = v;
      commit();
      break;
    case 'accAdd': {
      const input = $('#newAcc');
      if (input && addAccount(state, input.value)) commit();
      else toast('Type a name for the new fund.');
      break;
    }
    case 'accRemove':
      if (armed !== 'acc:' + id) {
        setArmed('acc:' + id);
        render();
      } else {
        setArmed(null);
        removeAccount(state, id);
        commit();
        toast('Fund removed. Any money in it moved to the main fund.');
      }
      break;
    case 'accRestore':
      if (!restoreAccount(state, id)) toast('There are too many funds. Remove one first.');
      else commit();
      break;
    case 'toggleOpening':
      setShowOpening(!showOpening);
      render();
      break;
    case 'backupSave':
      exportSave();
      break;
    case 'importPick':
      $('#importFile').click();
      break;
    case 'importConfirm':
      if (pendingImport && pendingImport.state) {
        setState(pendingImport.state);
        setPendingImport(null);
        hist.account = null;
        commit();
        toast('Backup restored');
      }
      break;
    case 'importCancel':
      setPendingImport(null);
      render();
      break;
    case 'rateConfirm':
      setArmed(null);
      setRate(+v);
      break;
    case 'rateCancel':
      setArmed(null);
      render();
      break;
    case 'reloadApp':
      location.reload();
      break;
  }
}

/* Sets the app's rate, with Undo: entries saved while a wrong rate is set keep it. */
function setRate(r) {
  const prev = state.rate;
  if (r === prev) return render();
  state.rate = r;
  commit();
  toast('Rate set to ' + r.toLocaleString('en-US') + ' LL', () => {
    state.rate = prev;
    commit();
  });
}

/* Fields of the open form update it as they are typed in, so a redraw never loses what was typed. */
function input(e) {
  const t = e.target;
  if (t.dataset.f && form) {
    form[t.dataset.f] = t.value;
    // Picking who paid changes which fees can be picked; a fee brings its event along.
    if (t.dataset.f === 'memberId') {
      const fee = state.fees.find((f) => f.id === form.feeId);
      if (!fee || !fee.memberIds.includes(form.memberId)) form.feeId = '';
      return drawSheet();
    }
    if (t.dataset.f === 'feeId') {
      const fee = state.fees.find((f) => f.id === form.feeId);
      if (fee && fee.eventId && !form.eventId) form.eventId = fee.eventId;
      return drawSheet();
    }
    if (t.closest('.thousands')) fitThousands(t);
    if (form.kind === 'adjust') updateAdjustPreview(form);
  }
}

/* Settings fields save when the person leaves the field. */
function change(e) {
  const t = e.target;
  if (t.dataset.feemember && form && form.kind === 'fee') {
    const id = t.dataset.feemember;
    form.memberIds = t.checked
      ? [...new Set([...form.memberIds, id])]
      : form.memberIds.filter((x) => x !== id);
    drawSheet();
  } else if (t.id === 'importFile') {
    if (t.files && t.files[0]) stageImport(t.files[0]);
  } else if (t.id === 'rate') {
    const r = Math.round(parseAmt(t.value));
    if (!(r > 0) || !isFinite(r)) {
      t.value = state.rate.toLocaleString('en-US');
      toast('Enter a rate above zero.');
    } else if (r !== state.rate && (r > state.rate * 2 || r < state.rate / 2)) {
      // A slip like 895 for 89,500 would be stamped on entries saved before it is noticed, so ask first.
      setArmed('rate:' + r);
      render();
    } else setRate(r);
  } else if (t.id === 'groupName') {
    state.group.name = t.value.trim().slice(0, 60);
    commit();
  } else if (t.dataset.accname) {
    // Saved without redrawing: the field already shows the new name, and a redraw while the person is
    // tapping the next button (the field loses focus first) would swallow that tap.
    if (renameAccount(state, t.dataset.accname, t.value)) save();
    else {
      toast('A fund needs a name.');
      render();
    }
  } else if (t.dataset.open) {
    const cur = t.dataset.cur,
      n = parseInput(t.value, cur);
    state.opening[t.dataset.open][cur] = isFinite(n) ? n : 0;
    commit();
  }
}

function keydown(e) {
  if (e.key === 'Escape' && sheetOpen()) {
    setArmed(null);
    closeSheet();
  } else if (e.key === 'Enter' && sheetOpen() && e.target.matches('input[data-f]:not([type=date])')) {
    e.preventDefault();
    saveForm();
  }
}

document.addEventListener('click', click);
document.addEventListener('input', input);
document.addEventListener('change', change);
document.addEventListener('keydown', keydown);

/* Another tab or the installed app saved: take its data and redraw. */
const redrawAfterSync = () => {
  render();
  if (sheetOpen()) drawSheet();
};
window.addEventListener('storage', (e) => {
  if (e.key === KEY && syncFromStorage()) redrawAfterSync();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (syncFromStorage()) redrawAfterSync();
  else if (!sheetOpen() && !document.activeElement.matches('input, textarea, select')) render();
});
window.addEventListener('scouts:update-ready', () => render());
