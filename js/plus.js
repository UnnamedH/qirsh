/* Frata Plus: whether this copy is unlocked, from the code saved with the data (checked offline). */
import { UNLOCK_KEY } from './config.js';
import { checkCode } from './core/plus.js';
import { state } from './state.js';
import { render } from './ui/render.js';

const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || null;

/* Plus is only offered once there's a key to check codes with; until then its features are open. */
export const plusOffered = () => !!UNLOCK_KEY;

/* The last code checked and who it was made for (null if it isn't genuine). Checking is async, so the
   answer is kept: views ask for it while drawing. Data can change under us (a restored backup, the
   other open copy), so it's keyed on the code itself. */
let known = { code: '', info: null };
let pending = '';

/** Who this copy was unlocked for, or null while locked (or while the saved code is still being checked). */
export function plusInfo() {
  const code = (state.unlock && state.unlock.code) || '';
  if (!code) return null;
  if (code === known.code) return known.info;
  if (code !== pending) {
    pending = code;
    checkCode(code, UNLOCK_KEY, subtle()).then((info) => {
      known = { code, info };
      if (pending === code) pending = '';
      if (info) render();
    });
  }
  return null;
}

/** Whether the paid features are open: unlocked, or Plus not offered at all. */
export const hasPlus = () => !plusOffered() || !!plusInfo();

/**
 * Checks a typed code and, if it's genuine, saves it with the data. The caller commits.
 * @returns {Promise<{ name: string, date: string } | null>}
 */
export async function tryUnlock(typed) {
  const code = String(typed || '').replace(/\s+/g, '');
  const info = await checkCode(code, UNLOCK_KEY, subtle());
  if (!info) return null;
  known = { code, info };
  state.unlock = { code };
  return info;
}
