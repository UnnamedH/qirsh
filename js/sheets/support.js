/* The Support Frata link, in a sheet from the heart at the top and in Settings. */
import { SUPPORT_URL } from '../config.js';
import { ICON } from '../icons.js';

/* A link people tap, never a request the app makes: Frata itself still sends nothing anywhere. */
export const supportButtons = () =>
  '<div class="btn-row"><a class="btn primary" href="' +
  SUPPORT_URL +
  '" target="_blank" rel="noopener">☕ Buy me a coffee</a></div>';

export const supportSheet = () =>
  '<div class="sheet-head"><h2>Support Frata</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
  ICON.close +
  '</button></div>' +
  supportButtons();
