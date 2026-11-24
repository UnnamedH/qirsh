/* Sections that fold down to their heading and, when shut, a one-line summary. Which are shut is saved in
   settings.fold (a key per section), so each stays as the person left it. */
import { ICON } from '../../../js/icons.js';
import { esc } from '../../../js/util.js';
import { state } from '../state.js';

export const isShut = (key) => !!state.settings.fold[key];

/**
 * A foldable section. `summary` (HTML) shows beside the heading while it is shut, `extra` (HTML, such as an
 * Add button) beside it while open, and `body` (HTML) is what folds away. `keepOpen` holds it open, for a
 * section with something waiting to be answered inside.
 */
export function fold(key, title, summary, body, extra = '', keepOpen = false) {
  const shut = isShut(key) && !keepOpen;
  return (
    '<section class="sec fold' +
    (shut ? ' shut' : '') +
    '"><div class="sec-head"><h2 class="fold-title"><button class="fold-head" data-act="fold" data-v="' +
    esc(key) +
    '" aria-expanded="' +
    !shut +
    '"><span>' +
    esc(title) +
    '</span>' +
    ICON.right +
    (shut && summary ? '<span class="fold-sum">' + summary + '</span>' : '') +
    '</button></h2>' +
    (shut ? '' : extra) +
    '</div>' +
    (shut ? '' : body) +
    '</section>'
  );
}

/** Opens or shuts a section. Shut ones are kept as true; open ones are simply left out. */
export function toggleFold(key) {
  if (state.settings.fold[key]) delete state.settings.fold[key];
  else state.settings.fold[key] = true;
}
