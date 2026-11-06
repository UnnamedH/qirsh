/* Draws the current view. */
import { save, state } from '../state.js';
import { applyTheme } from '../theme.js';
import { view } from './ui-state.js';
import { $, DAYS, MONTHS, esc } from '../util.js';
import { renderBudgets } from '../views/budgets.js';
import { renderHistory } from '../views/history.js';
import { renderHome } from '../views/home.js';
import { renderSettings } from '../views/settings.js';

export function render() {
  applyTheme();
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
