/* All user interaction: one delegated listener per event type, dispatching on data-act. */
import { advanceOf, paybacksOf } from './advances.js';
import {
  exportCopy,
  exportRescued,
  exportSave,
  exportShare,
  saveFile,
  snoozeBackup,
  stageImport,
} from './backup.js';
import { csvName, monthlyCsv, monthlyWorkbook, reportName } from './report/monthly.js';
import { CHANGELOG } from './changelog.js';
import { feedbackTipSeen } from './feedback.js';
import { FRATA_URL, checkMove, moveLink, snoozeMove } from './handoff.js';
import {
  MAIN,
  accName,
  addAccount,
  otherAccount,
  removeAccount,
  renameAccount,
  restoreAccount,
  setSavings,
} from './accounts.js';
import { balances, budgetCats, catName, catOf } from './ledger.js';
import { fmt, other, parseAmt, parseInput, toInput } from './money.js';
import { dismissSafariTip } from './pwa.js';
import {
  adjustForm,
  adjustView,
  deleteAdjust,
  readAdjust,
  saveAdjust,
  setAdjustAccount,
  updateAdjustPreview,
} from './sheets/adjust.js';
import { readBudget, saveBudget, toggleBudgetCat } from './sheets/budget.js';
import { tryUnlock } from './plus.js';
import {
  autoTo,
  defaultAdjCur,
  formFromTx,
  newTxForm,
  openPaid,
  readForm,
  saveTx,
  updatePreview,
} from './sheets/entry.js';
import { markPriceTipDone } from './sheets/demo.js';
import { setNewsList } from './sheets/news.js';
import { afterRepay, repayForm, saveRepay } from './sheets/payback.js';
import { closeSheet, drawSheet, focusSoon, form, openSheet, setForm, sheetKind } from './sheets/sheet.js';
import {
  KEY,
  blankState,
  discardRescued,
  normalize,
  save,
  setState,
  state,
  syncFromStorage,
} from './state.js';
import { cloneForToday, templates } from './templates.js';
import { DEFAULT_ACCENT, applyTheme, hexRgb } from './theme.js';
import { amountText, txTitle } from './ui/format.js';
import { fitThousands } from './ui/amount.js';
import { commit, render } from './ui/render.js';
import { swipeEnd, swipeMove, swipeStart } from './ui/swipe.js';
import { setUndoFn, toast, undoFn } from './ui/toast.js';
import {
  armed,
  hist,
  pendingImport,
  pendingMove,
  setArmed,
  setPendingImport,
  setPendingMove,
  setQuickTab,
  setUi,
  setShowOpening,
  setView,
  showOpening,
  view,
} from './ui/ui-state.js';
import { isSampleBudget, isSampleTx } from './sample.js';
import { $, firstGlyph, uid, ymd } from './util.js';
import { historyList, historyTxs } from './views/history.js';

