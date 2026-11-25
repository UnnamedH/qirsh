/* Installed-app (PWA) support: the iPhone Home Screen note and service worker registration. */
import { isSampleTx } from './sample.js';
import { state } from './state.js';

export const STANDALONE =
  (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

export const IOS =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* iPhone, Safari tab: Safari can clear a website's saved data after about a week without a visit, and the
   Home Screen app keeps its own separate data. So people are asked to add Frata to the Home Screen before
   they start, and once they have entries of their own, how to bring them along. Dismissing the first
   note brings back the second when there are entries; dismissing that one is for good. */
export const SAFARI_TIP_KEY = 'qirsh.safariTip';

/** Which note to show on Home: 'start' (no entries yet), 'move' (entries to bring along) or null. */
export function safariTip() {
  if (!IOS || STANDALONE) return null;
  const own = state.tx.some((t) => !isSampleTx(t));
  let seen = null;
  try {
    seen = localStorage.getItem(SAFARI_TIP_KEY);
  } catch (e) {
    return null;
  }
  if (seen === 'move') return null;
  if (own) return 'move';
  return seen === 'start' ? null : 'start';
}

export function dismissSafariTip(kind) {
  try {
    localStorage.setItem(SAFARI_TIP_KEY, kind);
  } catch (e) {}
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
