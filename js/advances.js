/* Frata's advances: the shared core in js/core/advances.js, bound to the app's saved data. */
import * as core from './core/advances.js';
import { state } from './state.js';

export const paybacksOf = (id) => core.paybacksOf(state, id);

export const advanceOf = (r) => core.advanceOf(state, r);

/** What an advance cost, how much came back and how much is left, each as USD at today's rate. */
export const owed = (a) => core.owed(state, a);

/** What was never paid back, in `cur` at the advance's own rate: the part kept as spending once closed. */
export const leftIn = (a, cur) => core.leftIn(state, a, cur);

export const fmtAdv = (a, usd) => core.fmtAdv(state, a, usd);
