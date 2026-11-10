/* Sheet for adding and editing entries: expense, income, transfer, exchange, paid for others. */
import { paybacksOf } from '../advances.js';
import { ACCOUNTS, accName } from '../config.js';
import { ICON } from '../icons.js';
import {
  backVec,
  entryValueIn,
  fmt,
  isMixed,
  other,
  parseAmt,
  parseInput,
  payVec,
  priceCurrency,
  toInput,
  vUSD,
} from '../money.js';
import { amountField, fitThousands } from '../ui/amount.js';
import { advanceBlock } from './payback.js';
import { closeSheet, form } from './sheet.js';
import { state } from '../state.js';
import { amountText, txRate, txTitle } from '../ui/format.js';
import { commit } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { armed } from '../ui/ui-state.js';
import { $, esc, uid, ymd } from '../util.js';

/* New entries start in the currency of the most recently saved one, not counting balance corrections. */
function lastCur() {
  let t = null;
  for (const x of state.tx) {
    if (x.type === 'adjust' || x.correction) continue;
    if (!t || (x.createdAt || 0) > (t.createdAt || 0)) t = x;
  }
  return t && priceCurrency(t) === 'LBP' ? 'LBP' : 'USD';
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
      paid: null,
      adj: null,
      adj2: null,
    },
    extra || {},
  );
}

/*
 * An expense opens price first: the price, what it was paid with, and the change back (or the rest
 * paid on top). Older entries saved as "paid + change" are shown the same way; their saved amounts
 * are kept exactly, so the change line counts as already set by the user.
 */
function priceFirst(t) {
  const d = t.currency,
    e = other(d),
    v = payVec(t),
    k = backVec(t),
    netE = v[e] - k[e];
  if (!netE && !k[d])
    return { pay: [{ cur: d, v: toInput(t.amount, d) }], paid: null, adj: null, adj2: null };
  const c = t.priceCur || (netE ? e : d);
  const adjAmount = netE ? Math.abs(netE) : k[d];
  const adjCur = netE ? e : d;
  // Change in both currencies, like $5 and some LL back from a $10 note.
  const both = netE < 0 && k[d] > 0;
  return {
    pay: [{ cur: c, v: toInput(entryValueIn(t, c), c) }],
    paid: { cur: d, v: toInput(netE && !both ? v[d] - k[d] : v[d], d) },
    adj: { cur: adjCur, v: toInput(adjAmount, adjCur), touched: true, curTouched: true },
    adj2: both ? { cur: d, v: toInput(k[d], d) } : null,
  };
}

