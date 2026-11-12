/* UI state shared between views and sheets. */

export let view = 'home',
  quickTab = 'frequent';

export const hist = {
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: 'all',
  q: '',
};

export let pendingImport = null,
  pendingMove = null,
  armed = null,
  showOpening = false;

export function setView(value) {
  view = value;
  return value;
}

export function setQuickTab(value) {
  quickTab = value;
  return value;
}

export function setPendingImport(value) {
  pendingImport = value;
  return value;
}

/* Data brought from the old address by a move link, waiting for the person to confirm it (handoff.js). */
export function setPendingMove(value) {
  pendingMove = value;
  return value;
}

export function setArmed(value) {
  armed = value;
  return value;
}

/* Whether Settings shows the starting balances, which are tucked away behind a link. */
export function setShowOpening(value) {
  showOpening = value;
  return value;
}
