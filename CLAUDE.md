# Frata — project instructions

Phone-first USD/LL budget tracker. Installable PWA, served as-is from `main` by Cloudflare at frata.cc
(and, until everyone has moved, by GitHub Pages at the old `unnamedh.github.io/qirsh/` address).
README.md has the full feature list, privacy model and file layout; read it first.

## Tech stack

- Plain HTML, CSS and native ES modules. **No framework, no bundler, no build step.**
- All data in `localStorage` (`qirsh.v1`). No server, no network calls, no third-party assets.
- Dev tooling only: ESLint 9 (flat config), Prettier 3, Playwright, http-server. Node 20+.

## Commands

- Serve: `npm start` → http://127.0.0.1:8765 (must be http, not file://)
- Test: `npm test` (Playwright; local runs use Windows' Edge via `channel: 'msedge'`, CI uses Chromium).
  Cloud sessions: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` to use the pre-installed Chromium.
- Lint / format: `npm run lint`, `npm run format`, `npm run format:check`
- After changing any app file: `npm run stamp` (rewrites `BUILD` in `sw.js` and `scouts/sw.js`)
- Unit tests and types for the shared core: `npm run test:unit`, `npm run typecheck`

CI (`.github/workflows/ci.yml`) runs lint, format check and tests on every PR.

## Architecture

- `js/main.js` boots: `render()`, "What's new", service worker. It also exposes `window.__qirsh` for tests.
- `js/state.js` owns the single mutable `state`. Mutate it in place, then call `commit()` from
  `js/ui/render.js` (save + full re-render). `render()` alone re-draws without saving.
- `js/events.js` is the only place with DOM listeners: one delegated `click`/`input`/`change`/`keydown`
  handler each, switching on the element's `data-act` (plus `data-v`, `data-id`). New interactions = a
  `data-act` attribute in the HTML string + a `case` here.
- Views (`js/views/*.js`) and sheets (`js/sheets/*.js`) return/assign HTML strings built by concatenation.
  Bottom sheets are dispatched by `sheetKind` in `js/sheets/sheet.js`; the current form lives in `form`.
- Domain logic is UI-free: `money.js` (fmt/parse/convert), `ledger.js` (balances, totals, budgets),
  `advances.js` (paid-for-others + paybacks), `templates.js` (quick add), `report/` (xlsx + csv).
- A `storage` event listener syncs state between two open copies of the app.

## Frata Scouts (`scouts/`)

A second, separate PWA for a scout group's funds, in the same repo. Own `scouts/sw.js` (paths relative to its
folder, so it can list the shared `../js/` and `../css/` files), manifest, cache and storage key
(`frata-scouts.v1`, `app: 'frata-scouts'`). It reuses `js/core/*`, `js/util.js`, `js/icons.js`,
`js/ui/amount.js`, `js/ui/toast.js` and `css/styles.css`, but **never** imports Frata's `js/state.js` or its
wrappers (`js/money.js`, `ledger.js`, `accounts.js`, `advances.js`): they load the personal data.

- **`js/core/` is pure**: functions take the state (or rate) as an argument and never touch the DOM, storage or
  a global. Frata's top-level `money.js`/`ledger.js`/`accounts.js`/`advances.js` are thin wrappers that pass in
  `state`. Put new shared logic in `js/core/`, with a unit test in `unit/` and JSDoc types (`npm run typecheck`).
- The scouts main fund keeps the id `wallet` (shown as "Caisse") because the core defaults to that id.
- Each camp (event) has its own account (`accountId`, id `camp-<event id>`, made by `ensureCampAccount()` in
  `scouts/js/camps.js`). Its cotisation is a fee via `withCotisations()` in `js/core/events.js`; payments are
  income with the camp's id as `eventId` and `feeId`, into the camp's account.
- Receipt photos (`scouts/js/receipts.js`) are shrunk JPEG `data:` URLs in IndexedDB, not in the state; an entry only
  holds `receiptId`. Keep them `data:` URLs so the CSP needs no `blob:`. Backups carry them in a top-level
  `receipts` map (removed again by `normalize()`); photos nothing refers to are pruned after a day.
- New scouts file? Add it to `APP` in `scouts/sw.js`. `npm run stamp` stamps both service workers.
- Frata's `sw.js` ignores requests under `scouts/`, so Frata's worker never answers for the scouts app.
- Scouts tests are in `tests/scouts.spec.js`; the shared core's are in `unit/` (`npm run test:unit`).
- scouts.frata.cc is deployed by `wrangler.scouts.jsonc` (a second Cloudflare project) from the same files.

## Frata Plus

- Paid features (History → By category and Trends, budgets with several categories) check `hasPlus()` in
  `js/plus.js`. Trends' sums are `js/core/trends.js` (pure, with `unit/trends.test.js`): the month still going on is
  "partial" and left out of the average, and is compared with the same days of last month.
  The unlock code is in `state.unlock.code`, checked offline against `UNLOCK_KEY` in `js/config.js` by
  `js/core/plus.js` (ECDSA P-256). `UNLOCK_KEY = null` means Plus isn't offered and everything is open.
- Never commit a private key (`*.private.jwk` is ignored). Codes are made with `scripts/unlock-codes.mjs`.
- Tests use the key in `tests/fixtures/plus-test-key.json`: `tests/server.mjs` swaps its public half into
  `js/config.js`, and `plusCode()` / `unlockPlus()` in `tests/helpers.js` sign and type a code.
- Starting over and clearing the examples keep `unlock`. No pop-ups asking for money: Plus is offered only
  where a locked feature is, and in Settings.

## Data model rules

- Currencies are `'USD'` and `'LBP'` internally; the UI says "LL". Conversion uses `state.rate`.
- Accounts live in `state.accounts` (`js/accounts.js`): the main one has the id `wallet` (renamable, never
  removed); others can be added, renamed, marked `savings` or removed. A removed account that has entries
  is only `hidden`, so History keeps its name. Pick accounts with `accounts()` / `pickable()`, never a
  fixed list, and escape account names: people type them.
- LL is **typed in thousands** ("385" = 385,000 LL). Every amount field goes through `parseInput()` /
  `toInput()` in `money.js` and is drawn with `amountField()` / `thousandsInput()` from `js/ui/amount.js`,
  which add the fixed ",000". Only the exchange-rate fields are typed literally.
- An expense's value is `entryValueIn()` / `txCostUSD()` in `money.js`, never raw `amount`: price-first
  expenses store what was paid (`amount`, `amount2`, `back`), the price currency (`priceCur`) and the
  shop's `rate`, so the price is exact and doesn't drift when the app's rate changes.
- **Every entry keeps the `rate` of the day it was saved** (all types except `transfer`, which stores both
  amounts). Totals add `entryValueIn(t, cur)` per entry with `sumIn()` in `ledger.js`, in the currency
  shown, so past months and budgets don't move when the app's rate changes. Converting a total at
  `state.rate` (`fmtDisp`) is only for what you hold now: balances and what is still owed.
- Transaction `type`: `expense`, `income`, `transfer` (exchange = transfer with `from === to`),
  `advance` (paid for someone, not spending), `repay` (payback, linked by `advanceId`, not income) and
  `adjust` (balance-only correction: signed `amount`, `target`). Counted corrections are ordinary
  expense/income entries with `correction: true`.
- Any new persisted field **must** be handled in `normalize()` in `state.js`: data comes from old
  versions and imported backups, so validate and default everything. Never throw on bad data.

## Code style

- Prettier: 2 spaces, single quotes, 110-char lines, LF. kebab-case file names, camelCase identifiers.
- Escape every user-provided string with `esc()` from `util.js` before putting it in HTML.
- Module-level `let` exports are changed through `setX()` helpers (importers can't reassign bindings).
- Wrap `localStorage` access in try/catch (private mode / full storage); empty catches are allowed.
- Each file starts with a one-line `/* ... */` comment saying what it is for. Comments explain _why_.
- User-facing text is plain, friendly English with British spelling ("colour", "Uncategorised").

## Hard constraints

- **CSP** in `index.html`: no inline scripts, nothing from other origins (fonts are in `fonts/`).
  `tests/privacy.spec.js` enforces this. Inline `style=` is allowed.
- **New app file?** Add it to the `APP` list in `sw.js`, then `npm run stamp`.
  `tests/precache.spec.js` fails if a file is missing from `APP` or `BUILD` is stale.
- **No `theme_color` in Frata's manifests, on purpose.** Chrome colours an installed Android app's gesture bar
  with it, there is no dark version, so a light one leaves a light strip under a dark app. Without it,
  Android follows the phone's light or dark mode. The page's `<meta name="theme-color">` tags still colour
  the status bar. Don't add it back.
- **App icons** come from `scripts/icon.svg` via `npm run icons`, which also writes `icons/<colour>/` and
  `manifest-<colour>.webmanifest` for each preset accent. Rerun it after changing the icon, the presets or
  `manifest.webmanifest`; `tests/precache.spec.js` checks the copies match.
- **frata.cc** is deployed by Cloudflare from `main` (`wrangler.jsonc`, no build step). Only the paths
  let back in by `.assetsignore` are published; a new top-level app file or folder must be added there.
- **New feature or substantial bug fix?** Add an entry at the top of `CHANGELOG` in `js/changelog.js`
  (next `v`, today's date, short plain bullets). It pops up as "What's new" for everyone after the update,
  so leave out small or hidden fixes, tips and notes that already explain themselves, and layout tweaks.

## Testing

- Specs in `tests/*.spec.js`, grouped by feature. Import `test`, `expect`, `openApp`, `appState` from
  `tests/helpers.js`: its `test` fails on any uncaught page error, and `openApp` seeds localStorage and
  suppresses "What's new".
- Drive the UI by `data-act` selectors (`[data-act=fsave]`) and inspect via `window.__qirsh`.
- Devices emulate a Pixel 7. `tests/server.mjs` can simulate slow networks and fake releases under
  `/t/<id>/` for offline/update tests.

## Git workflow

- Branch from `main` as `feature/<name>`, `fix/<name>` or `refactor/<name>`; open a PR; merge when CI passes.
- Commit subjects: imperative, sentence case, plain English, no prefixes
  (e.g. "Track money paid for others and paybacks").
- Preview a branch on a phone: `https://raw.githack.com/UnnamedH/qirsh/<branch>/index.html`.
