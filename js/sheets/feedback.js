/* The Feedback & bugs buttons, in a sheet from the button at the top and in Settings. */
import { emailLink } from '../feedback.js';
import { ICON } from '../icons.js';
import { esc } from '../util.js';

/** An email to the maker with the version and phone filled in. */
export const feedbackButtons = () =>
  '<div class="btn-row"><a class="btn primary" href="' +
  esc(emailLink()) +
  '">Email me</a></div>' +
  '<p class="note">Attach a screenshot to the email if it helps.</p>';

export const feedbackSheet = () =>
  '<div class="sheet-head"><h2>Feedback &amp; bugs</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
  ICON.close +
  '</button></div>' +
  feedbackButtons();
