/* The Feedback & bugs buttons, in a sheet from the button at the top and in Settings. */
import { emailLink, whatsappLink } from '../feedback.js';
import { ICON } from '../icons.js';
import { esc } from '../util.js';

/** WhatsApp and Email, each opening a message to the maker with the version and phone filled in. */
export const feedbackButtons = () =>
  '<div class="btn-row"><a class="btn" href="' +
  esc(whatsappLink()) +
  '" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="' +
  esc(emailLink()) +
  '">Email</a></div>' +
  '<p class="note">Attach a screenshot in the chat if it helps.</p>';

export const feedbackSheet = () =>
  '<div class="sheet-head"><h2>Feedback &amp; bugs</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
  ICON.close +
  '</button></div>' +
  feedbackButtons();
