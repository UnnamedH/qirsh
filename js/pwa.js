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

/* True once a new version has been downloaded and is ready after a reload. */
export let updateReady = false;

export function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const sw = navigator.serviceWorker;
  // A controller already running means this is an update, not the first install.
  const hadController = !!sw.controller;
  sw.addEventListener('controllerchange', () => {
    if (!hadController || updateReady) return;
    updateReady = true;
    window.dispatchEvent(new Event('qirsh:update-ready'));
  });
  sw.register('sw.js')
    .then((reg) => {
      // An installed app can stay open for days; look for a new version whenever it comes back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}
