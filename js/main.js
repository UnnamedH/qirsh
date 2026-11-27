/* Entry point. */
import { APP_VERSION, unseenChanges } from './changelog.js';
import { balances, budgetStatus, combinedUSD, range, sumIn } from './ledger.js';
import { backVec, entryValueIn, fmt, parseAmt, payVec, txCostUSD } from './money.js';
import { checkMove, moveLink } from './handoff.js';
import { registerSW } from './pwa.js';
import { newsList, setNewsList } from './sheets/news.js';
import { openSheet, setForm } from './sheets/sheet.js';
import { plusInfo } from './plus.js';
import { normalize, persistStorage, state } from './state.js';
import { templates } from './templates.js';
import { render } from './ui/render.js';
import './events.js';

// Read by the tests in tests/ to inspect state and totals. Not used by the app itself.
window.__qirsh = {
  get state() {
    return state;
  },
  APP_VERSION,
  payVec,
  backVec,
  txCostUSD,
  entryValueIn,
  sumIn,
  normalize,
  balances,
  budgetStatus,
  templates,
  range,
  fmt,
  parseAmt,
  combinedUSD,
  moveLink,
};

render();
// Check a saved Frata Plus code; the screen is drawn again once it's confirmed.
plusInfo();

// Show "What's new" once after an update.
setNewsList(unseenChanges());
if (newsList.length) {
  setForm({});
  openSheet('news');
}

// frata.cc/#terms opens Privacy & terms, so the page can be linked to (from Whish, for example).
if (location.hash === '#terms' && !newsList.length) {
  setForm({});
  openSheet('terms');
}

// Data brought from the old address waits for the person to confirm it.
checkMove();

persistStorage();
registerSW();
