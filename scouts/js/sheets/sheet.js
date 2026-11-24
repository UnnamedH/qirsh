/* Bottom sheet: opening, closing and drawing whichever form is active. */
import { fitAllThousands } from '../../../js/ui/amount.js';
import { $ } from '../../../js/util.js';
import { adjustSheet, updateAdjustPreview } from './adjust.js';
import { txSheet } from './entry.js';
import { eventSheet } from './event.js';
import { memberSheet } from './member.js';
import { paymentSheet } from './payment.js';

export let form = null;

const SHEETS = {
  tx: txSheet,
  adjust: adjustSheet,
  event: eventSheet,
  member: memberSheet,
  pay: paymentSheet,
};

export function openSheet(f) {
  form = f;
  $('#toast').hidden = true;
  $('#scrim').hidden = false;
  $('#sheet').hidden = false;
  drawSheet();
}

export function closeSheet() {
  $('#scrim').hidden = true;
  $('#sheet').hidden = true;
  form = null;
}

export const sheetOpen = () => !!form;

export function drawSheet() {
  if (!form) return;
  const el = $('#sheet');
  el.innerHTML = '<div class="grab"></div>' + SHEETS[form.kind](form);
  fitAllThousands(el);
  if (form.kind === 'adjust') updateAdjustPreview(form);
  if (form.mode === 'new' && !form.focused) {
    form.focused = true;
    setTimeout(() => {
      const a = document.activeElement,
        n = $(form.kind === 'event' || form.kind === 'member' ? '#f-name' : '#f-amount');
      if (a && a.matches && a.matches('input, textarea, select')) return;
      if (n) n.focus();
    }, 60);
  }
}
