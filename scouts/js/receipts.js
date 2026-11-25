/* Receipt photos. They are shrunk, then kept in the browser's IndexedDB, apart from the entries: photos are
   far too big for localStorage. Entries only hold a receipt's id (`receiptId`). Photos are kept and shown as
   data: URLs, so the page's Content Security Policy needs no new source. */
import { uid } from '../../js/util.js';

const DB = 'frata-scouts-receipts',
  STORE = 'receipts';

/* A photo is shrunk until it is under this size: about what a phone's reading of a till receipt needs. */
export const TARGET_BYTES = 250 * 1024;
const STEPS = [
  [1600, 0.72],
  [1400, 0.6],
  [1200, 0.5],
  [1000, 0.45],
];
/* A receipt nothing refers to is only deleted once it is this old, so Undo and a half-filled form are safe. */
export const KEEP_UNUSED_MS = 864e5;

/** The size a picture fits in, keeping its shape, never enlarged. */
export function fitWithin(width, height, max) {
  const k = Math.min(1, max / Math.max(width, height, 1));
  return { w: Math.max(1, Math.round(width * k)), h: Math.max(1, Math.round(height * k)) };
}

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** True for a picture as a data: URL, the only form receipts are kept and restored in. */
export const isImageUrl = (v) => typeof v === 'string' && v.length < 8e6 && DATA_URL.test(v);

/** The ids of the receipts that entries refer to. */
export const usedIds = (state) => new Set(state.tx.map((t) => t.receiptId).filter(Boolean));

/** The receipts a backup holds: only pictures that an entry refers to, so nothing else rides along. */
export function receiptsFromBackup(raw, state) {
  const out = {},
    used = usedIds(state),
    src =
      raw && typeof raw === 'object' && raw.receipts && typeof raw.receipts === 'object' ? raw.receipts : {};
  for (const id of used) if (isImageUrl(src[id])) out[id] = src[id];
  return out;
}

/* ---------- the store ---------- */

let dbPromise = null;

function open() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('blocked'));
      } catch (e) {
        reject(e);
      }
    });
  return dbPromise;
}

const run = (mode, fn) =>
  open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode),
          out = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );

/* The photos shown so far, so forms and pages can draw them without waiting. */
const cache = new Map();

/** Whether this browser can keep receipts (not in a private window that blocks IndexedDB, for example). */
export let available = false;

export async function init() {
  try {
    await open();
    available = true;
  } catch (e) {
    available = false;
  }
  return available;
}

/** A receipt's picture if it has been loaded already. */
export const cached = (id) => cache.get(id) || '';

/** Loads a receipt's picture into the cache, and returns it ('' when there is none). */
export async function load(id) {
  if (!id) return '';
  if (cache.has(id)) return cache.get(id);
  try {
    const rec = await run('readonly', (s) => s.get(id));
    if (rec && isImageUrl(rec.data)) cache.set(id, rec.data);
    return cache.get(id) || '';
  } catch (e) {
    return '';
  }
}

/** Keeps a picture and returns its new id. Throws when the browser won't store it. */
export async function add(dataUrl) {
  const id = 'r' + uid();
  await run('readwrite', (s) => s.put({ id, data: dataUrl, createdAt: Date.now() }));
  cache.set(id, dataUrl);
  return id;
}

/** Every receipt, as { id: dataUrl }, for a backup. */
export async function all() {
  const recs = await run('readonly', (s) => s.getAll());
  const out = {};
  for (const r of recs || []) if (isImageUrl(r.data)) out[r.id] = r.data;
  return out;
}

/** Replaces every receipt with the ones given, as when a backup is restored. */
export async function replaceAll(map) {
  await run('readwrite', (s) => {
    s.clear();
    for (const [id, data] of Object.entries(map)) s.put({ id, data, createdAt: Date.now() });
  });
  cache.clear();
  for (const [id, data] of Object.entries(map)) cache.set(id, data);
}

/** Deletes receipts that no entry refers to and that are over a day old. Quiet if anything goes wrong. */
export async function prune(state, now = Date.now()) {
  try {
    const used = usedIds(state);
    const recs = await run('readonly', (s) => s.getAll());
    const gone = (recs || []).filter((r) => !used.has(r.id) && now - (+r.createdAt || 0) > KEEP_UNUSED_MS);
    if (!gone.length) return 0;
    await run('readwrite', (s) => gone.forEach((r) => s.delete(r.id)));
    gone.forEach((r) => cache.delete(r.id));
    return gone.length;
  } catch (e) {
    return 0;
  }
}

/* ---------- shrinking a photo ---------- */

const blobToUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Shrinks a picked photo to a JPEG data: URL under TARGET_BYTES where it can, trying smaller and softer
 * each time. A photo from a phone's camera is 3 to 8 MB; this brings it to a few hundred KB.
 */
export async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    let best = null;
    for (const [max, quality] of STEPS) {
      const { w, h } = fitWithin(bmp.width, bmp.height, max);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      // A picture with see-through parts (a screenshot) would turn black as a JPEG without this.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) continue;
      best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }
    if (!best) throw new Error('Could not read that picture.');
    return await blobToUrl(best);
  } finally {
    if (bmp.close) bmp.close();
  }
}