/* Shows a tab, from the tab bar or at the end of a swipe. */
function goTab(v) {
  hist.account = null;
  setView(v);
  closeSheet();
  render();
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act,
    v = el.dataset.v,
    id = el.dataset.id;
  if (
    act !== 'delCat' &&
    act !== 'wipe' &&
    act !== 'fdel' &&
    act !== 'bdel' &&
    act !== 'rdel' &&
    act !== 'keepRest' &&
    act !== 'adel' &&
    act !== 'accRemove' &&
    act !== 'discardRescued'
  )
    setArmed(null);
  switch (act) {
    case 'nav':
      goTab(v);
      break;
    case 'new':
      // On an account's page, a new entry starts in that account.
      setForm(newTxForm('expense', view === 'history' && hist.account ? { account: hist.account } : {}));
      openSheet('tx');
      break;
    case 'close':
      closeSheet();
      break;
    case 'undo':
      if (undoFn) {
        undoFn();
        setUndoFn(null);
      }
      $('#toast').hidden = true;
      break;
    case 'toggleDisplay':
      state.settings.display = state.settings.display === 'USD' ? 'LBP' : 'USD';
      commit();
      break;
    case 'quickTab':
      setQuickTab(v);
      render();
      break;
    case 'clearSample': {
      // Only the examples go: anything the user added on top of them stays.
      const prev = state;
      const own = state.tx.filter((t) => !isSampleTx(t));
      const keep = {
        rate: state.rate,
        settings: state.settings,
        categories: state.categories,
        accounts: keptAccounts(),
        tx: own,
        budgets: state.budgets.filter((b) => !isSampleBudget(b)),
        unlock: state.unlock,
      };
      setState(normalize(Object.assign(blankState(), keep)));
      commit();
      toast(
        own.length
          ? 'Example data cleared. Your ' +
              own.length +
              (own.length === 1 ? ' entry was' : ' entries were') +
              ' kept.'
          : 'Example data cleared. Set your starting balances in Settings.',
        () => {
          setState(prev);
          commit();
        },
      );
      break;
    }
    case 'repeat': {
      const tp = [...templates().frequent, ...templates().recent].find((x) => x.key === el.dataset.key);
      if (!tp) break;
      const t = cloneForToday(tp.tx);
      state.tx.push(t);
      commit();
      toast('Added ' + (t.note || txTitle(t)) + ' · ' + amountText(t), () => {
        state.tx = state.tx.filter((x) => x.id !== t.id);
        commit();
      });
      break;
    }
    case 'repeatEdit': {
      const tp = [...templates().frequent, ...templates().recent].find((x) => x.key === el.dataset.key);
      if (!tp) break;
      setForm(formFromTx(tp.tx, 'new'));
      openSheet('tx');
      break;
    }
    case 'newMove':
      setForm(
        v === 'exchange'
          ? newTxForm('exchange', {
              from: 'wallet',
              to: 'wallet',
              pay: [{ cur: 'USD', v: '' }],
              toCurrency: 'LBP',
            })
          : newTxForm('transfer', { from: MAIN, to: otherAccount(MAIN) }),
      );
      openSheet('tx');
      break;
    case 'fsetrate':
      form.setRate = !form.setRate;
      updatePreview();
      break;
    case 'accView':
      // An account's page is History showing only that account, with its balance and Correct balance.
      setView('history');
      hist.account = id;
      hist.filter = 'all';
      hist.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      closeSheet();
      render();
      window.scrollTo(0, 0);
      break;
    case 'accAll':
      hist.account = null;
      setView('home');
      render();
      window.scrollTo(0, 0);
      break;
    case 'facct':
      readForm();
      form.account = v;
      drawSheet();
      break;
    case 'fold':
      // Folded sections are kept as true; open ones are simply left out.
      if (state.settings.homeFold[v]) delete state.settings.homeFold[v];
      else state.settings.homeFold[v] = true;
      commit();
      break;
    case 'toggleAccs': {
      const open = el.getAttribute('aria-expanded') === 'true';
      state.settings.accountsOpen = !open;
      commit();
      break;
    }
    case 'accAdd': {
      const id = addAccount('New account');
      if (!id) {
        toast('That’s as many accounts as Frata holds. Remove one to add another.');
        break;
      }
      commit();
      // Straight into naming it.
      const n = $('[data-accname="' + id + '"]');
      if (n) {
        n.focus();
        n.select();
      }
      break;
    }
    case 'accRemove': {
      if (armed !== 'acc:' + v) {
        setArmed('acc:' + v);
        render();
        break;
      }
      setArmed(null);
      const prev = structuredClone(state),
        name = accName(v),
        left = balances()[v] || { USD: 0, LBP: 0 },
        moved = ['USD', 'LBP']
          .filter((c) => Math.round(left[c] * 100))
          .map((c) => fmt(left[c], c))
          .join(' and ');
      removeAccount(v);
      commit();
      toast(name + ' removed' + (moved ? ' · ' + moved + ' moved to ' + accName(MAIN) : ''), () => {
        setState(prev);
        commit();
        toast(name + ' is back.');
      });
      break;
    }
    case 'accRestore':
      if (restoreAccount(v)) commit();
      else toast('That’s as many accounts as Frata holds. Remove one first.');
      break;
    case 'toggleHide':
      state.settings.hide = !state.settings.hide;
      commit();
      break;
    case 'editTx': {
      const t = state.tx.find((x) => x.id === id);
      if (!t) break;
      if (t.type === 'adjust') {
        setForm(adjustView(t));
        openSheet('adjust');
        break;
      }
      if (t.type === 'repay') {
        const a = advanceOf(t);
        if (a) {
          setForm(repayForm(a, t, false));
          openSheet('repay');
        }
        break;
      }
      setForm(formFromTx(t, 'edit'));
      openSheet('tx');
      break;
    }
    case 'ftype':
      readForm();
      form.type = v;
      if (v === 'exchange') {
        form.pay = form.pay.slice(0, 1);
        form.to = form.from;
        form.toCurrency = other(form.pay[0].cur);
        form.toTouched = false;
        autoTo();
      } else if (v === 'transfer') {
        form.pay = form.pay.slice(0, 1);
        if (form.from === form.to) form.to = otherAccount(form.from);
        form.toCurrency = form.pay[0].cur;
        form.toTouched = false;
        autoTo();
      } else {
        const c = catOf(form.categoryId);
        if (c && c.type !== (v === 'income' ? 'income' : 'expense')) form.categoryId = null;
      }
      drawSheet();
      break;
    case 'lcur': {
      readForm();
      const k = el.dataset.k,
        ls = form[k];
      if (!ls || !ls[0]) break;
      ls[0].cur = v;
      if (k === 'pay') {
        if (form.back.length === 1 && !String(form.back[0].v).trim()) form.back[0].cur = other(v);
        if (form.paid) {
          if (!String(form.paid.v).trim()) form.paid.cur = other(v);
          if (!form.adj.curTouched) form.adj.cur = defaultAdjCur(form);
          form.adj.touched = false;
        }
        if (form.type === 'exchange') {
          form.toCurrency = other(v);
          form.toTouched = false;
        } else if (!form.toTouched) form.toCurrency = v;
        autoTo();
      }
      drawSheet();
      break;
    }
    case 'ladd': {
      readForm();
      const k = el.dataset.k,
        ls = form[k];
      if (ls.length >= 2) break;
      const cur = ls.length ? other(ls[0].cur) : form.pay.length > 1 ? 'LBP' : other(form.pay[0].cur);
      ls.push({ cur, v: '' });
      drawSheet();
      focusSoon('#f-' + k + (ls.length - 1));
      break;
    }
    case 'lrm': {
      readForm();
      form[el.dataset.k].splice(+el.dataset.i, 1);
      drawSheet();
      break;
    }
    case 'paidAdd':
      readForm();
      openPaid(form);
      drawSheet();
      focusSoon('#f-paid');
      break;
    case 'adj2Add':
      readForm();
      form.adj2 = { cur: other(form.adj.cur), v: '' };
      form.adj.touched = false;
      drawSheet();
      focusSoon('#f-adj2');
      break;
    case 'adj2Rm':
      readForm();
      form.adj2 = null;
      form.adj.touched = false;
      drawSheet();
      break;
    case 'paidRm':
      readForm();
      form.paid = null;
      form.adj = null;
      form.adj2 = null;
      drawSheet();
      break;
    case 'paidCur':
      readForm();
      form.paid.cur = v;
      if (!form.adj.curTouched) form.adj.cur = defaultAdjCur(form);
      form.adj.touched = false;
      drawSheet();
      break;
    case 'adjCur':
      readForm();
      form.adj.cur = v;
      if (form.adj2) form.adj2.cur = other(v);
      form.adj.curTouched = true;
      form.adj.touched = false;
      drawSheet();
      break;
    case 'ftocur':
      readForm();
      form.toCurrency = v;
      form.toTouched = false;
      autoTo();
      drawSheet();
      break;
    case 'catMove': {
      const i = state.categories.findIndex((x) => x.id === id);
      if (i < 0) break;
      const type = state.categories[i].type;
      let j = i + +v;
      while (j >= 0 && j < state.categories.length && state.categories[j].type !== type) j += +v;
      if (j < 0 || j >= state.categories.length) break;
      const tmp = state.categories[i];
      state.categories[i] = state.categories[j];
      state.categories[j] = tmp;
      commit();
      break;
    }
    case 'fcat':
      readForm();
      form.categoryId = v;
      drawSheet();
      break;
    case 'fsave':
      saveTx();
      break;
    case 'fadv':
      readForm();
      if (form.type === 'advance') form.type = 'expense';
      else {
        form.type = 'advance';
        form.back = [];
      }
      drawSheet();
      break;
    case 'newRepay': {
      const a = state.tx.find((x) => x.id === id && x.type === 'advance');
      if (!a) break;
      setForm(repayForm(a, null, sheetKind === 'tx'));
      openSheet('repay');
      break;
    }
    case 'editRepay': {
      const r = state.tx.find((x) => x.id === id && x.type === 'repay'),
        a = r && advanceOf(r);
      if (!a) break;
      setForm(repayForm(a, r, true));
      openSheet('repay');
      break;
    }
    case 'rsave':
      saveRepay();
      break;
    case 'rdel':
      if (armed !== 'repay') {
        setArmed('repay');
        drawSheet();
        break;
      }
      {
        setArmed(null);
        const r = state.tx.find((x) => x.id === form.id),
          a = r && advanceOf(r);
        state.tx = state.tx.filter((x) => x.id !== form.id);
        afterRepay(a);
        commit();
        toast('Payback deleted', () => {
          state.tx.push(r);
          commit();
          if (sheetKind === 'tx') drawSheet();
        });
      }
      break;
    case 'keepRest':
      readForm();
      setArmed(armed === 'keep' ? null : 'keep');
      drawSheet();
      break;
    case 'closeAdv': {
      readForm();
      const a = state.tx.find((x) => x.id === form.id && x.type === 'advance');
      if (!a) break;
      Object.assign(a, { closed: true, closedOn: ymd(new Date()), keptCat: v });
      setArmed(null);
      save();
      render();
      drawSheet();
      toast('Closed. The rest counts as ' + catName(v) + ' spending.');
      break;
    }
    case 'reopenAdv': {
      readForm();
      const a = state.tx.find((x) => x.id === form.id && x.type === 'advance');
      if (!a) break;
      delete a.closed;
      delete a.closedOn;
      delete a.keptCat;
      save();
      render();
      drawSheet();
      toast('Reopened');
      break;
    }
    case 'fdel':
      if (armed !== 'tx') {
        setArmed('tx');
        drawSheet();
        break;
      }
      {
        setArmed(null);
        const t = state.tx.find((x) => x.id === form.id),
          kids = t && t.type === 'advance' ? paybacksOf(t.id) : [];
        state.tx = state.tx.filter((x) => x.id !== form.id && !kids.includes(x));
        closeSheet();
        commit();
        toast(
          kids.length
            ? 'Deleted, with ' + kids.length + ' payback' + (kids.length > 1 ? 's' : '')
            : 'Deleted',
          () => {
            state.tx.push(t, ...kids);
            commit();
          },
        );
      }
      break;
    case 'newAdjust':
      setForm(adjustForm(v));
      openSheet('adjust');
      break;
    case 'acount':
      readAdjust();
      form.count = v === '1';
      drawSheet();
      break;
    case 'aexp':
    case 'ainc':
      readAdjust();
      form[act === 'aexp' ? 'expCat' : 'incCat'] = v;
      drawSheet();
      break;
    case 'asave':
      saveAdjust();
      break;
    case 'adel':
      if (armed !== 'adjust') {
        setArmed('adjust');
        drawSheet();
        break;
      }
      setArmed(null);
      deleteAdjust();
      break;
    case 'toggleOpening':
      setShowOpening(!showOpening);
      render();
      break;
    case 'newBudget':
      setForm({ id: null, categoryIds: [], period: 'month', amount: '', currency: 'USD' });
      openSheet('budget');
      break;
    case 'editBudget': {
      const b = state.budgets.find((x) => x.id === id);
      if (!b) break;
      setForm({
        id: b.id,
        categoryIds: [...budgetCats(b)],
        period: b.period,
        amount: toInput(b.amount, b.currency),
        currency: b.currency,
      });
      openSheet('budget');
      break;
    }
    case 'bcat':
      readBudget();
      toggleBudgetCat(v);
      drawSheet();
      break;
    case 'bcatAll':
      readBudget();
      form.categoryIds = [];
      drawSheet();
      break;
    case 'bperiod':
      readBudget();
      form.period = v;
      drawSheet();
      break;
    case 'bcur':
      readBudget();
      form.currency = v;
      drawSheet();
      break;
    case 'bsave':
      saveBudget();
      break;
    case 'bdel':
      if (armed !== 'budget') {
        setArmed('budget');
        drawSheet();
        break;
      }
      {
        setArmed(null);
        const b = state.budgets.find((x) => x.id === form.id);
        state.budgets = state.budgets.filter((x) => x.id !== form.id);
        closeSheet();
        commit();
        toast('Budget deleted', () => {
          state.budgets.push(b);
          commit();
        });
      }
      break;
    case 'month':
      hist.month = new Date(hist.month.getFullYear(), hist.month.getMonth() + +v, 1);
      render();
      break;
    case 'hmode':
      hist.mode = v;
      render();
      break;
    case 'hfilter':
      hist.filter = v;
      render();
      break;
    case 'setDisplay':
      state.settings.display = v;
      commit();
      break;
    case 'setWeek':
      state.settings.weekStart = +v;
      commit();
      break;
    case 'setEntryStyle':
      state.settings.entryStyle = v;
      commit();
      break;
    case 'setTheme':
      state.settings.theme = v;
      commit();
      break;
    case 'setAccent':
      state.settings.accent = v === DEFAULT_ACCENT ? null : v;
      commit();
      break;
    case 'addCat': {
      const n = $('#newCatName').value.trim();
      if (!n) {
        toast('Type a name for the category first.');
        break;
      }
      const ic = firstGlyph($('#newCatIcon').value.trim());
      state.categories.push(
        Object.assign({ id: 'c' + uid(), name: n, type: $('#newCatType').value }, ic ? { icon: ic } : {}),
      );
      commit();
      toast('Added ' + n);
      break;
    }
    case 'delCat': {
      if (armed !== 'cat:' + id) {
        setArmed('cat:' + id);
        render();
        break;
      }
      setArmed(null);
      const c = catOf(id);
      if (!c) break;
      const to = c.type === 'expense' ? 'other' : 'other-in';
      state.tx.forEach((t) => {
        if (t.categoryId === id) t.categoryId = to;
        if (t.keptCat === id) t.keptCat = to;
      });
      // A budget loses the deleted category; one left with none would become an overall cap, so it goes.
      state.budgets = state.budgets.filter((b) => {
        const ids = budgetCats(b);
        if (!ids.includes(id)) return true;
        b.categoryIds = ids.filter((x) => x !== id);
        delete b.categoryId;
        return b.categoryIds.length > 0;
      });
      state.categories = state.categories.filter((x) => x.id !== id);
      commit();
      toast('Deleted ' + c.name);
      break;
    }
    case 'backupMode':
      setUi.backup = setUi.backup === v ? null : v;
      render();
      break;
    case 'catEdit':
      setUi.catEdit = !setUi.catEdit;
      setArmed(null);
      render();
      break;
    case 'termsOpen':
      setForm({});
      openSheet('terms');
      break;
    case 'plusOpen':
      setForm({});
      openSheet('plus');
      break;
    case 'plusUnlock':
      unlockPlus();
      break;
    case 'supportOpen':
      setForm({});
      openSheet('support');
      break;
    case 'feedbackOpen':
      feedbackTipSeen();
      render();
      setForm({});
      openSheet('feedback');
      break;
    case 'feedbackTipDone':
      feedbackTipSeen();
      render();
      break;
    case 'backupNow': {
      // Straight to the ways of backing up, not just the section.
      setUi.backup = 'out';
      setView('settings');
      render();
      const sec = $('#backupSec');
      if (sec) sec.scrollIntoView();
      break;
    }
    case 'backupLater':
      snoozeBackup();
      render();
      break;
    case 'exportShare':
      exportShare();
      break;
    case 'showNews':
      setNewsList(CHANGELOG);
      setForm({});
      openSheet('news');
      break;
    case 'tipShow':
      setForm({});
      openSheet('demo');
      break;
    case 'tipClose':
      markPriceTipDone();
      if (sheetKind) closeSheet();
      render();
      break;
    case 'tipUse':
      markPriceTipDone();
      state.settings.entryStyle = 'price';
      closeSheet();
      commit();
      toast('Price first is on. Tap + to try it.');
      break;
    case 'safariTipDone':
      dismissSafariTip(v);
      render();
      break;
    case 'exportSave':
      exportSave();
      break;
    case 'reportXlsx':
      saveFile(monthlyWorkbook(hist.month), reportName(hist.month));
      break;
    case 'reportCsv':
      saveFile(monthlyCsv(hist.month), csvName(hist.month));
      break;
    case 'reloadApp':
      location.reload();
      break;
    case 'exportRescued':
      exportRescued();
      break;
    case 'discardRescued':
      if (armed !== 'rescue') {
        setArmed('rescue');
        render();
        break;
      }
      setArmed(null);
      discardRescued();
      render();
      toast('Unreadable data discarded');
      break;
    case 'exportCopy':
      exportCopy();
      break;
    case 'importPick':
      $('#importFile').value = '';
      $('#importFile').click();
      break;
    case 'importPaste':
      $('#importArea').innerHTML =
        '<label class="field"><span>Paste a Frata backup</span><textarea id="importTxt"></textarea></label><div class="btn-row"><button class="btn sm" data-act="importLoad">Check backup</button></div>';
      $('#importTxt').focus();
      break;
    case 'importLoad':
      stageImport($('#importTxt').value);
      break;
    case 'importConfirm': {
      const next = pendingImport;
      setPendingImport(null);
      replaceData(next, 'Backup imported: ' + next.tx.length + ' entries');
      break;
    }
    case 'importCancel':
      setPendingImport(null);
      render();
      break;
    case 'moveConfirm': {
      const next = pendingMove;
      setPendingMove(null);
      replaceData(next, 'Your data is here: ' + next.tx.length + ' entries');
      break;
    }
    case 'moveGo':
      moveAway();
      break;
    case 'moveLater':
      snoozeMove();
      render();
      break;
    case 'moveCancel':
      setPendingMove(null);
      render();
      break;
    case 'rateConfirm':
      setRate(+v);
      break;
    case 'rateCancel':
      render();
      break;
    case 'wipe':
      if (armed !== 'wipe') {
        setArmed('wipe');
        render();
        break;
      }
      {
        setArmed(null);
        const prev = state;
        const keep = {
          rate: state.rate,
          settings: state.settings,
          categories: state.categories,
          accounts: keptAccounts(),
          unlock: state.unlock,
        };
        setState(normalize(Object.assign(blankState(), keep)));
        commit();
        toast('All data cleared', () => {
          setState(prev);
          commit();
          toast('Your data is back.');
        });
      }
      break;
  }
});

