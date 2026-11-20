/* UI state shared between views and sheets. */

export let view = 'home';

export const hist = {
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: 'all',
  // Set when a fund is tapped on Home: History then shows only that fund's entries.
  account: null,
};

/* Something waiting for a second tap, such as 'tx' (delete) or 'acc:<id>' (remove a fund). */
export let armed = null;

/* A backup the person picked, waiting for them to confirm it replaces what is here. */
export let pendingImport = null;

export let showOpening = false;

export function setView(value) {
  view = value;
  return value;
}
export function setArmed(value) {
  armed = value;
  return value;
}
export function setPendingImport(value) {
  pendingImport = value;
  return value;
}
export function setShowOpening(value) {
  showOpening = value;
  return value;
}
