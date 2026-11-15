/* Feedback links: a WhatsApp chat or an email to the maker, with the app version and phone filled in. */
import { APP_VERSION } from './changelog.js';
import { CONTACT } from './config.js';
import { IOS, STANDALONE } from './pwa.js';

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

const intro = () => 'Frata feedback (version ' + APP_VERSION + ', ' + deviceLabel() + '):\n\n';

export const whatsappLink = () =>
  'https://wa.me/' + CONTACT.whatsapp + '?text=' + encodeURIComponent(intro());

export const emailLink = () =>
  'mailto:' +
  CONTACT.email +
  '?subject=' +
  encodeURIComponent('Frata feedback') +
  '&body=' +
  encodeURIComponent(intro());