/* Checks the typed Frata Plus code on the phone and, if it's genuine, keeps it with the data. */
async function unlockPlus() {
  const field = $('#plus-code');
  if (!field) return;
  form.code = field.value;
  const info = await tryUnlock(field.value);
  if (sheetKind !== 'plus') return;
  if (!info) {
    const err = $('#plus-err');
    err.textContent = field.value.trim()
      ? 'That code doesn’t work. Check it was copied in full.'
      : 'Paste the code you were sent.';
    err.hidden = false;
    return;
  }
  commit();
  drawSheet();
  toast('Frata Plus unlocked. Thank you!');
}

/* Starting over keeps the accounts in use, like the categories; removed ones go, as their entries do. */
const keptAccounts = () => state.accounts.filter((a) => !a.hidden).map((a) => Object.assign({}, a));

/* Opens frata.cc carrying this copy's data. Too much for a link: off to the backup instead. */
async function moveAway() {
  const empty = state.sample && !state.tx.some((t) => !isSampleTx(t));
  const link = empty ? FRATA_URL : await moveLink(state);
  if (!link) {
    toast('Too much data for a link. Make a backup here and import it on frata.cc.');
    setView('settings');
    render();
    return;
  }
  location.href = link;
}

/* Swaps in imported or moved data, with Undo to bring back what was there before. */
function replaceData(next, message) {
  const prev = state;
  setState(next);
  commit();
  toast(message, () => {
    setState(prev);
    commit();
    toast('Import undone. Your data is back.');
  });
}

