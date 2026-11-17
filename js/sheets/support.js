/* The Support Frata link, in a sheet from the heart at the top and in Settings. */
import { SUPPORT_URL } from '../config.js';
import { ICON } from '../icons.js';

/* A link people tap, never a request the app makes: Frata itself still sends nothing anywhere. */
export const supportButtons = () =>
  '<p class="note">If Frata helps you, you can buy me a coffee. It keeps frata.cc running and the maintainer happy.</p>' +
  '<div class="btn-row"><a class="btn primary" href="' +
  SUPPORT_URL +
  '" target="_blank" rel="noopener">☕ Buy me a coffee</a></div>' +
  '<p class="note">Opens Whish, where you choose the amount.</p>';

export const supportSheet = () =>
  '<div class="sheet-head"><h2>Support Frata</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
  ICON.close +
  '</button></div>' +
  supportButtons();
