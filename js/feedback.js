/* The feedback link: an email to the maker, with the app version and phone filled in. */
import { APP_VERSION } from './changelog.js';
import { CONTACT } from './config.js';
import { IOS, STANDALONE } from './pwa.js';
import { showPriceTip } from './sheets/demo.js';
import { state } from './state.js';
import { view } from './ui/ui-state.js';

/* Which phone and browser, so a bug can be reproduced. Only this goes in the message: never
   entries, balances or anything else from the person's data. */
export function deviceLabel(ua = navigator.userAgent) {
  const phone = IOS ? (/iPad/.test(ua) ? 'iPad' : 'iPhone') : /Android/.test(ua) ? 'Android' : 'computer';
  const browser = /SamsungBrowser/.test(ua)
    ? 'Samsung Internet'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Firefox|FxiOS/.test(ua)
        ? 'Firefox'
        : /CriOS|Chrome/.test(ua)
          ? 'Chrome'
          : /Safari/.test(ua)
            ? 'Safari'
            : 'browser';
  return phone + ', ' + (STANDALONE ? 'installed app' : browser);
}

const TAB_NAMES = { home: 'Home', history: 'History', budgets: 'Budgets', settings: 'Settings' };

/* Also the screen size and the tab it was sent from, which help to reproduce a layout bug. */
export const intro = () =>
  'Frata feedback (version ' +
  APP_VERSION +
  ', ' +
  deviceLabel() +
  ', ' +
  innerWidth +
  '×' +
  innerHeight +
  ', on ' +
  (TAB_NAMES[view] || view) +
  '):\n\n';

export const emailLink = () =>
  'mailto:' +
  CONTACT.email +
  '?subject=' +
  encodeURIComponent('Frata feedback') +
  '&body=' +
  encodeURIComponent(intro());

/* The one-time note on Home saying feedback can be sent. Kept on the device, not in the data, like
   the install tip: it's about this phone's screen, not the person's money. */
const TIP_KEY = 'qirsh.feedbackTip';

/** Shown once people use Frata for real: not over the example data, and not next to the price-first
    tip on Home, so there's one note at a time. */
export function feedbackTipDue() {
  if (state.sample || showPriceTip()) return false;
  try {
    return localStorage.getItem(TIP_KEY) !== 'seen';
  } catch (e) {
    return false;
  }
}

export function feedbackTipSeen() {
  try {
    localStorage.setItem(TIP_KEY, 'seen');
  } catch (e) {}
}