/* Sets the app's rate, with Undo: entries saved while a wrong rate is set keep it. */
function setRate(r) {
  const prev = state.rate;
  if (r === prev) return;
  state.rate = r;
  commit();
  toast('Rate set to ' + r.toLocaleString('en-US') + ' LL', () => {
    state.rate = prev;
    commit();
  });
}

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.closest && t.closest('.thousands')) fitThousands(t);
  if (sheetKind === 'tx' && form) {
    if (t.dataset.line) {
      const ln = (form[t.dataset.line] || [])[+t.dataset.i];
      if (ln) ln.v = t.value;
      if (t.dataset.line === 'pay' && t.dataset.i === '0') autoTo();
      updatePreview();
    } else if (t.id === 'f-paid') {
      form.paid.v = t.value;
      updatePreview();
    } else if (t.id === 'f-adj2') {
      form.adj2.v = t.value;
      updatePreview();
    } else if (t.id === 'f-adj') {
      form.adj.v = t.value;
      form.adj.touched = true;
      updatePreview();
    } else if (t.id === 'f-toamount') {
      form.toAmount = t.value;
      form.toTouched = true;
      if (form.type === 'exchange') updatePreview();
    } else if (t.id === 'f-xrate') {
      form.xrate = t.value;
      form.toTouched = false;
      autoTo();
      const ta = $('#f-toamount');
      if (ta) ta.value = form.toAmount;
      updatePreview();
    }
  }
  if (sheetKind === 'adjust' && t.id && t.id.startsWith('a-')) {
    readAdjust();
    updateAdjustPreview();
  }
  if (t.id === 'accentPick' && hexRgb(t.value)) {
    state.settings.accent = t.value.toUpperCase();
    applyTheme();
  }
  if (t.id === 'hq') {
    hist.q = t.value;
    $('#histList').innerHTML = historyList(historyTxs());
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (sheetKind === 'tx' && (t.id === 'f-from' || t.id === 'f-to')) {
    readForm();
    if (form.from === form.to) {
      const pick = otherAccount(t.value);
      if (t.id === 'f-from') form.to = pick;
      else form.from = pick;
    }
    autoTo();
    drawSheet();
    return;
  }
  if (sheetKind === 'adjust' && t.id === 'a-acct') {
    setAdjustAccount(t.value);
    drawSheet();
    return;
  }
  if (sheetKind === 'tx' && t.id === 'f-acct') {
    readForm();
    updatePreview();
    return;
  }
  if (t.id === 'accentPick' && hexRgb(t.value)) {
    state.settings.accent = t.value.toUpperCase();
    commit();
  }
  if (t.id === 'rate') {
    const r = parseAmt(t.value);
    if (!(r > 0)) {
      t.value = state.rate.toLocaleString('en-US');
      toast('Enter a rate above zero.');
    } else if (r !== state.rate && (r > state.rate * 2 || r < state.rate / 2)) {
      // A slip like 895 for 89,500 would be stamped on entries saved before it is noticed, so ask first.
      setArmed('rate:' + r);
      render();
    } else setRate(r);
  }
  if (t.dataset.accname) {
    // Saved without redrawing: the field already shows the new name, and a redraw while the person is
    // tapping the next button (the field loses focus first) would swallow that tap.
    if (renameAccount(t.dataset.accname, t.value)) save();
    else {
      render();
      toast('An account needs a name.');
    }
    return;
  }
  if (t.dataset.accsave) {
    setSavings(t.dataset.accsave, t.checked);
    commit();
    return;
  }
  if (t.dataset.open) {
    // An empty field means zero; anything else that isn't a number is refused, not saved as zero.
    const n = t.value.trim() === '' ? 0 : parseInput(t.value, t.dataset.cur);
    if (isFinite(n)) {
      state.opening[t.dataset.open][t.dataset.cur] = n;
      commit();
      toast(accName(t.dataset.open) + ' starting balance updated');
    } else {
      render();
      toast('That isn’t a number, so the starting balance wasn’t changed.');
    }
  }
  if (t.dataset.caticon) {
    const c = catOf(t.dataset.caticon);
    if (c) {
      const g = firstGlyph(t.value.trim());
      if (g) c.icon = g;
      else delete c.icon;
      commit();
    }
  }
  if (t.dataset.cat) {
    const c = catOf(t.dataset.cat);
    if (c && t.value.trim()) {
      c.name = t.value.trim();
      save();
    }
  }
  if (t.id === 'importFile' && t.files && t.files[0]) {
    const r = new FileReader();
    r.onload = () => stageImport(String(r.result));
    r.readAsText(t.files[0]);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheetKind) closeSheet();
  if (e.key === 'Enter' && sheetKind && e.target.tagName === 'INPUT') {
    e.preventDefault();
    if (sheetKind === 'tx') saveTx();
    else if (sheetKind === 'repay') saveRepay();
    else if (sheetKind === 'budget') saveBudget();
    else if (sheetKind === 'adjust' && form.mode === 'new') saveAdjust();
  }
});

