/* Draws the current view and the warnings above it. */
import { $, esc } from '../../../js/util.js';
import { fitAllThousands } from '../../../js/ui/amount.js';
import { updateReady } from '../pwa.js';
import { rescuedData, save, saveConflict, saveFailed, state } from '../state.js';
import { applyTheme } from '../theme.js';
import { renderEvents } from '../views/events.js';
import { renderHistory } from '../views/history.js';
import { renderHome } from '../views/home.js';
import { renderSettings } from '../views/settings.js';
import { pendingImport, view } from './ui-state.js';

const VIEWS = { home: renderHome, events: renderEvents, history: renderHistory, settings: renderSettings };
const TITLES = { home: '', events: 'Events', history: 'History', settings: 'Settings' };

export function render() {
  applyTheme();
  renderAlerts();
  Object.keys(VIEWS).forEach((v) => {
    $('#v-' + v).hidden = v !== view;
  });
  document.querySelectorAll('.tabs button').forEach((b) => {
    if (b.dataset.v === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#topSub').textContent = TITLES[view] || '';
  drawView(view);
}

/** Draws one tab's content. */
export function drawView(v) {
  VIEWS[v]();
  fitAllThousands($('#v-' + v));
}

function renderAlerts() {
  const alerts = [];
  if (saveFailed)
    alerts.push(
      '<div class="banner bad" role="alert"><p><strong>Your last change wasn’t saved.</strong> This browser’s storage is full or blocked, for example in a private window. Save a backup from Settings so nothing is lost.</p></div>',
    );
  if (saveConflict)
    alerts.push(
      '<div class="banner bad" role="alert"><p><strong>Your last change wasn’t saved.</strong> Frata Scouts was changed in another tab or window, and this one has now caught up. Please make the change again.</p></div>',
    );
  if (pendingImport) alerts.push(importAlert(pendingImport));
  if (rescuedData() && view !== 'settings')
    alerts.push(
      '<div class="banner bad" role="alert"><p>Your saved data couldn’t be read, so Frata Scouts started empty. A copy was kept on this device.</p></div>',
    );
  if (updateReady)
    alerts.push(
      '<div class="banner" role="status"><p>A new version of Frata Scouts is ready.</p><button class="btn sm primary" data-act="reloadApp">Reload</button></div>',
    );
  const el = $('#alerts');
  el.innerHTML = alerts.join('');
  el.hidden = !alerts.length;
}

/* Asks before a backup replaces what is here. */
function importAlert(p) {
  if (p.error)
    return '<div class="banner bad" role="alert"><p>That file isn’t a Frata Scouts backup, so nothing was changed. A backup from the personal Frata app can’t be used here.</p><button class="btn sm" data-act="importCancel">OK</button></div>';
  const n = p.state.tx.length;
  const g = p.state.group.name ? ' for ' + esc(p.state.group.name) : '';
  return (
    '<div class="banner" role="alert" style="flex-direction:column;align-items:stretch"><p><strong>Replace everything here?</strong> This backup' +
    g +
    ' has <strong>' +
    n +
    '</strong> ' +
    (n === 1 ? 'entry' : 'entries') +
    '. It replaces the ' +
    state.tx.length +
    ' here.</p><div class="btn-row"><button class="btn primary sm" data-act="importConfirm">Replace</button><button class="btn sm" data-act="importCancel">Cancel</button></div></div>'
  );
}

export function commit() {
  save();
  render();
}
