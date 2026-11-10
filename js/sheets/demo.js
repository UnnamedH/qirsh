/* A one-time tip on Home for the price-first way of adding expenses, with a very short demo. */
import { ICON } from '../icons.js';
import { state } from '../state.js';

/* Kept on this device only, like the install tip: it isn't part of the user's data or backups. */
const TIP_KEY = 'qirsh.tipPriceFirst';

/** The tip shows once, to people still adding expenses as paid + change, once they use their own data. */
export function showPriceTip() {
  // Not on top of the example data: a first launch already has a banner, and nothing is "new" yet.
  if (state.settings.entryStyle === 'price' || state.sample) return false;
  try {
    return !localStorage.getItem(TIP_KEY);
  } catch (e) {
    return false;
  }
}

export function markPriceTipDone() {
  try {
    localStorage.setItem(TIP_KEY, 'done');
  } catch (e) {}
}

export function priceTipBanner() {
  return (
    '<div class="banner tip"><p><strong>New:</strong> type the price and what you paid with, and Qirsh works out your change.</p>' +
    '<button class="btn sm primary" data-act="tipShow">Show me</button>' +
    '<button class="icon-btn" data-act="tipClose" aria-label="Dismiss this tip">' +
    ICON.close +
    '</button></div>'
  );
}

/* Three steps of a real example, appearing one after another (see .demo in styles.css). */
export function demoSheet() {
  const step = (label, value, extra = '') =>
    '<div class="demo-step"><span class="sub-label">' +
    label +
    '</span><span class="demo-value">' +
    value +
    '</span>' +
    extra +
    '</div>';
  return (
    '<div class="sheet-head"><h2>Price first</h2><button class="icon-btn" data-act="tipClose" aria-label="Close">' +
    ICON.close +
    '</button></div>' +
    '<div class="demo">' +
    step('1. Type the price', '385<span class="k-suffix">,000</span> LL') +
    step('2. Say what you paid with', '$10') +
    step(
      '3. The change is worked out',
      '510<span class="k-suffix">,000</span> LL back',
      '<span class="note">Got a different amount? Just change it.</span>',
    ) +
    '</div>' +
    '<p class="note">You can switch back any time in Settings → Display.</p>' +
    '<div class="sheet-actions"><button class="btn" data-act="tipClose">Not now</button>' +
    '<button class="btn primary" data-act="tipUse">Use price first</button></div>'
  );
}
