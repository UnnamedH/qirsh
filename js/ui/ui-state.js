/* UI state shared between views and sheets. */

export let view = 'home',
  quickTab = 'frequent';

export const hist = {
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: 'all',
  q: '',
  // Set when an account is tapped on Home: History then shows only that account's entries.
  account: null,
  // 'list' of entries, 'chart' of the month's spending by category, or 'trends' month by month.
  mode: 'list',
  // Trends: how many months to show, and the one category to follow (null for all spending).
  span: 6,
  cat: null,
};

/* Settings: which of its pages is shown ('accounts', 'categories', or null for Settings itself), which
   backup choices are open ('out' to back up, 'in' to restore, or null), and whether the categories show
   their move and delete buttons. */
export const setUi = { page: null, backup: null, catEdit: false };

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
