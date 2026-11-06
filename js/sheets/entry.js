/* Sheet for adding and editing entries: expense, income, transfer, exchange, paid for others. */
import { paybacksOf } from '../advances.js';
import { ACCOUNTS, accName } from '../config.js';
import { ICON } from '../icons.js';
import { backVec, fmt, other, parseAmt, payParts, vUSD } from '../money.js';
import { advanceBlock } from './payback.js';
import { closeSheet, form } from './sheet.js';
import { state } from '../state.js';
import { txRate, txTitle } from '../ui/format.js';
import { commit } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { armed } from '../ui/ui-state.js';
import { $, esc, uid, ymd } from '../util.js';

/* New entries start in the currency of the most recently saved one. */
function lastCur() {
  let t = null;
  for (const x of state.tx) if (!t || (x.createdAt || 0) > (t.createdAt || 0)) t = x;
  return t && t.currency === 'LBP' ? 'LBP' : 'USD';
}

export function newTxForm(type, extra) {
  const c = lastCur();
  return Object.assign(
    {
      mode: 'new',
      type: type || 'expense',
      pay: [{ cur: c, v: '' }],
      back: [],
      categoryId: null,
      who: '',
      note: '',
      date: ymd(new Date()),
      from: 'wallet',
      to: 'savings',
      toAmount: '',
      toCurrency: c,
      toTouched: false,
      xrate: state.rate.toLocaleString('en-US'),
      setRate: false,
    },
    extra || {},
  );
}

export function formFromTx(t, mode) {
  const pay = [{ cur: t.currency, v: String(t.amount) }];
  if (t.amount2) pay.push({ cur: other(t.currency), v: String(t.amount2) });
  const k = backVec(t),
    back = [];
  [other(t.currency), t.currency].forEach((c) => {
    if (k[c] > 0) back.push({ cur: c, v: String(k[c]) });
  });
  const isX = t.type === 'transfer' && t.from === t.to,
    r = txRate(t);
  return {
    mode,
    id: mode === 'edit' ? t.id : null,
    type: isX ? 'exchange' : t.type,
    pay: t.type === 'transfer' ? pay.slice(0, 1) : pay,
    xrate: Math.round(r || state.rate).toLocaleString('en-US'),
    setRate: false,
    back: t.type === 'expense' ? back : [],
    categoryId: t.categoryId || null,
    who: t.who || '',
    note: t.note || '',
    date: mode === 'edit' ? t.date : ymd(new Date()),
    from: t.from || 'wallet',
    to: t.to || 'savings',
    toAmount: t.toAmount != null ? String(t.toAmount) : '',
    toCurrency: t.toCurrency || t.currency,
    toTouched: t.type === 'transfer' && t.toCurrency !== t.currency,
  };
}

