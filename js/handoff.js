/* Moving data from the old address to Frata: a link that carries the data, and reading it on arrival. */
import { parseState } from './state.js';
import { render } from './ui/render.js';
import { setPendingMove } from './ui/ui-state.js';

/* Where the app lives from now on. The old address sends people here with their data. */
export const FRATA_URL = 'https://frata.cc/';

/* The data travels in the part of the link after `#`, which browsers never send to any server, so it
   goes straight from one copy of the app to the other on the same phone. */
const PREFIX = '#move=';

/* Browsers handle links of a few megabytes, but some cut them shorter. Past this, a backup file is
   the safer way to move. */
export const MAX_LINK = 1500000;

const toB64url = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64url = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const through = (bytes, stream) => new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();

/**
 * Builds the link that opens Frata with this data, or returns null when it is too long for a link.
 * The text is gzipped where the browser can (`z.`), and sent as it is otherwise (`t.`).
 */
export async function moveLink(data, base = FRATA_URL) {
  const raw = new TextEncoder().encode(JSON.stringify(data));
  let payload;
  try {
    payload = 'z.' + toB64url(new Uint8Array(await through(raw, new CompressionStream('gzip'))));
  } catch (e) {
    payload = 't.' + toB64url(raw);
  }
  const link = base + PREFIX + payload;
  return link.length > MAX_LINK ? null : link;
}

/**
 * Reads data brought by a move link, if the app was opened with one. The link is taken out of the
 * address straight away, so reloading or sharing the page doesn't carry the data along.
 * Resolves to the data, or to null when there is none; `{ error: true }` when it can't be read.
 */
export async function readMove() {
  const hash = location.hash;
  if (!hash.startsWith(PREFIX)) return null;
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {}
  try {
    const payload = hash.slice(PREFIX.length);
    const bytes = fromB64url(payload.slice(2));
    let text;
    if (payload.startsWith('z.'))
      text = new TextDecoder().decode(await through(bytes, new DecompressionStream('gzip')));
    else if (payload.startsWith('t.')) text = new TextDecoder().decode(bytes);
    else return { error: true };
    return parseState(text) || { error: true };
  } catch (e) {
    return { error: true };
  }
}

/* Shows the banner asking to use the data, when the app was opened with a move link. Runs at start and
   again when a link changes only the `#` part of an address that is already open. */
export function checkMove() {
  return readMove().then((m) => {
    if (!m) return;
    setPendingMove(m);
    render();
  });
}

/* ---------- the old address ---------- */

const SNOOZE_KEY = 'qirsh.moveSnooze';

/* The old GitHub Pages address, which keeps working until everyone has moved. Tests set
   `window.__frataOldAddress` to stand in for it. */
export const onOldAddress = () =>
  window.__frataOldAddress === true || /\.github\.io$/.test(location.hostname);

/** True when the banner asking to move should show: on the old address, unless put off for today. */
export function moveDue(now = Date.now()) {
  if (!onOldAddress()) return false;
  try {
    return !(+localStorage.getItem(SNOOZE_KEY) > now);
  } catch (e) {
    return true;
  }
}

/** "Later": asks again tomorrow. */
export function snoozeMove(now = Date.now()) {
  try {
    localStorage.setItem(SNOOZE_KEY, String(now + 864e5));
  } catch (e) {}
}
