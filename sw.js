/*
 * Offline-first service worker.
 *
 * Every file the app needs is stored on the phone when this worker installs, and the app is always
 * opened from that stored copy, so it starts instantly with no connection or a very slow one.
 *
 * Updates: the browser checks this file for changes when the app opens. BUILD is a fingerprint of
 * every file in APP, so publishing any change produces a new BUILD; the new version is downloaded
 * in full in the background and only replaces the old one once every file has arrived. The page
 * then offers to reload. Run `npm run stamp` after changing app files; tests/precache.spec.js
 * fails if BUILD is out of date or a file is missing from APP.
 */
const BUILD = 'ce3ba3355525';
const CACHE = 'qirsh-' + BUILD;
const APP = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/advances.js',
  'js/backup.js',
  'js/changelog.js',
  'js/config.js',
  'js/events.js',
  'js/handoff.js',
  'js/icons.js',
  'js/ledger.js',
  'js/main.js',
  'js/money.js',
  'js/pwa.js',
  'js/report/monthly.js',
  'js/report/xlsx.js',
  'js/sample.js',
  'js/sheets/adjust.js',
  'js/sheets/budget.js',
  'js/sheets/demo.js',
  'js/sheets/entry.js',
  'js/sheets/news.js',
  'js/sheets/payback.js',
  'js/sheets/sheet.js',
  'js/state.js',
  'js/templates.js',
  'js/theme.js',
  'js/ui/amount.js',
  'js/ui/format.js',
  'js/ui/render.js',
  'js/ui/toast.js',
  'js/ui/ui-state.js',
  'js/util.js',
  'js/views/budgets.js',
  'js/views/history.js',
  'js/views/home.js',
  'js/views/settings.js',
  'fonts/geist-latin.woff2',
  'fonts/geist-latin-ext.woff2',
  'fonts/geist-mono-latin.woff2',
  'fonts/geist-mono-latin-ext.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so the new version gets the current files.
  // addAll is all or nothing: if any file fails, this version is not installed and the old one stays.
  // The half-filled cache is then removed so it doesn't take up space on the phone.
  const requests = APP.map((url) => new Request(url, { cache: 'reload' }));
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(requests))
      .then(
        () => self.skipWaiting(),
        (err) =>
          caches.delete(CACHE).then(() => {
            throw err;
          }),
      ),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Every page load is answered with the stored app page; everything else with its stored copy.
  // Only a file that is not stored (which should not happen) goes to the network.
  // The page is stored as './', not 'index.html': some hosts (Cloudflare) redirect index.html to the
  // folder, and a browser refuses a page load answered with a redirected response.
  const key = req.mode === 'navigate' ? './' : req;
  e.respondWith(
    caches
      .open(CACHE)
      .then((c) => c.match(key))
      .then((hit) => hit || fetch(req)),
  );
});
