/* Settings view. */
import { APP_VERSION } from '../changelog.js';
import { MAIN, MAX_ACCOUNTS, MAX_NAME, accounts } from '../accounts.js';
import { PROTECTED } from '../config.js';
import { emailLink, whatsappLink } from '../feedback.js';
import { ICON } from '../icons.js';
import { catName } from '../ledger.js';
import { toInput } from '../money.js';
import { rescuedData, state } from '../state.js';
import { ACCENTS, DEFAULT_ACCENT } from '../theme.js';
import { thousandsInput } from '../ui/amount.js';
import { armed, pendingImport, showOpening } from '../ui/ui-state.js';
import { $, dayLabel, esc } from '../util.js';

export function renderSettings() {
  const s = state.settings;
  let h =
    '<section class="sec"><h2>Exchange rate</h2><div class="card"><div class="set-row"><label class="field"><span>LL for 1 USD</span><input id="rate" class="num" inputmode="numeric" value="' +
    (armed && armed.startsWith('rate:')
      ? (+armed.slice(5)).toLocaleString('en-US')
      : state.rate.toLocaleString('en-US')) +
    '"></label></div>' +
    (armed && armed.startsWith('rate:')
      ? '<div class="banner bad" style="flex-direction:column;align-items:stretch"><p>That’s a big change from ' +
        state.rate.toLocaleString('en-US') +
        ' LL. Entries you add while it’s set keep this rate, so check it isn’t a typo.</p><div class="btn-row"><button class="btn sm primary" data-act="rateConfirm" data-v="' +
        esc(armed.slice(5)) +
        '">Use ' +
        (+armed.slice(5)).toLocaleString('en-US') +
        ' LL</button><button class="btn sm" data-act="rateCancel">Keep ' +
        state.rate.toLocaleString('en-US') +
        '</button></div></div>'
      : '') +
    '</div></section>';
  h +=
    '<section class="sec"><h2>Display</h2><div class="card"><div class="set-row"><span>Show totals in</span><div class="seg">' +
    [
      ['USD', 'USD'],
      ['LBP', 'LL'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="setDisplay" data-v="' +
          k +
          '" aria-pressed="' +
          (s.display === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div></div>' +
    '<div class="set-row"><span>Week starts on</span><div class="seg">' +
    [
      [1, 'Mon'],
      [6, 'Sat'],
      [0, 'Sun'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="setWeek" data-v="' +
          k +
          '" aria-pressed="' +
          (s.weekStart === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div></div>' +
    '<div class="set-row"><span>Adding an expense</span><div class="seg">' +
    [
      ['price', 'Price first'],
      ['paid', 'Paid + change'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="setEntryStyle" data-v="' +
          k +
          '" aria-pressed="' +
          ((s.entryStyle || 'paid') === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div></div>' +
    '</div></section>';
  const acc = (s.accent || DEFAULT_ACCENT).toUpperCase(),
    preset = ACCENTS.some(([c]) => c === acc);
  const check =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  h +=
    '<section class="sec"><h2>Appearance</h2><div class="card"><div class="set-row"><span>Theme</span><div class="seg">' +
    [
      ['system', 'System'],
      ['light', 'Light'],
      ['dark', 'Dark'],
    ]
      .map(
        ([k, l]) =>
          '<button data-act="setTheme" data-v="' +
          k +
          '" aria-pressed="' +
          ((s.theme || 'system') === k) +
          '">' +
          l +
          '</button>',
      )
      .join('') +
    '</div></div>' +
    '<p class="label">Colour</p><div class="swatches" role="group" aria-label="Accent colour">' +
    ACCENTS.map(
      ([c, n]) =>
        '<button class="swatch" style="--c:' +
        c +
        '" data-act="setAccent" data-v="' +
        c +
        '" aria-pressed="' +
        (acc === c) +
        '" aria-label="' +
        n +
        '" title="' +
        n +
        '">' +
        (acc === c ? check : '') +
        '</button>',
    ).join('') +
    '<label class="swatch custom" style="--c:' +
    (preset ? 'transparent' : esc(acc)) +
    '"' +
    (preset ? '' : ' aria-pressed="true"') +
    ' title="Custom colour"><input type="color" id="accentPick" value="' +
    esc(acc.toLowerCase()) +
    '" aria-label="Custom colour">' +
    (preset ? '' : check) +
    '</label></div>' +
    '</div></section>';
  h +=
    '<section class="sec" id="accountsSec"><h2>Accounts</h2><div class="card">' +
    accountRows() +
    '<div class="links"><button class="link" data-act="toggleOpening" aria-expanded="' +
    showOpening +
    '">' +
    (showOpening ? 'Hide starting balances' : 'Edit starting balances') +
    '</button></div>' +
    (showOpening ? openingFields() : '') +
    '</div></section>';
  const used = (id) => state.tx.filter((t) => t.categoryId === id).length;
  h +=
    '<section class="sec"><h2>Categories</h2><div class="card">' +
    ['expense', 'income']
      .map((type) => {
        const list = state.categories.filter((c) => c.type === type);
        return (
          '<p class="label">' +
          (type === 'expense' ? 'Spending' : 'Income') +
          '</p>' +
          list
            .map(
              (c, i) =>
                '<div class="cat-row"><input class="input emoji" data-caticon="' +
                esc(c.id) +
                '" value="' +
                esc(c.icon || '') +
                '" placeholder="' +
                esc(c.name.charAt(0)) +
                '" autocomplete="off" aria-label="Emoji for ' +
                esc(c.name) +
                '">' +
                '<input class="input" data-cat="' +
                esc(c.id) +
                '" value="' +
                esc(c.name) +
                '" aria-label="Category name">' +
                '<button class="icon-btn" data-act="catMove" data-id="' +
                esc(c.id) +
                '" data-v="-1" aria-label="Move ' +
                esc(c.name) +
                ' up"' +
                (i === 0 ? ' disabled' : '') +
                '>' +
                ICON.up +
                '</button>' +
                '<button class="icon-btn" data-act="catMove" data-id="' +
                esc(c.id) +
                '" data-v="1" aria-label="Move ' +
                esc(c.name) +
                ' down"' +
                (i === list.length - 1 ? ' disabled' : '') +
                '>' +
                ICON.down +
                '</button>' +
                (PROTECTED.includes(c.id)
                  ? '<span class="icon-btn" aria-hidden="true"></span>'
                  : '<button class="icon-btn' +
                    (armed === 'cat:' + c.id ? ' armed' : '') +
                    '" data-act="delCat" data-id="' +
                    esc(c.id) +
                    '" aria-label="Delete ' +
                    esc(c.name) +
                    '">' +
                    ICON.trash +
                    '</button>') +
                '</div>' +
                (armed === 'cat:' + c.id
                  ? '<p class="note" style="color:var(--bad)">Tap the bin again to delete.' +
                    (used(c.id)
                      ? ' Its ' +
                        used(c.id) +
                        ' entries move to "' +
                        esc(catName(type === 'expense' ? 'other' : 'other-in')) +
                        '".'
                      : '') +
                    '</p>'
                  : ''),
            )
            .join('')
        );
      })
      .join('') +
    '<p class="label">New category</p><div class="cat-row"><input class="input emoji" id="newCatIcon" placeholder="+" autocomplete="off" aria-label="Emoji for new category"><input class="input" id="newCatName" placeholder="Name" aria-label="New category name">' +
    '<select class="input" id="newCatType" style="flex:0 0 auto;width:auto" aria-label="Type"><option value="expense">Spending</option><option value="income">Income</option></select></div>' +
    '<div class="btn-row"><button class="btn sm" data-act="addCat">Add category</button></div></div></section>';
  h +=
    '<section class="sec" id="feedbackSec"><h2>Feedback &amp; bugs</h2><div class="card">' +
    '<div class="btn-row"><a class="btn" href="' +
    esc(whatsappLink()) +
    '" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="' +
    esc(emailLink()) +
    '">Email</a></div>' +
    '<p class="note">Attach a screenshot in the chat if it helps.</p></div></section>';
  h +=
    '<section class="sec"><h2>Reset</h2><div class="card"><div class="btn-row"><button class="btn danger' +
    (armed === 'wipe' ? ' armed' : '') +
    '" data-act="wipe">' +
    (armed === 'wipe' ? 'Tap again to delete everything' : 'Clear all data') +
    '</button></div></div></section>';
  h +=
    '<section class="sec" id="backupSec"><h2>Backup</h2><div class="card"><p class="note">' +
    (state.lastExport ? 'Last export: ' + dayLabel(state.lastExport.slice(0, 10)) + '.' : 'No export yet.') +
    '</p>' +
    '<div class="btn-row"><button class="btn" data-act="exportShare">Share</button><button class="btn" data-act="exportSave">Save file</button><button class="btn" data-act="exportCopy">Copy JSON</button></div>' +
    '<div id="exportOut"></div>' +
    (rescuedData()
      ? '<div class="banner bad" style="flex-direction:column;align-items:stretch"><p>Saved data that couldn’t be read was kept on this device. Download it to keep it safe, or discard it once you no longer need it.</p><div class="btn-row"><button class="btn sm" data-act="exportRescued">Download it</button><button class="btn sm danger' +
        (armed === 'rescue' ? ' armed' : '') +
        '" data-act="discardRescued">' +
        (armed === 'rescue' ? 'Tap again to discard' : 'Discard') +
        '</button></div></div>'
      : '') +
    '<div class="btn-row"><button class="btn" data-act="importPick">Import file</button><button class="btn ghost" data-act="importPaste">Paste JSON</button></div><div id="importArea"></div>' +
    (pendingImport
      ? '<div class="banner" style="flex-direction:column;align-items:stretch"><p>This backup has <strong>' +
        pendingImport.tx.length +
        '</strong> entries and <strong>' +
        pendingImport.budgets.length +
        '</strong> budgets. Importing replaces everything on this phone.</p><div class="btn-row"><button class="btn primary sm" data-act="importConfirm">Replace my data</button><button class="btn sm" data-act="importCancel">Cancel</button></div></div>'
      : '') +
    '</div></section>';
  h +=
    '<section class="sec"><h2>Privacy</h2><div class="card">' +
    '<p class="note">Everything you enter stays on this phone, in this browser. Frata has no account and no server, and it never sends your data anywhere: the browser is set to block it from contacting any other website. Nobody else can see your data, not even the people who make Frata.</p>' +
    '<p class="note">Your data isn’t encrypted on the phone, so anyone who can unlock your phone and open Frata can see it. Clearing this browser’s data or removing the app deletes it, so keep a backup.</p>' +
    '</div></section>';
  h +=
    '<p class="note" style="text-align:center">Frata · version ' +
    APP_VERSION +
    ' · ' +
    state.tx.length +
    (state.tx.length === 1 ? ' entry' : ' entries') +
    ' saved on this device<br><button class="link" data-act="showNews">What’s new</button></p>';
  $('#v-settings').innerHTML = h;
}

/* Rename, mark as savings or remove each account in use, add more, and bring back removed ones. */
function accountRows() {
  const list = accounts();
  let h = list
    .map((a) => {
      const main = a.id === MAIN,
        sure = armed === 'acc:' + a.id;
      return (
        '<div class="acct-row"><input class="input" data-accname="' +
        esc(a.id) +
        '" value="' +
        esc(a.name) +
        '" maxlength="' +
        MAX_NAME +
        '" aria-label="Name of ' +
        esc(a.name) +
        '">' +
        (main
          ? '<span class="muted acct-main">Main</span>'
          : '<label class="acct-save"><input type="checkbox" data-accsave="' +
            esc(a.id) +
            '"' +
            (a.savings ? ' checked' : '') +
            '> Savings</label><button class="btn sm danger' +
            (sure ? ' armed' : '') +
            '" data-act="accRemove" data-v="' +
            esc(a.id) +
            '">' +
            (sure ? 'Tap again' : 'Remove') +
            '</button>') +
        '</div>'
      );
    })
    .join('');
  if (list.length < MAX_ACCOUNTS)
    h += '<div class="btn-row"><button class="btn sm" data-act="accAdd">+ Add account</button></div>';
  const gone = state.accounts.filter((a) => a.hidden);
  if (gone.length)
    h +=
      '<p class="note">Removed: ' +
      gone
        .map(
          (a) =>
            esc(a.name) +
            ' <button class="link" data-act="accRestore" data-v="' +
            esc(a.id) +
            '">Restore</button>',
        )
        .join(' · ') +
      '</p>';
  return h;
}

/* Starting balances change every balance back to the first entry, so they sit behind a link. */
function openingFields() {
  return accounts()
    .map(
      (a) =>
        '<div class="grid2"><label class="field"><span>' +
        esc(a.name) +
        ' USD</span><input class="num" data-open="' +
        esc(a.id) +
        '" data-cur="USD" inputmode="decimal" value="' +
        ((state.opening[a.id] || {}).USD || 0) +
        '"></label><label class="field"><span>' +
        a.name +
        ' LL</span>' +
        thousandsInput(
          ' data-open="' + esc(a.id) + '" data-cur="LBP"',
          toInput((state.opening[a.id] || {}).LBP || 0, 'LBP'),
          a.name + ' LL',
        ) +
        '</label></div>',
    )
    .join('');
}
