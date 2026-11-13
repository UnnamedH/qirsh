/* Sheet opened by tapping an account on Home: spend, add, move or correct money in that account. */
import { accName } from '../config.js';
import { ICON } from '../icons.js';
import { balances } from '../ledger.js';
import { fmt } from '../money.js';
import { form } from './sheet.js';

const action = (act, v, title, sub) =>
  '<div class="row"><button class="row-btn acct-act" data-act="' +
  act +
  '" data-v="' +
  v +
  '"><span class="row-main"><span class="row-title">' +
  title +
  '</span><span class="row-sub">' +
  sub +
  '</span></span>' +
  ICON.right +
  '</button></div>';

export function accountSheet() {
  const id = form.account,
    name = accName(id),
    b = balances()[id] || { USD: 0, LBP: 0 };
  return (
    '<div class="sheet-head"><h2>' +
    name +
    '</h2><button class="icon-btn" data-act="close" aria-label="Close">' +
    ICON.close +
    '</button></div>' +
    '<p class="balance-split priv" style="margin:-6px 0 12px">' +
    fmt(b.USD, 'USD') +
    (Math.abs(b.LBP) > 0 ? ' · ' + fmt(b.LBP, 'LBP') : '') +
    '</p>' +
    '<div class="list">' +
    (id === 'wallet'
      ? ''
      : action('accTx', 'expense', 'Spend from ' + name, 'An expense paid straight from ' + name) +
        action('accTx', 'income', 'Money into ' + name, 'Income that lands in ' + name)) +
    action('transferTo', id, 'Move money', 'Between ' + name + ' and your other accounts') +
    action('newAdjust', id, 'Correct balance', 'Set what ' + name + ' really holds') +
    '</div>'
  );
}