export function formFromTx(t, mode) {
  const pay = [{ cur: t.currency, v: toInput(t.amount, t.currency) }];
  if (t.amount2) pay.push({ cur: other(t.currency), v: toInput(t.amount2, other(t.currency)) });
  const isX = t.type === 'transfer' && t.from === t.to,
    r = txRate(t);
  const f = {
    mode,
    id: mode === 'edit' ? t.id : null,
    type: isX ? 'exchange' : t.type,
    pay: t.type === 'transfer' ? pay.slice(0, 1) : pay,
    xrate: Math.round(r || state.rate).toLocaleString('en-US'),
    setRate: false,
    back: [],
    paid: null,
    adj: null,
    adj2: null,
    categoryId: t.categoryId || null,
    who: t.who || '',
    note: t.note || '',
    date: mode === 'edit' ? t.date : ymd(new Date()),
    from: t.from || 'wallet',
    to: t.to || 'savings',
    toAmount: t.toAmount != null ? toInput(t.toAmount, t.toCurrency || t.currency) : '',
    toCurrency: t.toCurrency || t.currency,
    toTouched: t.type === 'transfer' && t.toCurrency !== t.currency,
    correction: !!t.correction,
    account: t.account || 'wallet',
  };
  if (t.type === 'expense' && priceFirstOn()) Object.assign(f, priceFirst(t));
  else if (t.type === 'expense') {
    const k = backVec(t);
    f.back = [other(t.currency), t.currency]
      .filter((c) => k[c] > 0)
      .map((c) => ({ cur: c, v: toInput(k[c], c) }));
  }
  return f;
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
          '<div class="amount-row">' +
          amountField({
            id: 'f-' + kind + i,
            value: ln.v,
            cur: ln.cur,
            label: (kind === 'pay' ? 'Amount' : 'Change') + ' in ' + (ln.cur === 'USD' ? 'USD' : 'LL'),
            attrs: ' data-line="' + kind + '" data-i="' + i + '"',
            small: kind === 'back',
          }) +
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
  if (isE && f.paid) h += '<span class="sub-label" style="margin-bottom:-12px">Price</span>';
  h +=
    moneyLines('pay', isT ? f.pay.slice(0, 1) : f.pay) + (isX ? '' : '<p class="hint" id="f-preview"></p>');
  if (!isT) {
    if (isE && priceFirstOn()) h += paidSection(f);
    else {
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
    }
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
      '<div class="sub-lines"><span class="sub-label">You get</span><div class="amount-row">' +
      amountField({
        id: 'f-toamount',
        value: f.toAmount,
        cur: gc,
        label: 'Amount received in ' + (gc === 'USD' ? 'USD' : 'LL'),
      }) +
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
      '<div class="sub-lines"><span class="sub-label">Arrives as</span><div class="amount-row">' +
      amountField({
        id: 'f-toamount',
        value: f.toAmount,
        cur: f.toCurrency,
        label: 'Amount received',
        small: true,
      }) +
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
  if (f.mode === 'edit' && f.correction && (isE || f.type === 'income'))
    h += '<p class="note">A balance correction for ' + esc(accName(f.account)) + '.</p>';
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

/* ---------- price first: paid with, and the change back ---------- */

/** Whether expenses are typed price first, or as amounts paid plus change back (the default). */
export const priceFirstOn = () => state.settings.entryStyle === 'price';

const convert = (n, from, to) => (from === to ? n : to === 'LBP' ? n * state.rate : n / state.rate);
// Change is rounded the way it is handed over: to the cent, or to 1,000 LL.
const roundCur = (n, cur) => (cur === 'USD' ? Math.round(n * 100) / 100 : Math.round(n / 1000) * 1000);

/** Change usually comes in LL whenever LL is involved; otherwise in dollars. */
export const defaultAdjCur = (f) => (f.pay[0].cur === 'LBP' || f.paid.cur === 'LBP' ? 'LBP' : 'USD');

/** Opens "Paid with", in the other currency from the price. */
export function openPaid(f) {
  f.paid = { cur: other(f.pay[0].cur), v: '' };
  f.adj = { cur: null, v: '', touched: false, curTouched: false };
  f.adj.cur = defaultAdjCur(f);
}

/**
 * How what was paid settles against the price, at the app's rate: 'change' when it was more (the
 * amount comes back), 'rest' when it was less (the rest was paid on top), 'exact' when it matches.
 * The amount is in the change line's currency. Null until both amounts are entered.
 */
function settle(f) {
  const c = f.pay[0].cur,
    P = parseInput(f.pay[0].v, c),
    Q = parseInput(f.paid.v, f.paid.cur);
  if (!(P > 0) || !(Q > 0)) return null;
  const diff = convert(Q, f.paid.cur, c) - P;
  if (Math.abs(diff) < (c === 'USD' ? 0.005 : 500)) return { kind: 'exact', amount: 0 };
  const kind = diff > 0 ? 'change' : 'rest';
  let amount = convert(Math.abs(diff), c, f.adj.cur);
  // Some of the change came back in the other currency: this line is whatever is left.
  if (kind === 'change')
    amount = Math.max(0, amount - convert(extraBack(f), f.adj2 ? f.adj2.cur : c, f.adj.cur));
  return { kind, amount: roundCur(amount, f.adj.cur) };
}

/** Change typed on the second line ("Also got $ back"), or 0. */
const extraBack = (f) => {
  if (!f.adj2) return 0;
  const n = parseInput(f.adj2.v, f.adj2.cur);
  return n > 0 ? n : 0;
};

const adjLabel = (s) => (s && s.kind === 'rest' ? 'You also paid' : 'Change back');

/**
 * The saved form of a price-first expense: what was paid, any change back or extra paid, the price
 * currency, and the rate that makes it all add up to the price. That rate is the shop's rate when the
 * change differs from the app's own figure. Returns a message instead when something doesn't add up.
 */
function pricePayment(f) {
  const c = f.pay[0].cur,
    d = f.paid.cur,
    a = f.adj.cur,
    P = parseInput(f.pay[0].v, c),
    Q = parseInput(f.paid.v, d);
  if (!(P > 0)) return 'Enter the price.';
  if (!(Q > 0)) return 'Enter what you paid with, or remove it.';
  const s = settle(f);
  const typed = String(f.adj.v).trim();
  const A = f.adj.touched ? (typed === '' ? 0 : parseInput(typed, a)) : s.amount;
  if (!(A >= 0)) return 'The change must be a number.';
  const kind = s.kind === 'rest' ? 'rest' : 'change';
  if (kind === 'rest' && c === d && a === d) return 'You paid less than the price. Enter the price you paid.';
  const p = { amount: Q, currency: d, priceCur: c };
  const B = extraBack(f);
  if (f.adj2 && String(f.adj2.v).trim() !== '' && !(parseInput(f.adj2.v, f.adj2.cur) >= 0))
    return 'The change must be a number.';
  if (B > 0 && kind === 'rest')
    return 'You paid less than the price, so there’s no change. Remove the extra change.';
  if (A > 0 || B > 0) {
    if (kind === 'change') {
      p.back = { USD: 0, LBP: 0 };
      p.back[a] += A;
      if (B > 0) p.back[f.adj2.cur] += B;
    } else if (a === d) p.amount = Q + A;
    else p.amount2 = A;
  }
  // The rate at which the amounts add up to the price, needed when any of them is in the other currency.
  const v = { USD: 0, LBP: 0 };
  v[d] += p.amount;
  if (p.amount2) v[other(d)] += p.amount2;
  if (p.back) {
    v.USD -= p.back.USD;
    v.LBP -= p.back.LBP;
  }
  if (v[other(c)]) {
    const r = c === 'LBP' ? (P - v.LBP) / v.USD : v.LBP / (P - v.USD);
    if (!(r >= state.rate / 2 && r <= state.rate * 2))
      return (
        'That works out to ' +
        (isFinite(r) && r > 0 ? Math.round(r).toLocaleString('en-US') + ' LL per $1' : 'an impossible rate') +
        '. Check the amounts.'
      );
    p.rate = Math.round(r * 100) / 100;
  } else if (Math.abs(v[c] - P) > (c === 'USD' ? 0.005 : 1)) {
    return 'The amounts don’t add up to the price. Check the change.';
  }
  return p;
}

/** Updates the change line and its note as amounts are typed, without redrawing the sheet. */
function refreshSettle() {
  const f = form,
    lab = $('#f-adjlabel'),
    inp = $('#f-adj'),
    hint = $('#f-adjhint');
  if (!f || !f.paid || !lab || !inp || !hint) return;
  const s = settle(f);
  lab.textContent = adjLabel(s);
  const link = $('#f-adj2link');
  if (link) link.hidden = !!s && s.kind === 'rest';
  if (!f.adj.touched) {
    f.adj.v = s && s.amount ? toInput(s.amount, f.adj.cur) : '';
    if (document.activeElement !== inp) {
      inp.value = f.adj.v;
      if (inp.closest('.thousands')) fitThousands(inp);
    }
  }
  let text = '';
  if (s && s.kind === 'exact' && !f.adj.touched) text = 'That’s exactly the price.';
  else if (s) {
    const p = pricePayment(f);
    if (typeof p === 'string') text = p;
    else if (p.rate && f.adj.touched)
      text = 'That’s ' + Math.round(p.rate).toLocaleString('en-US') + ' LL per $1.';
    else if (p.rate) text = 'Worked out at ' + state.rate.toLocaleString('en-US') + ' LL per $1.';
  }
  hint.textContent = text;
}

function paidSection(f) {
  if (!f.paid)
    return (
      '<div class="links"><button class="link" data-act="paidAdd">+ Paid with ' +
      curLabel(other(f.pay[0].cur)) +
      '</button></div>'
    );
  const a = f.adj.cur;
  return (
    '<div class="sub-lines"><span class="sub-label">Paid with</span><div class="amount-row">' +
    amountField({ id: 'f-paid', value: f.paid.v, cur: f.paid.cur, label: 'Paid with' }) +
    curToggle('paidCur', f.paid.cur) +
    '<button class="icon-btn" data-act="paidRm" aria-label="Remove what you paid with">' +
    ICON.close +
    '</button></div></div>' +
    '<div class="adj-row"><span class="sub-label" id="f-adjlabel">' +
    adjLabel(settle(f)) +
    '</span>' +
    amountField({ id: 'f-adj', value: f.adj.v, cur: a, label: 'Change back', small: true }) +
    curToggle('adjCur', a) +
    '</div>' +
    (f.adj2
      ? '<div class="adj-row"><span class="sub-label">Also back</span>' +
        amountField({ id: 'f-adj2', value: f.adj2.v, cur: f.adj2.cur, label: 'Also back', small: true }) +
        '<span class="cur-tag">' +
        (f.adj2.cur === 'USD' ? 'USD' : 'LL') +
        '</span><button class="icon-btn" data-act="adj2Rm" aria-label="Remove the extra change">' +
        ICON.close +
        '</button></div>'
      : '<div class="links" id="f-adj2link"><button class="link" data-act="adj2Add">+ Also got ' +
        curLabel(other(a)) +
        ' back</button></div>') +
    '<p class="hint" id="f-adjhint"></p>'
  );
}

const linesVec = (ls) => {
  const v = { USD: 0, LBP: 0 };
  ls.forEach((l) => {
    const n = parseInput(l.v, l.cur);
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
  const a = parseInput(f.pay[0].v, f.pay[0].cur),
    b = parseInput(f.toAmount, f.toCurrency);
  if (!(a > 0 && b > 0) || f.toCurrency === f.pay[0].cur) return 0;
  return f.pay[0].cur === 'USD' ? b / a : a / b;
}

export function autoTo() {
  const f = form;
  if (!isMove(f) || f.toTouched) return;
  const p = f.pay[0],
    a = parseInput(p.v, p.cur),
    r = formRate(f);
  if (!isFinite(a)) {
    f.toAmount = '';
    return;
  }
  const to = f.toCurrency === p.cur ? a : f.toCurrency === 'LBP' ? Math.round(a * r) : a / r;
  f.toAmount = toInput(to, f.toCurrency);
}

export function updatePreview() {
  const el = $('#f-preview');
  if (!el || !form) return;
  if (form.type === 'exchange') {
    const a = parseInput(form.pay[0].v, form.pay[0].cur),
      g = parseInput(form.toAmount, form.toCurrency),
      gc = form.toCurrency,
      pc = form.pay[0].cur;
    el.textContent = a > 0 && g > 0 ? accName(form.from) + ': −' + fmt(a, pc) + '  +' + fmt(g, gc) : '';
    const t = $('#f-toamount');
    if (t && !form.toTouched && document.activeElement !== t) {
      t.value = form.toAmount;
      if (t.closest('.thousands')) fitThousands(t);
    }
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
  el.textContent = txt;
  const t = $('#f-toamount');
  if (t && !form.toTouched && document.activeElement !== t) {
    t.value = form.toAmount;
    if (t.closest('.thousands')) fitThousands(t);
  }
  if (form.type === 'expense' && form.paid) refreshSettle();
  else if (form.type === 'expense' && form.back.length && P > 0) {
    const K = vUSD(linesVec(form.back));
    if (K > 0)
      el.textContent =
        P - K < 0
          ? 'The change is more than you paid'
          : 'Costs ' + fmt(P - K, 'USD') + '  ≈ ' + fmt((P - K) * state.rate, 'LBP', { round: true });
  }
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
  const paid = $('#f-paid'),
    adj = $('#f-adj');
  if (paid && f.paid) f.paid.v = paid.value;
  if (adj && f.adj) f.adj.v = adj.value;
  const adj2 = $('#f-adj2');
  if (adj2 && f.adj2) f.adj2.v = adj2.value;
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
  const bad = (ls) => ls.some((l) => String(l.v).trim() !== '' && !(parseInput(l.v, l.cur) > 0));
  if (bad(payLs) || bad(backLs)) return fail('Amounts must be numbers above zero.');
  const pv = linesVec(payLs);
  if (!(vUSD(pv) > 0)) return fail('Enter an amount above zero.');
  if (!f.date) return fail('Pick a date.');
  const first = payLs.find((l) => parseInput(l.v, l.cur) > 0).cur;
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
    const ta = parseInput(f.toAmount, f.toCurrency);
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
    Object.assign(t, { who, account: 'wallet', rate: state.rate });
  } else {
    if (!f.categoryId) return fail('Pick a category.');
    Object.assign(t, { categoryId: f.categoryId, account: 'wallet' });
    if (isE && f.paid) {
      const p = pricePayment(f);
      if (typeof p === 'string') return fail(p);
      delete t.amount2;
      Object.assign(t, p);
      if (t.back && !t.back.USD && !t.back.LBP) delete t.back;
    } else if (isE && backLs.length) {
      const kv = linesVec(backLs);
      if (!(vUSD(kv) > 0)) return fail('Enter the change you got back, or remove it.');
      if (vUSD(kv) > vUSD(pv) + 1e-9) return fail('The change is more than you paid.');
      t.back = { USD: kv.USD, LBP: kv.LBP };
    }
    // Keep today's rate on it (unless price first worked out the shop's), so its value doesn't move later.
    if (!t.rate) t.rate = state.rate;
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
        ['closed', 'closedOn', 'keptCat', 'rate'].forEach((k) => {
          if (old[k] != null) t[k] = old[k];
        });
      // A counted balance correction stays one, in its own account, while it stays expense or income.
      if (old.correction && (isE || t.type === 'income'))
        Object.assign(t, { correction: true, account: old.account || 'wallet' });
      // An edited entry keeps the rate of the day it was saved, so its value stays. Price first is the
      // exception: there the rate is worked out from the amounts just typed.
      if (!isT && !(isE && f.paid) && +old.rate > 0) {
        t.rate = old.rate;
        if (isE && old.priceCur && isMixed(t)) t.priceCur = old.priceCur;
      }
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
        amountText(t) +
        (isT && t.toCurrency !== t.currency ? ' → ' + fmt(t.toAmount, t.toCurrency) : ''),
      () => {
        state.tx = state.tx.filter((x) => x.id !== t.id);
        commit();
      },
    );
  }
}
