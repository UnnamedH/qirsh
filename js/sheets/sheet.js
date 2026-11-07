/* Bottom sheet: opening, closing and drawing whichever form is active. */
import { markSeen } from '../changelog.js';
import { adjustSheet, updateAdjustPreview } from './adjust.js';
import { budgetSheet } from './budget.js';
import { txSheet, updatePreview } from './entry.js';
import { newsSheet } from './news.js';
import { repaySheet } from './payback.js';
import { $ } from '../util.js';

export let form = null,
  sheetKind = null;

export function openSheet(kind) {
  sheetKind = kind;
  $('#toast').hidden = true;
  $('#scrim').hidden = false;
  $('#sheet').hidden = false;
  drawSheet();
}

export function closeSheet() {
  if (sheetKind === 'news') markSeen();
  $('#scrim').hidden = true;
  $('#sheet').hidden = true;
  sheetKind = null;
  form = null;
}

export function drawSheet() {
  const el = $('#sheet');
  el.innerHTML =
    '<div class="grab"></div>' +
    (sheetKind === 'tx'
      ? txSheet()
      : sheetKind === 'repay'
        ? repaySheet()
        : sheetKind === 'news'
          ? newsSheet()
          : sheetKind === 'adjust'
            ? adjustSheet()
            : budgetSheet());
  if (sheetKind === 'tx') updatePreview();
  if (sheetKind === 'adjust') updateAdjustPreview();
  const a = el.querySelector('#f-pay0');
  if (a && !form.id && !form.noFocus)
    setTimeout(() => {
      try {
        a.focus();
      } catch (e) {}
    }, 60);
  form.noFocus = true;
}

export function setForm(value) {
  form = value;
  return value;
}
