/* Frata Plus: what it adds, how to get it, and where to type the unlock code. */
import { CONTACT, PLUS_PRICE, SUPPORT_URL } from '../config.js';
import { ICON } from '../icons.js';
import { plusInfo } from '../plus.js';
import { esc } from '../util.js';
import { form } from './sheet.js';

export const PLUS_FEATURES = [
  'History by category: a chart of where the month’s money went',
  'Budgets that cover several categories at once',
];

const mail = () =>
  'mailto:' +
  CONTACT.email +
  '?subject=' +
  encodeURIComponent('Frata Plus') +
  '&body=' +
  encodeURIComponent('Hi, I paid for Frata Plus with Whish. The name on my Whish account is: ');

/* A short line for Settings, and the sheet itself. */
export const plusStatus = () => {
  const p = plusInfo();
  return p
    ? '<p class="note">Unlocked' +
        (p.name ? ' for ' + esc(p.name) : '') +
        '. Thank you for supporting Frata!</p>'
    : '<p class="note">Adds a spending chart and budgets for several categories. ' +
        PLUS_PRICE +
        ', paid once, yours to keep.</p>' +
        '<div class="btn-row"><button class="btn primary" data-act="plusOpen">Get Frata Plus</button></div>';
};

export function plusSheet() {
  const p = plusInfo();
  let h =
    '<div class="sheet-head"><h2>Frata Plus</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>';
  h += '<ul class="plus-list">' + PLUS_FEATURES.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>';
  if (p) {
    h +=
      '<p class="note plus-ok">Unlocked' +
      (p.name ? ' for ' + esc(p.name) : '') +
      '. Thank you for supporting Frata!</p>';
    return h;
  }
  h +=
    '<p class="note">Frata Plus is ' +
    PLUS_PRICE +
    ', paid once. 1. Pay ' +
    PLUS_PRICE +
    ' with Whish. 2. Email me the name you paid under. 3. I’ll send you a code to paste below.</p>' +
    '<div class="btn-row"><a class="btn" href="' +
    SUPPORT_URL +
    '" target="_blank" rel="noopener">Pay with Whish</a><a class="btn" href="' +
    esc(mail()) +
    '">Email me</a></div>' +
    '<label class="field"><span>Unlock code</span><textarea id="plus-code" rows="3" autocomplete="off" ' +
    'autocapitalize="off" spellcheck="false" placeholder="FRATA1-…">' +
    esc((form && form.code) || '') +
    '</textarea></label>' +
    '<p class="form-error" id="plus-err" hidden></p>' +
    '<p class="note">The code is checked on this phone: nothing is sent anywhere. It’s kept with your data, so ' +
    'backups and moving to a new phone keep Plus. <button class="link" data-act="termsOpen">Terms and refunds</button></p>' +
    '<div class="sheet-actions"><button class="btn primary" data-act="plusUnlock">Unlock</button></div>';
  return h;
}
