/* Short status message with optional Undo. */
import { $, esc } from '../util.js';

export let toastTimer = null,
  undoFn = null;

export function toast(msg, undo) {
  const el = $('#toast');
  undoFn = undo || null;
  el.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button data-act="undo">Undo</button>' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      el.hidden = true;
      undoFn = null;
    },
    undo ? 5000 : 2800,
  );
}

export function setUndoFn(value) {
  undoFn = value;
  return value;
}
