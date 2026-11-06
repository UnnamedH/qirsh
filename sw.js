/*
 * Offline support.
 *
 * The app's own files are fetched from the network first, so a new release shows up on the next
 * launch with a connection; the cached copy is only used offline. Bump VERSION on each release so
 * the precache below is refreshed and old caches are deleted. tests/precache.spec.js fails if a
 * file is missing from APP.
 */
const VERSION = 'qirsh-v8';
const FONTS = 'qirsh-fonts';
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
  'js/icons.js',
  'js/ledger.js',
  'js/main.js',
  'js/money.js',
  'js/pwa.js',
  'js/report/monthly.js',
  'js/report/xlsx.js',
  'js/sample.js',
  'js/sheets/budget.js',
  'js/sheets/entry.js',
  'js/sheets/news.js',
  'js/sheets/payback.js',
  'js/sheets/sheet.js',
  'js/state.js',
  'js/templates.js',
  'js/theme.js',
  'js/ui/format.js',
  'js/ui/render.js',
  'js/ui/toast.js',
  'js/ui/ui-state.js',
  'js/util.js',
  'js/views/budgets.js',
  'js/views/history.js',
  'js/views/home.js',
  'js/views/settings.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so the precache gets the current files.
  const requests = APP.map((url) => new Request(url, { cache: 'reload' }));
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(requests))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: serve from cache, fetch once.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then((c) =>
        c.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok || res.type === 'opaque') c.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }
  if (url.origin !== location.origin) return;

  // Every page load is answered with the app's index.html.
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Only keep good responses, so an error page never replaces the offline copy.
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key)),
  );
});
