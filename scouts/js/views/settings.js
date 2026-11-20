/* Settings: group name, exchange rate, display, funds, starting balances and backups. */
import { MAX_ACCOUNTS, MAX_NAME, accounts } from '../../../js/core/accounts.js';
import { toInput } from '../../../js/core/money.js';
import { thousandsInput } from '../../../js/ui/amount.js';
import { $, esc } from '../../../js/util.js';
import { APP_VERSION } from '../version.js';
import { rescuedData, state } from '../state.js';
import { armed, showOpening } from '../ui/ui-state.js';

const seg = (act, pairs, current) =>
  '<div class="seg">' +
  pairs
    .map(
      ([k, l]) =>
        '<button data-act="' +
        act +
        '" data-v="' +
        k +
        '" aria-pressed="' +
        (current === k) +
        '">' +
        l +
        '</button>',
    )
    .join('') +
  '</div>';

function accountRows() {
  return state.accounts
    .map((a) => {
      const gone = !!a.hidden,
        main = a.id === 'wallet';
      return (
        '<div class="acc-row' +
        (gone ? ' gone' : '') +
        '"><input class="input" data-accname="' +
        esc(a.id) +
        '" value="' +
        esc(a.name) +
        '" maxlength="' +
        MAX_NAME +
        '" aria-label="Fund name"' +
        (gone ? ' disabled' : '') +
        '>' +
        (main
          ? '<span class="icon-btn" aria-hidden="true"></span>'
          : gone
            ? '<button class="btn sm" data-act="accRestore" data-id="' + esc(a.id) + '">Restore</button>'
            : '<button class="btn sm danger' +
              (armed === 'acc:' + a.id ? ' armed' : '') +
              '" data-act="accRemove" data-id="' +
              esc(a.id) +
              '">' +
              (armed === 'acc:' + a.id ? 'Tap to confirm' : 'Remove') +
              '</button>') +
        '</div>'
      );
    })
    .join('');
}

function openingFields() {
  return (
    '<p class="note">What each fund held before you started using the app.</p>' +
    accounts(state)
      .map((a) => {
        const o = state.opening[a.id] || { USD: 0, LBP: 0 };
        return (
          '<div class="set-row"><span>' +
          esc(a.name) +
          '</span><span class="open-pair"><input class="num" inputmode="decimal" data-open="' +
          esc(a.id) +
          '" data-cur="USD" value="' +
          esc(toInput(o.USD, 'USD')) +
          '" aria-label="' +
          esc(a.name) +
          ' starting dollars"> USD ' +
          thousandsInput(
            ' data-open="' + esc(a.id) + '" data-cur="LBP"',
            toInput(o.LBP, 'LBP'),
            a.name + ' starting LL',
          ) +
          ' LL</span></div>'
        );
      })
      .join('')
  );
}

export function renderSettings() {
  // A rate waiting for confirmation, set by a big change typed into the rate field (see events.js).
  const pendingRate = armed && armed.startsWith('rate:') ? +armed.slice(5) : 0;
  let h =
    '<section class="sec"><h2>Group</h2><div class="card"><div class="set-row"><label class="field"><span>Group name</span><input id="groupName" class="input" maxlength="60" autocomplete="off" value="' +
    esc(state.group.name) +
    '" placeholder="e.g. Group 12"></label></div></div></section>';
  h +=
    '<section class="sec"><h2>Exchange rate</h2><div class="card"><div class="set-row"><label class="field"><span>LL for 1 USD</span><input id="rate" class="num" inputmode="numeric" value="' +
    (pendingRate ? pendingRate : state.rate).toLocaleString('en-US') +
    '"></label></div>' +
    (pendingRate
      ? '<div class="banner bad" style="flex-direction:column;align-items:stretch"><p>That’s a big change from ' +
        state.rate.toLocaleString('en-US') +
        ' LL. Entries you add while it’s set keep this rate, so check it isn’t a typo.</p><div class="btn-row"><button class="btn sm primary" data-act="rateConfirm" data-v="' +
        pendingRate +
        '">Use ' +
        pendingRate.toLocaleString('en-US') +
        ' LL</button><button class="btn sm" data-act="rateCancel">Keep ' +
        state.rate.toLocaleString('en-US') +
        '</button></div></div>'
      : '<p class="note">Each entry keeps the rate of the day it was saved, so changing this never changes past months.</p>') +
    '</div></section>';
  h +=
    '<section class="sec"><h2>Display</h2><div class="card"><div class="set-row"><span>Show totals in</span>' +
    seg(
      'setDisplay',
      [
        ['USD', 'USD'],
        ['LBP', 'LL'],
      ],
      state.settings.display,
    ) +
    '</div><div class="set-row"><span>Theme</span>' +
    seg(
      'setTheme',
      [
        ['system', 'Auto'],
        ['light', 'Light'],
        ['dark', 'Dark'],
      ],
      state.settings.theme,
    ) +
    '</div></div></section>';
  h +=
    '<section class="sec" id="accountsSec"><h2>Funds</h2><div class="card">' +
    accountRows() +
    (accounts(state).length < MAX_ACCOUNTS
      ? '<div class="set-row"><input id="newAcc" class="input" maxlength="' +
        MAX_NAME +
        '" placeholder="New fund, e.g. Camp savings" aria-label="New fund name"><button class="btn sm" data-act="accAdd">Add</button></div>'
      : '') +
    '<div class="links"><button class="link" data-act="toggleOpening" aria-expanded="' +
    showOpening +
    '">' +
    (showOpening ? 'Hide starting balances' : 'Edit starting balances') +
    '</button></div>' +
    (showOpening ? openingFields() : '') +
    '</div></section>';
  h +=
    '<section class="sec"><h2>Backup</h2><div class="card"><p class="note">Your entries live only on this device. Save a backup file now and then.' +
    (state.lastExport ? ' Last backup: ' + esc(state.lastExport.slice(0, 10)) + '.' : '') +
    '</p><div class="btn-row"><button class="btn sm primary" data-act="backupSave">Save backup</button><button class="btn sm" data-act="importPick">Restore from file</button></div>' +
    (rescuedData()
      ? '<p class="note">Unreadable data from an earlier version is still kept on this device.</p>'
      : '') +
    '</div></section>';
  h += '<p class="foot">Frata Scouts ' + esc(APP_VERSION) + ' · everything stays on this device</p>';
  $('#v-settings').innerHTML = h;
}
