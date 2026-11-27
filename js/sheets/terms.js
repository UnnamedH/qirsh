/* Privacy & terms: what Frata keeps and where, the Frata Plus terms, and the "as is" notice. Also at #terms. */
import { CONTACT, PLUS_PRICE } from '../config.js';
import { ICON } from '../icons.js';
import { esc } from '../util.js';

/* Change this whenever the text below changes in substance. */
export const TERMS_UPDATED = '26 November 2026';
/* How long after buying Frata Plus a refund can be asked for. */
export const REFUND_DAYS = 7;

const mail = () => '<a class="link" href="mailto:' + esc(CONTACT.email) + '">' + esc(CONTACT.email) + '</a>';
const sec = (title, paras) =>
  '<h3 class="terms-h">' + title + '</h3>' + paras.map((p) => '<p class="note">' + p + '</p>').join('');

export const termsSheet = () =>
  '<div class="sheet-head"><h2>Privacy &amp; terms</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
  ICON.close +
  '</button></div><div class="terms">' +
  '<p class="note">Last updated ' +
  TERMS_UPDATED +
  '. Questions: ' +
  mail() +
  '.</p>' +
  sec('Your data stays on your phone', [
    'Everything you enter in Frata is saved in this browser on this phone. Frata has no account and no server, and it never sends your entries, balances or anything else you type anywhere. The browser is set to block it from contacting any other website.',
    'Your data isn’t encrypted on the phone. Clearing the browser’s data or removing the app deletes it, so keep a backup (Settings → Backup). Backup files are yours: they go wherever you save or send them.',
  ]) +
  sec('The website', [
    'frata.cc is hosted by Cloudflare. Like any website host, it sees the basic details of each visit that browsers send, such as the IP address and the type of browser, to deliver the app and protect it from abuse. Frata adds no analytics, adverts or tracking of its own.',
  ]) +
  sec('When you email', [
    'Feedback & bugs opens an email that already says which version of Frata, which kind of phone and browser, the screen size and the page you were on, so a problem can be reproduced. Nothing from your entries is added. You see the whole email before you send it.',
    'Emails are only used to reply to you. To have yours deleted, just ask.',
  ]) +
  sec('Frata Plus', [
    'Frata Plus is a one-off payment of ' +
      PLUS_PRICE +
      ', made through Whish under Whish’s own terms. It unlocks the features listed in Settings → Frata Plus, and what you’ve unlocked stays unlocked.',
    'Your unlock code is made for you, with the name you give. It works on any phone you use, offline, and is kept with your data, so backups and moving phones keep Plus. Please don’t share it. If you lose it, email and it will be sent again.',
    'To send and re-send codes, the name, email address and payment details you give are kept, and never shared or sold.',
    'Changed your mind? Ask within ' + REFUND_DAYS + ' days of paying for a full refund, no questions asked.',
  ]) +
  sec('Frata is provided as is', [
    'Frata is a tool for keeping track of your own money. It isn’t financial advice, and the exchange rate is the one you set. It’s made with care and tested, but it comes without any guarantee that it’s free of mistakes or will always be available. As far as the law allows, its makers aren’t responsible for losses from lost data or from decisions based on what it shows, so keep backups and check what matters.',
  ]) +
  sec('Changes', [
    'If these terms change, the date at the top changes too, and anything important will be in What’s new.',
  ]) +
  '</div>';
