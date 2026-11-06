/* Paybacks for money paid on someone else's behalf. */
import { advanceOf, fmtAdv, owed, paybacksOf } from '../advances.js';
import { ICON } from '../icons.js';
import { catName } from '../ledger.js';
import { fmt, fromUSD, parseAmt, payParts } from '../money.js';
import { formFromTx, moneyLines, readForm } from './entry.js';
import { closeSheet, drawSheet, form, openSheet, setForm, sheetKind } from './sheet.js';
import { state } from '../state.js';
import { commit } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { armed } from '../ui/ui-state.js';
import { $, dayLabel, esc, uid, ymd } from '../util.js';

export function advanceBlock(f) {
  const a = state.tx.find((x) => x.id === f.id && x.type === 'advance');
  if (!a) return '';
  const o = owed(a),
    pb = paybacksOf(a.id);
  let h =
    '<div class="card"><div class="b-top"><span class="b-name">Paid back</span><span class="b-nums">' +
    fmtAdv(a, o.back) +
    ' <span class="muted">/ ' +
    fmtAdv(a, o.cost) +
    '</span></span></div>' +
    '<div class="bar"><i style="width:' +
    (o.cost > 0 ? Math.min(100, (o.back / o.cost) * 100) : 0).toFixed(1) +
    '%"></i></div>';
  if (pb.length)
    h +=
      '<div class="list">' +
      pb
        .map(
          (r) =>
            '<button class="row" data-act="editRepay" data-id="' +
            esc(r.id) +
            '"><span class="row-main"><span class="row-title">' +
            esc(dayLabel(r.date)) +
            '</span>' +
            (r.note ? '<span class="row-sub">' + esc(r.note) + '</span>' : '') +
            '</span><span class="amt tr">' +
            payParts(r)
              .map((x) => '+' + x)
              .join(' ') +
            '</span></button>',
        )
        .join('') +
      '</div>';
  if (a.closed)
    h +=
      '<p class="note">Closed ' +
      esc(dayLabel(a.closedOn || a.date)) +
      '.' +
      (o.left > 0.005
        ? ' The ' +
          fmtAdv(a, o.left) +
          ' you didn’t get back counts as ' +
          esc(catName(a.keptCat)) +
          ' spending.'
        : '') +
      '</p><div class="btn-row"><button class="btn sm" data-act="reopenAdv">Reopen</button></div>';
  else if (o.left < 0.005) h += '<p class="note">All paid back.</p>';
  else {
    h +=
      '<p class="note">' +
      fmtAdv(a, o.left) +
      ' still owed.</p><div class="btn-row"><button class="btn sm primary" data-act="newRepay" data-id="' +
      esc(a.id) +
      '">Got paid back</button><button class="btn sm" data-act="keepRest" aria-pressed="' +
      (armed === 'keep') +
      '">Won’t get the rest</button></div>';
    if (armed === 'keep')
      h +=
        '<span class="sub-label">Count the ' +
        fmtAdv(a, o.left) +
        ' as my own spending, in:</span><div class="chips">' +
        state.categories
          .filter((c) => c.type === 'expense')
          .map(
            (c) =>
              '<button class="chip" data-act="closeAdv" data-v="' +
              esc(c.id) +
              '">' +
              (c.icon ? esc(c.icon) + ' ' : '') +
              esc(c.name) +
              '</button>',
          )
          .join('') +
        '</div>';
  }
  return h + '</div>';
}

export function repayForm(a, r, returnTo) {
  if (r)
    return {
      type: 'repay',
      mode: 'edit',
      id: r.id,
      advanceId: a.id,
      pay: [{ cur: r.currency, v: String(r.amount) }],
      back: [],
      note: r.note || '',
      date: r.date,
      toTouched: true,
      returnTo,
    };
  const left = fromUSD(owed(a).left, a.currency);
  return {
    type: 'repay',
    mode: 'new',
    id: null,
    advanceId: a.id,
    pay: [
      {
        cur: a.currency,
        v: left > 0 ? String(a.currency === 'USD' ? Math.round(left * 100) / 100 : Math.round(left)) : '',
      },
    ],
    back: [],
    note: '',
    date: ymd(new Date()),
    toTouched: true,
    returnTo,
  };
}

export function repaySheet() {
  const f = form,
    a = advanceOf(f),
    o = a ? owed(a) : null;
  let h =
    '<div class="sheet-head"><h2>' +
    (f.mode === 'edit' ? 'Edit payback' : 'Paid back') +
    '</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>';
  if (a)
    h +=
      '<p class="note">From <strong>' +
      esc(a.who || 'someone') +
      '</strong>' +
      (a.note ? ' for ' + esc(a.note) : '') +
      '. ' +
      fmtAdv(a, o.left) +
      ' of ' +
      fmtAdv(a, o.cost) +
      ' still owed.</p>';
  h += moneyLines('pay', f.pay.slice(0, 1));
  h +=
    '<div class="grid2"><label class="field"><span>Note</span><input id="f-note" autocomplete="off" value="' +
    esc(f.note) +
    '" placeholder="Optional"></label><label class="field"><span>Date</span><input id="f-date" type="date" value="' +
    esc(f.date) +
    '"></label></div>';
  h += '<p class="note">Goes back into your wallet. It isn’t counted as income.</p>';
  h +=
    '<p class="form-error" id="f-err" hidden></p><div class="sheet-actions">' +
    (f.mode === 'edit'
      ? '<button class="btn danger' +
        (armed === 'repay' ? ' armed' : '') +
        '" data-act="rdel">' +
        (armed === 'repay' ? 'Tap to confirm' : 'Delete') +
        '</button>'
      : '') +
    '<button class="btn primary" data-act="rsave">' +
    (f.mode === 'edit' ? 'Save changes' : 'Add payback') +
    '</button></div>';
  return h;
}

/* After a payback opened from an entry's sheet, go back to that entry; from Home, just close. */
export function afterRepay(a) {
  if (form.returnTo && a) {
    setForm(formFromTx(a, 'edit'));
    openSheet('tx');
  } else closeSheet();
}

export function saveRepay() {
  readForm();
  const f = form,
    err = $('#f-err'),
    fail = (m) => {
      err.textContent = m;
      err.hidden = false;
    };
  const n = parseAmt(f.pay[0].v);
  if (!(n > 0)) return fail('Enter an amount above zero.');
  if (!f.date) return fail('Pick a date.');
  const a = advanceOf(f);
  if (!a) return fail('The entry this payback belongs to was deleted.');
  const t = {
    id: f.id || uid(),
    type: 'repay',
    advanceId: a.id,
    amount: n,
    currency: f.pay[0].cur,
    note: f.note.trim(),
    date: f.date,
    account: 'wallet',
    createdAt: Date.now(),
  };
  if (f.mode === 'edit') {
    const i = state.tx.findIndex((x) => x.id === f.id);
    if (i >= 0) {
      t.createdAt = state.tx[i].createdAt || t.createdAt;
      state.tx[i] = t;
    }
    afterRepay(a);
    commit();
    toast('Saved');
    return;
  }
  state.tx.push(t);
  afterRepay(a);
  commit();
  const o = owed(a);
  toast(
    o.left < 0.005
      ? 'All paid back by ' + (a.who || 'them')
      : 'Got ' + fmt(n, t.currency) + ' back · ' + fmtAdv(a, o.left) + ' still owed',
    () => {
      state.tx = state.tx.filter((x) => x.id !== t.id);
      commit();
      if (sheetKind === 'tx') drawSheet();
    },
  );
}
