/* Bottom sheet: opening, closing and drawing whichever form is active. */
import { fitAllThousands } from '../../../js/ui/amount.js';
import { $ } from '../../../js/util.js';
import { adjustSheet, updateAdjustPreview } from './adjust.js';
import { txSheet } from './entry.js';

export let form = null;

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
  el.innerHTML = '<div class="grab"></div>' + (form.kind === 'adjust' ? adjustSheet(form) : txSheet(form));
  fitAllThousands(el);
  if (form.kind === 'adjust') updateAdjustPreview(form);
  if (form.mode === 'new' && !form.focused) {
    form.focused = true;
    setTimeout(() => {
      const a = document.activeElement,
        n = $('#f-amount');
      if (a && a.matches && a.matches('input, textarea, select')) return;
      if (n) n.focus();
    }, 60);
  }
}