export function curToggle(act, val, attrs) {
  return (
    '<div class="seg">' +
    [
      ['USD', 'USD'],
      ['LBP', 'LL'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="' +
          act +
          '" data-v="' +
          k +
          '"' +
          (attrs || '') +
          ' aria-pressed="' +
          (val === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div>'
  );
}

const curLabel = (c) => (c === 'USD' ? '$' : 'LL');

export function moneyLines(kind, lines) {
  const many = lines.length > 1;
  return (
    '<div class="lines">' +
    lines
      .map(
        (ln, i) =>
          '<div class="amount-row"><input id="f-' +
          kind +
          i +
          '" data-line="' +
          kind +
          '" data-i="' +
          i +
          '" class="amount-input' +
          (kind === 'back' ? ' sm' : '') +
          '" inputmode="decimal" autocomplete="off" placeholder="0" value="' +
          esc(ln.v) +
          '" aria-label="' +
          (kind === 'pay' ? 'Amount' : 'Change') +
          ' in ' +
          (ln.cur === 'USD' ? 'USD' : 'LL') +
          '">' +
          (ln.cur === 'LBP'
            ? '<button class="k000" data-act="k000" data-k="' +
              kind +
              '" data-i="' +
              i +
              '" aria-label="Add three zeros">000</button>'
            : many
              ? '<span class="k000 ghost" aria-hidden="true">000</span>'
              : '') +
          (many
            ? '<span class="cur-tag">' + (ln.cur === 'USD' ? 'USD' : 'LL') + '</span>'
            : curToggle('lcur', ln.cur, ' data-k="' + kind + '"')) +
          (kind === 'back' || i > 0
            ? '<button class="icon-btn" data-act="lrm" data-k="' +
              kind +
              '" data-i="' +
              i +
              '" aria-label="Remove this amount">' +
              ICON.close +
              '</button>'
            : many
              ? '<span class="icon-btn" aria-hidden="true"></span>'
              : '') +
          '</div>',
      )
      .join('') +
    '</div>'
  );
}

export function txSheet() {
  const f = form,
    isX = f.type === 'exchange',
    isT = f.type === 'transfer' || isX,
    isE = f.type === 'expense',
    isA = f.type === 'advance';
  const cats = state.categories.filter((c) => c.type === (f.type === 'income' ? 'income' : 'expense'));
  let h =
    '<div class="sheet-head"><h2>' +
    (f.mode === 'edit' ? 'Edit entry' : 'New entry') +
    '</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>';
  h +=
    '<div class="seg wide">' +
    [
      ['expense', 'Expense'],
      ['income', 'Income'],
      ['transfer', 'Transfer'],
      ['exchange', 'Exchange'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="ftype" data-v="' +
          k +
          '" aria-pressed="' +
          (f.type === k || (isA && k === 'expense')) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div>';
  if (isT && !isX)
    h +=
      '<div class="grid2"><label class="field"><span>From</span><select id="f-from">' +
      ACCOUNTS.map(
        (a) =>
          '<option value="' + a.id + '"' + (f.from === a.id ? ' selected' : '') + '>' + a.name + '</option>',
      ).join('') +
      '</select></label>' +
      '<label class="field"><span>To</span><select id="f-to">' +
      ACCOUNTS.map(
        (a) =>
          '<option value="' + a.id + '"' + (f.to === a.id ? ' selected' : '') + '>' + a.name + '</option>',
      ).join('') +
      '</select></label></div>';
  if (isX) h += '<span class="sub-label" style="margin-bottom:-12px">You give</span>';
  h +=
    moneyLines('pay', isT ? f.pay.slice(0, 1) : f.pay) + (isX ? '' : '<p class="hint" id="f-preview"></p>');
  if (!isT) {
    const links = [];
    if (f.pay.length === 1)
      links.push(
        '<button class="link" data-act="ladd" data-k="pay">+ Also ' +
          (isE || isA ? 'paid' : 'got') +
          ' in ' +
          curLabel(other(f.pay[0].cur)) +
          '</button>',
      );
    if (isE && !f.back.length)
      links.push('<button class="link" data-act="ladd" data-k="back">+ Got change back</button>');
    if (links.length) h += '<div class="links">' + links.join('') + '</div>';
    if (isE && f.back.length)
      h +=
        '<div class="sub-lines"><span class="sub-label">Change back</span>' +
        moneyLines('back', f.back) +
        '</div>' +
        (f.back.length === 1
          ? '<div class="links" style="margin-top:-8px"><button class="link" data-act="ladd" data-k="back">+ Also got ' +
            curLabel(other(f.back[0].cur)) +
            ' back</button></div>'
          : '');
    if (isE || isA)
      h +=
        '<button class="chip sm" data-act="fadv" aria-pressed="' +
        isA +
        '">' +
        (isA ? '✓ ' : '') +
        'Someone will pay me back</button>';
  }
  if (isX) {
    const gc = other(f.pay[0].cur);
    h +=
      '<div class="sub-lines"><span class="sub-label">You get</span><div class="amount-row"><input id="f-toamount" class="amount-input" inputmode="decimal" autocomplete="off" placeholder="0" value="' +
      esc(f.toAmount) +
      '" aria-label="Amount received in ' +
      (gc === 'USD' ? 'USD' : 'LL') +
      '">' +
      (gc === 'LBP'
        ? '<button class="k000" data-act="k000to" aria-label="Add three zeros">000</button>'
        : '') +
      '<span class="cur-tag">' +
      (gc === 'USD' ? 'USD' : 'LL') +
      '</span></div></div>';
    h +=
      '<div class="grid2"><label class="field"><span>Account</span><select id="f-acct">' +
      ACCOUNTS.map(
        (a) =>
          '<option value="' + a.id + '"' + (f.from === a.id ? ' selected' : '') + '>' + a.name + '</option>',
      ).join('') +
      '</select></label>' +
      '<label class="field"><span>Rate</span><span class="rate-in"><span>$1 =</span><input id="f-xrate" class="input num" inputmode="numeric" autocomplete="off" value="' +
      esc(f.xrate) +
      '" aria-label="LL per dollar"><span>LL</span></span></label></div>';
    h +=
      '<p class="hint" id="f-preview" style="margin:0"></p><button class="chip sm" id="f-setrate" data-act="fsetrate" aria-pressed="' +
      f.setRate +
      '" hidden></button>';
  } else if (isT) {
    h +=
      '<div class="sub-lines"><span class="sub-label">Arrives as</span><div class="amount-row"><input id="f-toamount" class="amount-input sm" inputmode="decimal" autocomplete="off" placeholder="0" value="' +
      esc(f.toAmount) +
      '" aria-label="Amount received">' +
      curToggle('ftocur', f.toCurrency) +
      '</div></div>' +
      '<p class="note">Same currency moves it as is. Pick the other currency to exchange on the way, like cash dollars into Whish.</p>';
  } else if (isA)
    h +=
      '<label class="field"><span>Who will pay you back?</span><input id="f-who" list="whoList" autocomplete="off" value="' +
      esc(f.who) +
      '" placeholder="e.g. Scouts"></label>' +
      '<p class="note" style="margin-top:-6px">Not counted in your budgets or spending. Record paybacks as they come in.</p>';
  else
    h +=
      '<div class="chips" role="group" aria-label="Category">' +
      cats
        .map(
          (c) =>
            '<button class="chip" data-act="fcat" data-v="' +
            esc(c.id) +
            '" aria-pressed="' +
            (f.categoryId === c.id) +
            '">' +
            (c.icon ? esc(c.icon) + ' ' : '') +
            esc(c.name) +
            '</button>',
        )
        .join('') +
      '</div>';
  h +=
    '<div class="grid2"><label class="field"><span>Note</span><input id="f-note" list="notesList" autocomplete="off" value="' +
    esc(f.note) +
    '" placeholder="Optional"></label><label class="field"><span>Date</span><input id="f-date" type="date" value="' +
    esc(f.date) +
    '"></label></div>';
  if (isA && f.mode === 'edit') h += advanceBlock(f);
  h +=
    '<p class="form-error" id="f-err" hidden></p><div class="sheet-actions">' +
    (f.mode === 'edit'
      ? '<button class="btn danger' +
        (armed === 'tx' ? ' armed' : '') +
        '" data-act="fdel">' +
        (armed === 'tx' ? 'Tap to confirm' : 'Delete') +
        '</button>'
      : '') +
    '<button class="btn primary" data-act="fsave">' +
    (f.mode === 'edit' ? 'Save changes' : 'Add') +
    '</button></div>';
  return h;
}

const linesVec = (ls) => {
  const v = { USD: 0, LBP: 0 };
  ls.forEach((l) => {
    const n = parseAmt(l.v);
    if (n > 0) v[l.cur] += n;
  });
  return v;
};

const isMove = (f) => f.type === 'transfer' || f.type === 'exchange';

const formRate = (f) => {
  if (f.type !== 'exchange') return state.rate;
  const r = parseAmt(f.xrate);
  return r > 0 ? r : state.rate;
};

function impliedRate(f) {
  const a = parseAmt(f.pay[0].v),
    b = parseAmt(f.toAmount);
  if (!(a > 0 && b > 0) || f.toCurrency === f.pay[0].cur) return 0;
  return f.pay[0].cur === 'USD' ? b / a : a / b;
}

export function autoTo() {
  const f = form;
  if (!isMove(f) || f.toTouched) return;
  const p = f.pay[0],
    a = parseAmt(p.v),
    r = formRate(f);
  if (!isFinite(a)) {
    f.toAmount = '';
    return;
  }
  if (f.toCurrency === p.cur) f.toAmount = String(a);
  else if (f.toCurrency === 'LBP') f.toAmount = String(Math.round(a * r));
  else f.toAmount = String(Math.round((a / r) * 100) / 100);
}

export function updatePreview() {
  const el = $('#f-preview');
  if (!el || !form) return;
  if (form.type === 'exchange') {
    const a = parseAmt(form.pay[0].v),
      g = parseAmt(form.toAmount),
      gc = form.toCurrency,
      pc = form.pay[0].cur;
    el.textContent = a > 0 && g > 0 ? accName(form.from) + ': −' + fmt(a, pc) + '  +' + fmt(g, gc) : '';
    const t = $('#f-toamount');
    if (t && !form.toTouched && document.activeElement !== t) t.value = form.toAmount;
    const ir = impliedRate(form),
      x = $('#f-xrate');
    if (x && form.toTouched && ir && document.activeElement !== x) {
      x.value = Math.round(ir).toLocaleString('en-US');
      form.xrate = x.value;
    }
    const sr = $('#f-setrate');
    if (sr) {
      const show = ir > 0 && Math.round(ir) !== Math.round(state.rate);
      sr.hidden = !show;
      if (!show) form.setRate = false;
      sr.textContent =
        (form.setRate ? '✓ ' : '') + 'Also make ' + Math.round(ir).toLocaleString('en-US') + ' my app rate';
      sr.setAttribute('aria-pressed', String(form.setRate));
    }
    return;
  }
  const ls = isMove(form) ? form.pay.slice(0, 1) : form.pay,
    pv = linesVec(ls),
    P = vUSD(pv);
  let txt = '';
  if (P > 0) {
    if (ls.length === 1) {
      const a = pv[ls[0].cur];
      txt =
        ls[0].cur === 'LBP'
          ? fmt(a, 'LBP') + '  ≈ ' + fmt(a / state.rate, 'USD')
          : fmt(a, 'USD') + '  ≈ ' + fmt(a * state.rate, 'LBP', { round: true });
    } else txt = 'Total ' + fmt(P, 'USD') + '  ≈ ' + fmt(P * state.rate, 'LBP', { round: true });
  }
  if (form.type === 'expense' && form.back.length && P > 0) {
    const K = vUSD(linesVec(form.back));
    if (K > 0) {
      const cost = P - K;
      txt =
        cost < 0
          ? 'The change is more than you paid'
          : 'Costs ' + fmt(cost, 'USD') + '  ≈ ' + fmt(cost * state.rate, 'LBP', { round: true });
    }
  }
  el.textContent = txt;
  const t = $('#f-toamount');
  if (t && !form.toTouched && document.activeElement !== t) t.value = form.toAmount;
}

export function readForm() {
  const f = form;
  ['note', 'date', 'who', 'toamount', 'from', 'to', 'acct', 'xrate'].forEach((k) => {
    const el = $('#f-' + k);
    if (el) {
      if (k === 'toamount') f.toAmount = el.value;
      else if (k === 'acct') {
        f.from = f.to = el.value;
      } else f[k] = el.value;
    }
  });
  document.querySelectorAll('[data-line]').forEach((el) => {
    const ln = (f[el.dataset.line] || [])[+el.dataset.i];
    if (ln) ln.v = el.value;
  });
}

export function saveTx() {
  readForm();
  const f = form,
    err = $('#f-err');
  const fail = (m) => {
    err.textContent = m;
    err.hidden = false;
  };
  const isX = f.type === 'exchange',
    isT = f.type === 'transfer' || isX,
    isE = f.type === 'expense',
    isA = f.type === 'advance';
  const payLs = isT ? f.pay.slice(0, 1) : f.pay,
    backLs = isE ? f.back : [];
  const bad = (ls) => ls.some((l) => String(l.v).trim() !== '' && !(parseAmt(l.v) > 0));
  if (bad(payLs) || bad(backLs)) return fail('Amounts must be numbers above zero.');
  const pv = linesVec(payLs);
  if (!(vUSD(pv) > 0)) return fail('Enter an amount above zero.');
  if (!f.date) return fail('Pick a date.');
  const first = payLs.find((l) => parseAmt(l.v) > 0).cur;
  let t = {
    id: f.id || uid(),
    type: isX ? 'transfer' : f.type,
    amount: pv[first],
    currency: first,
    note: f.note.trim(),
    date: f.date,
    createdAt: Date.now(),
  };
  if (pv[other(first)] > 0) t.amount2 = pv[other(first)];
  if (isT) {
    const ta = parseAmt(f.toAmount);
    if (!(ta > 0)) return fail(isX ? 'Enter what you get back.' : 'Enter the amount that arrives.');
    if (isX) {
      f.to = f.from;
      f.toCurrency = other(first);
    } else if (f.from === f.to)
      return fail('Pick two different accounts. To change $ into LL in one account, use Exchange.');
    Object.assign(t, { from: f.from, to: f.to, toAmount: ta, toCurrency: f.toCurrency });
  } else if (isA) {
    const who = (f.who || '').trim();
    if (!who) return fail('Who will pay you back?');
    Object.assign(t, { who, account: 'wallet' });
  } else {
    if (!f.categoryId) return fail('Pick a category.');
    Object.assign(t, { categoryId: f.categoryId, account: 'wallet' });
    if (isE && backLs.length) {
      const kv = linesVec(backLs);
      if (!(vUSD(kv) > 0)) return fail('Enter the change you got back, or remove it.');
      if (vUSD(kv) > vUSD(pv) + 1e-9) return fail('The change is more than you paid.');
      t.back = { USD: kv.USD, LBP: kv.LBP };
    }
  }
  if (isX && f.setRate) {
    const ir = impliedRate(f);
    if (ir > 0) state.rate = Math.round(ir);
  }
  if (f.mode === 'edit') {
    const i = state.tx.findIndex((x) => x.id === f.id);
    if (i >= 0) {
      const old = state.tx[i];
      if (old.type === 'advance' && !isA && paybacksOf(old.id).length)
        return fail('This has paybacks recorded. Delete them first, or keep "Someone will pay me back" on.');
      if (old.type === 'advance' && isA)
        ['closed', 'closedOn', 'keptCat'].forEach((k) => {
          if (old[k] != null) t[k] = old[k];
        });
      t.createdAt = old.createdAt || t.createdAt;
      state.tx[i] = t;
    }
    closeSheet();
    commit();
    toast('Saved');
  } else {
    state.tx.push(t);
    closeSheet();
    commit();
    toast(
      (isX ? 'Exchanged ' : isT ? 'Moved ' : 'Added ') +
        (t.note || txTitle(t)) +
        ' · ' +
        payParts(t).join(' + ') +
        (isT && t.toCurrency !== t.currency ? ' → ' + fmt(t.toAmount, t.toCurrency) : ''),
      () => {
        state.tx = state.tx.filter((x) => x.id !== t.id);
        commit();
      },
    );
  }
}
