/* Entry point. */
import { balances, combinedUSD, range, sumIn } from '../../js/core/ledger.js';
import { entryValueIn, fmt, parseAmt } from '../../js/core/money.js';
import { registerSW } from './pwa.js';
import { normalize, parseState, persistStorage, state } from './state.js';
import { render } from './ui/render.js';
import './events.js';

// Read by the tests in tests/ to inspect state and totals. Not used by the app itself.
window.__scouts = {
  get state() {
    return state;
  },
  normalize,
  parseState,
  balances: () => balances(state),
  sumIn: (...a) => sumIn(state, ...a),
  range: (p, ref) => range(p, ref, state.settings.weekStart),
  combinedUSD: (x) => combinedUSD(x, state.rate),
  entryValueIn: (t, cur) => entryValueIn(t, cur, state.rate),
  fmt,
  parseAmt,
};

render();
persistStorage();
registerSW();
