# Qirsh

A small, phone-first budget tracker for living with two currencies: US dollars and Lebanese lira (LL).

It's a single `index.html` with no build step and no dependencies. Data is stored only on the device, in the browser's `localStorage`. It can be installed to the home screen on iPhone and Android and works offline.

## Features

- Wallet, Savings and Whish accounts, each holding both USD and LL
- Expenses and income paid in one or both currencies, including change you get back
- Transfers between accounts and exchanges between $ and LL at a rate you set
- Weekly and monthly budgets, overall or per category
- Quick add for repeat entries, history by month with search and filters
- Editable categories with emoji, JSON backup export and import

## Install on a phone

- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome):** tap **Install app** when prompted, or use the ⋮ menu → **Add to Home screen**.

On iPhone, Safari and the installed app keep separate data. Install first, or move your data across with Settings → Backup.

## Run it locally

Serve the folder (the service worker needs `http://`, not `file://`):

```bash
npx serve .
```

The first launch shows example data; tap **Start fresh** to clear it.

## Publishing updates

The site is served by GitHub Pages from `main`. For each release:

1. Add an entry at the top of `CHANGELOG` in `index.html` with the next version number and a short, plain list of what changed. People see it in a "What's new" sheet the first time they open the updated app.
2. Bump `VERSION` in `sw.js` (for example `qirsh-v5`) so installed copies download the new version.

## Files

- `index.html`: the whole app
- `manifest.webmanifest`: name, colours and icons for installing
- `sw.js`: service worker for offline use
- `icons/`: app, maskable, Apple touch and favicon icons
