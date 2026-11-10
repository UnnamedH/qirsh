/* Amount fields. LL is typed in thousands, so LL fields show a fixed ",000" right after the number. */
import { esc } from '../util.js';

/**
 * A large amount field, as used in the sheets. `cur` decides whether the ",000" label is shown;
 * `attrs` adds attributes to the input (for example data-line), `small` makes it the smaller size.
 */
export function amountField({ id, value, cur, label, attrs = '', small = false }) {
  const k = cur === 'LBP';
  return (
    '<label class="amount-field' +
    (small ? ' sm' : '') +
    (k ? ' thousands' : '') +
    '"><input id="' +
    id +
    '" class="amount-input" inputmode="decimal" autocomplete="off" placeholder="0" value="' +
    esc(value) +
    '" aria-label="' +
    esc(label) +
    (k ? ', in thousands of LL' : '') +
    '"' +
    attrs +
    '>' +
    (k ? '<span class="k-suffix" aria-hidden="true">,000</span>' : '') +
    '</label>'
  );
}

/** A plain settings-style field holding an LL amount in thousands, with the ",000" label after it. */
export function thousandsInput(attrs, value, label) {
  return (
    '<span class="k-box thousands"><input class="num"' +
    attrs +
    ' inputmode="decimal" autocomplete="off" value="' +
    esc(value) +
    '" aria-label="' +
    esc(label) +
    ', in thousands of LL"><span class="k-suffix" aria-hidden="true">,000</span></span>'
  );
}

/** Makes an LL input exactly as wide as what is typed, so ",000" sits right after the number. */
export function fitThousands(input) {
  const text = input.value || input.placeholder || '0';
  input.style.width = text.length + 0.15 + 'ch';
}

export function fitAllThousands(root = document) {
  root.querySelectorAll('.thousands input').forEach(fitThousands);
}