/* Another copy of the app (a second tab, or the installed app next to a browser tab) saved a change.
   Take its state, so this copy neither shows stale data nor writes over the change on its next save. */
function redrawAfterSync() {
  render();
  if (sheetKind === 'tx' || sheetKind === 'repay' || sheetKind === 'adjust') drawSheet();
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY && syncFromStorage()) redrawAfterSync();
});

/* Coming back to the app: a copy asleep in the background can miss the `storage` event, so look for
   newer data now. Re-drawing also brings the date, the month and the budgets' days left up to date
   when the app was left open overnight. */
function onReturn() {
  if (document.visibilityState !== 'visible') return;
  if (syncFromStorage()) redrawAfterSync();
  else if (!sheetKind && !document.activeElement.matches('input, textarea, select')) render();
}
document.addEventListener('visibilitychange', onReturn);
window.addEventListener('pageshow', onReturn);

/* The phone switched between light and dark: the theme follows it, and so does the tab icon. */
if (window.matchMedia) {
  const dark = matchMedia('(prefers-color-scheme: dark)');
  if (dark.addEventListener) dark.addEventListener('change', () => applyTheme());
}

/* A new version finished downloading in the background (see js/pwa.js). */
window.addEventListener('qirsh:update-ready', () => render());
window.addEventListener('hashchange', checkMove);

/* Swipes: drag a sheet down to close it, swipe sideways between tabs (js/ui/swipe.js). The move
   listener isn't passive, so a swipe can stop the page scrolling while it runs. */
document.addEventListener('touchstart', swipeStart, { passive: true });
document.addEventListener('touchmove', swipeMove, { passive: false });
document.addEventListener('touchend', () => swipeEnd(goTab));
document.addEventListener('touchcancel', () => swipeEnd(goTab));
