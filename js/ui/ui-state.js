/* UI state shared between views and sheets. */

export let view = 'home',
  quickTab = 'frequent';

export const hist = {
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: 'all',
  q: '',
};

export let pendingImport = null,
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

export function setArmed(value) {
  armed = value;
  return value;
}

/* Whether Settings shows the starting balances, which are tucked away behind a link. */
export function setShowOpening(value) {
  showOpening = value;
  return value;
}
