# Frata

A small, phone-first budget tracker for living with two currencies: US dollars and Lebanese lira (LL).

Frata (فراطة) is Lebanese for small change. The app used to be called Qirsh: the repository and the keys its data is saved under still use that name, because changing the keys would leave people's saved data behind.

Live at **https://frata.cc/**, and at the old address, https://unnamedh.github.io/qirsh/, until everyone has moved their data across. It can be installed to the home screen on iPhone and Android, and it always opens from the phone, with or without a connection.

Plain HTML, CSS and JavaScript modules: no framework and no build step. The host serves the files as they are.

## Features

- Accounts that are yours to name: Wallet, Savings and Whish to start with, then add, rename or remove them. Each holds both USD and LL; spend from or earn into any of them, and tap one on Home to see its own entries
- Hide amounts on Home with one tap, for showing the app to someone
- Swipe sideways between tabs, and pull a sheet down to close it
- Frata Plus, a one-off purchase (Settings → Frata Plus), adds:
  - a month's spending by category as a ring chart (History → By category)
  - recurring entries (Settings → Recurring): rent, a salary or a subscription, weekly or monthly. When one is due it shows on Home to add or skip with a tap, or to edit first for a bill that came to a different amount. Nothing is added by itself.
  - trends: spending month by month for 6 or 12 months, for all spending or one category, how this month compares with the same days of last month, and the categories that changed most (History → Trends)
  - budgets that cover several categories at once (without it, a budget covers all spending or one category)
- Fold any section on Home down to a glimpse: budgets as little rings, the month as three numbers
- A "Buy me a coffee" link to support Frata through Whish, from the heart at the top or Settings → Support Frata
- Feedback and bug reports from the button at the top (or Settings), by email, with the version, phone, screen size and tab filled in
- Expenses entered as what you paid and the change you got back, or, if you turn it on, price first: say what you paid with and the change, or the rest paid on top, is worked out
- LL typed in thousands everywhere (type 385 for 385,000 LL)
- Transfers between accounts and exchanges between $ and LL at a rate you set
- Money paid on someone else's behalf, with paybacks, kept out of budgets
- Weekly and monthly budgets, overall or per category
- Quick add for repeat entries, history by month with search and filters
- A monthly report as an Excel file (summary, spending by category, savings, owed, budgets, every entry), and a CSV of the month's entries
- Accent colours and a light/dark theme, a "What's new" note after each update
- Editable categories with emoji, JSON backup export and import

## Privacy

- **All data stays on the phone**, in the browser's `localStorage`. There is no account, no server, no analytics and no tracking. Nothing the user enters is ever sent anywhere, so neither the developer nor GitHub can see it.
- **The app loads nothing from other websites.** Fonts are in `fonts/`, and a Content Security Policy in `index.html` makes the browser block scripts, fonts and requests to any other site. `tests/privacy.spec.js` checks both.
- **Data isn't encrypted on the device.** Anyone who can unlock the phone and open the app can see it. Clearing the browser's data or removing the app deletes it, which is what backups are for.
- **The code is what users trust.** Cloudflare and GitHub Pages serve whatever is on `main`, so keep two-factor authentication on for the GitHub account and protect `main` so changes go through pull requests.

## Offline

The service worker (`sw.js`) stores every file on install, and the app always opens from that copy. A new version downloads in full in the background and only replaces the old one once every file has arrived; then the app offers to reload. The very first visit needs a connection.

## Install on a phone

- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome or Samsung Internet):** tap **Install app** when prompted, or use the browser menu → **Add to Home screen**.

On iPhone, Safari and the installed app keep separate data. Install first, or move your data across with Settings → Backup.

