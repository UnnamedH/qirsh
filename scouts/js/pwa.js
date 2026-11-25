/* Service worker registration for the installed app, and the "new version ready" signal. */

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
    window.dispatchEvent(new Event('scouts:update-ready'));
  });
  sw.register('sw.js')
    .then((reg) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}
