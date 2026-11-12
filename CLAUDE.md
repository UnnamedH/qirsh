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
- After changing any app file: `npm run stamp` (rewrites `BUILD` in `sw.js`)

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

## Data model rules

- Currencies are `'USD'` and `'LBP'` internally; the UI says "LL". Conversion uses `state.rate`.
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
- **frata.cc** is deployed by Cloudflare from `main` (`wrangler.jsonc`, no build step). Only the paths
  let back in by `.assetsignore` are published; a new top-level app file or folder must be added there.
- **User-visible change?** Add an entry at the top of `CHANGELOG` in `js/changelog.js` (next `v`, today's
  date, short plain bullets). It shows in the "What's new" sheet.

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