## Development

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
npm start
```

Then open http://127.0.0.1:8765. The app has to be served over `http://`: browsers don't load JavaScript modules or service workers from `file://`. The first launch shows example data; tap **Start fresh** to clear it.

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm start`            | Serves the app locally at http://127.0.0.1:8765           |
| `npm run stamp`        | Updates `BUILD` in both `sw.js` files after app changes   |
| `npm run icons`        | Makes the PNG icons in `icons/` from `scripts/icon.svg`   |
| `npm test`             | Runs the browser tests in `tests/` (Playwright)           |
| `npm run test:unit`    | Runs the unit tests in `unit/` (no browser needed)        |
| `npm run typecheck`    | Checks the types of the shared core in `js/core/` (tsc)   |
| `npm run lint`         | Checks the code for mistakes (ESLint)                     |
| `npm run format`       | Reformats every file (Prettier)                           |
| `npm run format:check` | Reports files that need formatting, without changing them |

Locally the tests use the Microsoft Edge that comes with Windows. On GitHub they use Chromium. Every pull request runs lint, the format check and the tests (`.github/workflows/ci.yml`).

## Project layout

```
index.html              Page skeleton: header, the four views, tab bar, sheet and toast containers
css/styles.css          All styles; colours are CSS variables, with a dark set
fonts/                  Geist and Geist Mono (SIL Open Font License)
js/main.js              Entry point: first render, "What's new", service worker
js/events.js            Every tap, input and keypress, dispatched on the element's data-act
js/state.js             The saved state: default shape, loading, saving, repairing old data
js/sample.js            Example data for the first launch
js/config.js            The accounts and categories a new user starts with
js/core/                The money logic as pure functions that take the state as an argument, shared with the scouts app
js/accounts.js          Frata's accounts, bound to its saved state (wrapper around js/core/accounts.js)
js/money.js             Frata's money helpers, bound to its rate and settings (wrapper around js/core/money.js)
js/ledger.js            Frata's balances, totals and budget progress (wrapper around js/core/ledger.js)
js/advances.js          Money paid for others and its paybacks (wrapper around js/core/advances.js)
js/templates.js         Quick add (frequent and recent entries)
js/theme.js             Accent colour palette and light/dark theme
js/changelog.js         Release notes for "What's new"
js/backup.js            Export and import, saving generated files
js/feedback.js          The email feedback link (js/sheets/feedback.js shows it)
js/handoff.js           Moving data to frata.cc in a link, and reading it on arrival
js/report/              Monthly report: the data (monthly.js) and a small .xlsx writer (xlsx.js)
js/pwa.js               Install tip and service worker registration
js/util.js, icons.js    Small helpers and SVG icons
js/ui/                  Rendering the current view, shared row/budget HTML, toast, UI state, swipes
js/views/               Home, History, Budgets and Settings
js/sheets/              Bottom sheets: entry, payback, budget, "What's new"
sw.js                   Service worker: offline-first, all-or-nothing updates
scouts/                 Frata Scouts, a separate installable app for a scout group's funds (see below)
scouts-worker.js        Tiny Worker for scouts.frata.cc: sends its front page to /scouts/
wrangler.scouts.jsonc   Cloudflare deploy for scouts.frata.cc
unit/                   Unit tests for js/core/ and the scouts data (`npm run test:unit`)
wrangler.jsonc          Cloudflare deploy for frata.cc; .assetsignore lists the files it publishes
manifest.webmanifest    Name, colours and icons for installing (manifest-<colour> copies for each preset colour)
icons/                  App, maskable, Apple touch and favicon icons; icons/<colour>/ for each preset colour
scripts/                `npm run stamp` and the BUILD fingerprint; `npm run icons` and the icon's source, icon.svg
tests/                  Playwright tests, and server.mjs, a test server that can be slow or publish a fake release
```

## Frata Scouts

`scouts/` is a second app for tracking a scout group's money: funds (cash box, bank), expenses, income, moves and exchanges in USD and LL, camps (Camp HP, Noël, Pâques, été…), each with its own account, budget, attendees and cotisation: who has paid, who has paid part and who still owes, recorded with one tap. Finishing a camp moves what is left in its account back to the caisse. Home has a tab for the caisse (entries outside every camp) and one for each open camp. Expenses and income can carry a receipt photo (camera or gallery), shrunk to a few hundred KB and kept on the phone in IndexedDB, apart from the entries; backups include the photos. Every section (totals, attending, budget, where the money went, entries, settings…) folds down to its heading and a one-line summary, and stays as you left it. The unité's name is set once in Settings; the screens are in English with the unité's own words (unité, cotisation, caisse). It is installed and updated on its own (its own `scouts/sw.js`, manifest and cache) and keeps its data under its own key, `frata-scouts.v1`, so it never touches the personal app's data. It shares the money logic in `js/core/`, the styles, the fonts and a few UI helpers with Frata, and follows the same rules: no framework, no build step, no network calls.

Open it at `/scouts/` (`npm start`, then http://127.0.0.1:8765/scouts/). Leader reimbursements, a spreadsheet export and Google Sheets sync are planned next.

## Publishing updates

The site is served from `main` by Cloudflare at https://frata.cc/ and by GitHub Pages at the old address. Cloudflare also builds a preview of every pull request. Work on a branch, open a pull request, and merge it when CI passes. To try a branch on a phone before merging, open `https://raw.githack.com/UnnamedH/qirsh/<branch>/index.html`.

For each release that users will notice:

1. Add an entry at the top of `CHANGELOG` in `js/changelog.js` with the next version number and a short, plain list of what changed. People see it in a "What's new" sheet after they reload into the new version.
2. Run `npm run stamp` before committing. It writes a fingerprint of all the app's files into `BUILD` in `sw.js`, which is how phones notice there's something new.

If you add a new file, also add it to the `APP` list in `sw.js`. `npm test` fails if a file is missing from the list or if `BUILD` is out of date, so CI catches both.

## Frata Plus unlock codes

Plus is unlocked with a code, checked on the phone with no server: each code is signed with a private key
that only the maker keeps, and the app carries just the public key (`UNLOCK_KEY` in `js/config.js`), which
can check a code but not make one. While `UNLOCK_KEY` is `null`, Plus isn't offered and its features are open.

```bash
npm run plus:setup
```

Run once, on your own computer: it saves the private key in `~/frata-keys` (outside the repo), puts the public
key in `UNLOCK_KEY`, stamps the service workers and checks a test code. Run again, it reuses the same key.
Then for each buyer:

```bash
node scripts/unlock-codes.mjs code ~/frata-keys/frata-plus.private.jwk "Buyer's name"
```

The code is kept with the person's data, so backups and moving phones keep Plus. As the app's code is public,
this keeps honest people honest: a code can be shared, but not forged.
