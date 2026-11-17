/* Bottom sheet: opening, closing and drawing whichever form is active. */
import { markSeen } from '../changelog.js';
import { adjustSheet, updateAdjustPreview } from './adjust.js';
import { budgetSheet } from './budget.js';
import { demoSheet, markPriceTipDone } from './demo.js';
import { feedbackSheet } from './feedback.js';
import { txSheet, updatePreview } from './entry.js';
import { newsSheet } from './news.js';
import { repaySheet } from './payback.js';
import { supportSheet } from './support.js';
import { fitAllThousands } from '../ui/amount.js';
import { render } from '../ui/render.js';
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
  const wasDemo = sheetKind === 'demo';
  if (wasDemo) markPriceTipDone();
  $('#scrim').hidden = true;
  $('#sheet').hidden = true;
  sheetKind = null;
  form = null;
  // The tip banner on Home goes away once the demo has been seen, however it was closed.
  if (wasDemo) render();
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
          : sheetKind === 'demo'
            ? demoSheet()
            : sheetKind === 'adjust'
              ? adjustSheet()
              : sheetKind === 'feedback'
                ? feedbackSheet()
                : sheetKind === 'support'
                  ? supportSheet()
                  : budgetSheet());
  fitAllThousands(el);
  if (sheetKind === 'tx') updatePreview();
  if (sheetKind === 'adjust') updateAdjustPreview();
  if (el.querySelector('#f-pay0') && !form.id && !form.noFocus) focusSoon('#f-pay0', 60);
  form.noFocus = true;
}

/**
 * Puts the cursor in a field once the sheet has settled. If the person has already tapped into a
 * field by then (quick typists, slow phones), it stays where they put it: moving it would send what
 * they type next into the wrong field.
 */
export function focusSoon(selector, ms = 40) {
  setTimeout(() => {
    const active = document.activeElement;
    if (active && active.matches && active.matches('input, textarea, select')) return;
    const n = $(selector);
    try {
      if (n) n.focus();
    } catch (e) {}
  }, ms);
}

export function setForm(value) {
  form = value;
  return value;
}
