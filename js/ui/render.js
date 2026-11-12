/* Draws the current view. */
import { updateReady } from '../pwa.js';
import { backupDue } from '../backup.js';
import { rescuedData, save, saveConflict, saveFailed, state } from '../state.js';
import { applyTheme } from '../theme.js';
import { fitAllThousands } from './amount.js';
import { view } from './ui-state.js';
import { $, DAYS, MONTHS, esc } from '../util.js';
import { renderBudgets } from '../views/budgets.js';
import { renderHistory } from '../views/history.js';
import { renderHome } from '../views/home.js';
import { renderSettings } from '../views/settings.js';

export function render() {
  applyTheme();
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
      '<div class="banner bad" role="alert"><p><strong>Your last change wasn’t saved.</strong> Qirsh was changed in another tab or window, and this one has now caught up. Please make the change again.</p></div>',
    );
  if (rescuedData() && view !== 'settings')
    alerts.push(
      '<div class="banner bad" role="alert"><p>Your saved data couldn’t be read, so Qirsh started empty. A copy was kept on this device.</p><button class="btn sm" data-act="nav" data-v="settings">Open Backup</button></div>',
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
      '<div class="banner" role="status"><p>A new version of Qirsh is ready.</p><button class="btn sm primary" data-act="reloadApp">Reload</button></div>',
    );
  const el = $('#alerts');
  el.innerHTML = alerts.join('');
  el.hidden = !alerts.length;
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
