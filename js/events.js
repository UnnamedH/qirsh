/* All user interaction: one delegated listener per event type, dispatching on data-act. */
import { advanceOf, paybacksOf } from './advances.js';
import { exportCopy, exportRescued, exportSave, exportShare, saveFile, stageImport } from './backup.js';
import { csvName, monthlyCsv, monthlyWorkbook, reportName } from './report/monthly.js';
import { CHANGELOG } from './changelog.js';
import { ACCOUNTS, accName } from './config.js';
import { catName, catOf } from './ledger.js';
import { other, parseAmt, parseInput, toInput } from './money.js';
import { HINT_KEY } from './pwa.js';
import {
  adjustForm,
  adjustView,
  deleteAdjust,
  readAdjust,
  saveAdjust,
  setAdjustAccount,
  updateAdjustPreview,
} from './sheets/adjust.js';
import { readBudget, saveBudget } from './sheets/budget.js';
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
import { setNewsList } from './sheets/news.js';
import { afterRepay, repayForm, saveRepay } from './sheets/payback.js';
import { closeSheet, drawSheet, form, openSheet, setForm, sheetKind } from './sheets/sheet.js';
import { KEY, blankState, discardRescued, parseState, save, setState, state } from './state.js';
import { cloneForToday, templates } from './templates.js';
import { DEFAULT_ACCENT, applyTheme, hexRgb } from './theme.js';
import { amountText, txTitle } from './ui/format.js';
import { fitThousands } from './ui/amount.js';
import { commit, render } from './ui/render.js';
import { setUndoFn, toast, undoFn } from './ui/toast.js';
import {
  armed,
  hist,
  pendingImport,
  setArmed,
  setPendingImport,
  setQuickTab,
  setShowOpening,
  setView,
  showOpening,
  view,
} from './ui/ui-state.js';
import { $, firstGlyph, uid, ymd } from './util.js';
import { historyList, historyTxs } from './views/history.js';

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
    act !== 'discardRescued'
  )
    setArmed(null);
  switch (act) {
    case 'nav':
      setView(v);
      closeSheet();
      render();
      window.scrollTo(0, 0);
      break;
    case 'new':
      setForm(newTxForm(view === 'home' || view === 'history' ? 'expense' : 'expense'));
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
      const keep = { rate: state.rate, settings: state.settings, categories: state.categories };
      setState(Object.assign(blankState(), keep));
      commit();
      toast('Example data cleared. Set your starting balances in Settings.');
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
          : newTxForm('transfer', { from: 'wallet', to: 'savings' }),
      );
      openSheet('tx');
      break;
    case 'fsetrate':
      form.setRate = !form.setRate;
      updatePreview();
      break;
    case 'transferTo':
      setForm(newTxForm('transfer', { from: 'wallet', to: id }));
      openSheet('tx');
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
        if (form.from === form.to) form.to = form.from === 'wallet' ? 'savings' : 'wallet';
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
      setTimeout(() => {
        const n = $('#f-' + k + (ls.length - 1));
        if (n) n.focus();
      }, 40);
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
      setTimeout(() => {
        const n = $('#f-paid');
        if (n) n.focus();
      }, 40);
      break;
    case 'adj2Add':
      readForm();
      form.adj2 = { cur: other(form.adj.cur), v: '' };
      form.adj.touched = false;
      drawSheet();
      setTimeout(() => {
        const n = $('#f-adj2');
        if (n) n.focus();
      }, 40);
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
      setForm({ id: null, categoryId: null, period: 'month', amount: '', currency: 'USD' });
      openSheet('budget');
      break;
    case 'editBudget': {
      const b = state.budgets.find((x) => x.id === id);
      if (!b) break;
      setForm({
        id: b.id,
        categoryId: b.categoryId,
        period: b.period,
        amount: toInput(b.amount, b.currency),
        currency: b.currency,
      });
      openSheet('budget');
      break;
    }
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
      state.budgets = state.budgets.filter((b) => b.categoryId !== id);
      state.categories = state.categories.filter((x) => x.id !== id);
      commit();
      toast('Deleted ' + c.name);
      break;
    }
    case 'exportShare':
      exportShare();
      break;
    case 'showNews':
      setNewsList(CHANGELOG);
      setForm({});
      openSheet('news');
      break;
    case 'hideInstallHint':
      try {
        localStorage.setItem(HINT_KEY, 'dismissed');
      } catch (e) {}
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
        '<label class="field"><span>Paste a Qirsh backup</span><textarea id="importTxt"></textarea></label><div class="btn-row"><button class="btn sm" data-act="importLoad">Check backup</button></div>';
      $('#importTxt').focus();
      break;
    case 'importLoad':
      stageImport($('#importTxt').value);
      break;
    case 'importConfirm':
      setState(pendingImport);
      setPendingImport(null);
      commit();
      toast('Backup imported: ' + state.tx.length + ' entries');
      break;
    case 'importCancel':
      setPendingImport(null);
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
        const keep = { rate: state.rate, settings: state.settings, categories: state.categories };
        setState(Object.assign(blankState(), keep));
        commit();
        toast('All data cleared');
      }
      break;
  }
});

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
      const pick = ACCOUNTS.find((a) => a.id !== t.value).id;
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
    if (r > 0) {
      state.rate = r;
      commit();
      toast('Rate set to ' + r.toLocaleString('en-US') + ' LL');
    } else {
      t.value = state.rate.toLocaleString('en-US');
      toast('Enter a rate above zero.');
    }
  }
  if (t.dataset.open) {
    const n = parseInput(t.value, t.dataset.cur);
    state.opening[t.dataset.open][t.dataset.cur] = isFinite(n) ? n : 0;
    commit();
    toast(accName(t.dataset.open) + ' starting balance updated');
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
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  const next = parseState(e.newValue);
  if (!next) return;
  setState(next);
  render();
  if (sheetKind === 'tx' || sheetKind === 'repay' || sheetKind === 'adjust') drawSheet();
});

/* A new version finished downloading in the background (see js/pwa.js). */
window.addEventListener('qirsh:update-ready', () => render());
