/* Draws the current view. */
import { backupDue } from '../backup.js';
import { moveDue } from '../handoff.js';
import { IOS, updateReady } from '../pwa.js';
import { isSampleTx } from '../sample.js';
import { rescuedData, save, saveConflict, saveFailed, state } from '../state.js';
import { applyTheme } from '../theme.js';
import { fitAllThousands } from './amount.js';
import { pendingMove, view } from './ui-state.js';
import { $, DAYS, MONTHS, esc } from '../util.js';
import { renderBudgets } from '../views/budgets.js';
import { renderHistory } from '../views/history.js';
import { renderHome } from '../views/home.js';
import { renderSettings } from '../views/settings.js';

export function render() {
  applyTheme();
  document.documentElement.classList.toggle('hide-amounts', state.settings.hide);
  renderAlerts();
  ['home', 'history', 'budgets', 'settings'].forEach((v) => {
    $('#v-' + v).hidden = v !== view;
  });
  document.querySelectorAll('.tabs button').forEach((b) => {
    if (b.dataset.v === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#topSub').textContent = {
    home: DAYS[new Date().getDay()] + ' ' + new Date().getDate() + ' ' + MONTHS[new Date().getMonth()],
    history: 'History',
    budgets: 'Budgets',
    settings: 'Settings',
  }[view];
  ({ home: renderHome, history: renderHistory, budgets: renderBudgets, settings: renderSettings })[view]();
  updateNotesList();
  fitAllThousands($('main'));
}

/* Warnings shown above every view while there is a problem with saved data. */
function renderAlerts() {
  const alerts = [];
  if (saveFailed)
    alerts.push(
      '<div class="banner bad" role="alert"><p><strong>Your last change wasn’t saved.</strong> This browser’s storage is full or blocked, for example in a private window. Export a backup from Settings so nothing is lost.</p></div>',
    );
  if (saveConflict)
    alerts.push(
      '<div class="banner bad" role="alert"><p><strong>Your last change wasn’t saved.</strong> Frata was changed in another tab or window, and this one has now caught up. Please make the change again.</p></div>',
    );
  if (pendingMove) alerts.push(moveAlert(pendingMove));
  if (moveDue()) alerts.push(leaveAlert());
  if (rescuedData() && view !== 'settings')
    alerts.push(
      '<div class="banner bad" role="alert"><p>Your saved data couldn’t be read, so Frata started empty. A copy was kept on this device.</p><button class="btn sm" data-act="nav" data-v="settings">Open Backup</button></div>',
    );
  if (view === 'home' && backupDue())
    alerts.push(
      '<div class="banner"><p>' +
        (state.lastExport
          ? 'It’s been over a month since your last backup.'
          : 'You haven’t made a backup yet.') +
        ' Your entries live only on this phone.</p><button class="btn sm primary" data-act="backupNow">Back up</button><button class="btn sm" data-act="backupLater">Later</button></div>',
    );
  if (updateReady)
    alerts.push(
      '<div class="banner" role="status"><p>A new version of Frata is ready.</p><button class="btn sm primary" data-act="reloadApp">Reload</button></div>',
    );
  const el = $('#alerts');
  el.innerHTML = alerts.join('');
  el.hidden = !alerts.length;
}

/* Asks before data brought from the old address replaces what is here. */
function moveAlert(m) {
  if (m.error)
    return '<div class="banner bad" role="alert"><p>The data in that link couldn’t be read, so nothing was changed. Go back to the old app and try again, or move it with a backup file instead.</p><button class="btn sm" data-act="moveCancel">OK</button></div>';
  const n = (x, one, many) => '<strong>' + x + '</strong> ' + (x === 1 ? one : many);
  const own = state.tx.filter((t) => !isSampleTx(t)).length;
  let here = '';
  if (state.sample)
    here = own
      ? 'It replaces the example data and the ' + n(own, 'entry', 'entries') + ' you added here.'
      : 'It replaces the example data.';
  else if (state.tx.length || state.budgets.length)
    here = 'It replaces the ' + n(state.tx.length, 'entry', 'entries') + ' already here.';
  return (
    '<div class="banner" role="alert" style="flex-direction:column;align-items:stretch"><p><strong>Your data has arrived.</strong> It has ' +
    n(m.tx.length, 'entry', 'entries') +
    ' and ' +
    n(m.budgets.length, 'budget', 'budgets') +
    '. ' +
    here +
    '</p><div class="btn-row"><button class="btn primary sm" data-act="moveConfirm">Use this data</button><button class="btn sm" data-act="moveCancel">Not now</button></div></div>'
  );
}

/* On the old address: asks people to take their data to frata.cc. */
function leaveAlert() {
  const empty = state.sample && !state.tx.some((t) => !isSampleTx(t));
  let p, btn;
  if (empty) {
    p = ' Open it there from now on.';
    btn = '<button class="btn primary sm" data-act="moveGo">Open frata.cc</button>';
  } else if (IOS) {
    // On iPhone the Home Screen app and Safari keep separate data, so a link can land in the wrong one.
    p =
      ' To take your data along, make a backup here, then add frata.cc to your Home Screen and import the backup in its Settings.';
    btn = '<button class="btn primary sm" data-act="backupNow">Back up</button>';
  } else {
    p = ' Move your data there in one tap, then use Frata from the new address.';
    btn = '<button class="btn primary sm" data-act="moveGo">Move my data</button>';
  }
  return (
    '<div class="banner" role="status" style="flex-direction:column;align-items:stretch"><p><strong>Frata has a new home: frata.cc.</strong>' +
    p +
    '</p><div class="btn-row">' +
    btn +
    '<button class="btn sm" data-act="moveLater">Later</button></div></div>'
  );
}

export function commit() {
  save();
  render();
}

/* Autocomplete suggestions for the Note and "Who will pay you back?" fields. */
let notesDl = null;
let whoDl = null;

function updateNotesList() {
  if (!notesDl) {
    notesDl = document.createElement('datalist');
    notesDl.id = 'notesList';
    document.body.appendChild(notesDl);
  }
  if (!whoDl) {
    whoDl = document.createElement('datalist');
    whoDl.id = 'whoList';
    document.body.appendChild(whoDl);
  }
  whoDl.innerHTML = [
    ...new Set(state.tx.filter((t) => t.type === 'advance' && t.who).map((t) => t.who.trim())),
  ]
    .map((n) => '<option value="' + esc(n) + '"></option>')
    .join('');
  const seen = new Map();
  state.tx.forEach((t) => {
    const n = (t.note || '').trim();
    if (n) seen.set(n, (seen.get(n) || 0) + 1);
  });
  notesDl.innerHTML = [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([n]) => '<option value="' + esc(n) + '"></option>')
    .join('');
}
