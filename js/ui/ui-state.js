/* UI state shared between views and sheets. */

export let view = 'home',
  quickTab = 'frequent';

export const hist = {
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: 'all',
  q: '',
};

export let pendingImport = null,
  armed = null;

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
