/* Installed-app (PWA) support: install tip and service worker registration. */

export const STANDALONE =
  (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

export const IOS =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const HINT_KEY = 'qirsh.installHint';

export function showInstallHint() {
  if (!IOS || STANDALONE) return false;
  try {
    return localStorage.getItem(HINT_KEY) !== 'dismissed';
  } catch (e) {
    return true;
  }
}

export function registerSW() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:')
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
