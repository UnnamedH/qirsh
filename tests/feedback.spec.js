/* Settings → Feedback & bugs: WhatsApp and email links with the version and phone, and nothing else. */
import { test, expect, openApp } from './helpers.js';

test('the feedback links open WhatsApp and email with the version and phone filled in', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  const version = await page.evaluate(() => window.__qirsh.APP_VERSION);
  const size = await page.evaluate(() => innerWidth + '×' + innerHeight);
  const intro = `Frata feedback (version ${version}, Android, Chrome, ${size}, on Settings):\n\n`;

  const wa = new URL(await page.locator('#feedbackSec a', { hasText: 'WhatsApp' }).getAttribute('href'));
  expect(wa.origin + wa.pathname).toBe('https://wa.me/96181457620');
  expect(wa.searchParams.get('text')).toBe(intro);

  const mail = await page.locator('#feedbackSec a', { hasText: 'Email' }).getAttribute('href');
  expect(mail.startsWith('mailto:support@frata.cc?')).toBe(true);
  const q = new URLSearchParams(mail.split('?')[1]);
  expect(q.get('subject')).toBe('Frata feedback');
  expect(q.get('body')).toBe(intro);
});

test('the phone is described from the browser, never from the person’s data', async ({ page }) => {
  await openApp(page);
  const labels = await page.evaluate(async () => {
    const { deviceLabel } = await import('/js/feedback.js');
    return [
      deviceLabel('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'),
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
      ),
      deviceLabel('Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'),
    ];
  });
  expect(labels).toEqual(['Android, Chrome', 'Android, Samsung Internet', 'computer, Firefox']);
});

test('a one-time note on Home says feedback can be sent', async ({ page }) => {
  await openApp(page, { showTips: true });
  const tip = page.locator('#alerts .banner', { hasText: 'report bugs' });
  // Not over the example data, and not next to the price-first tip.
  await expect(tip).toHaveCount(0);
  await page.click('[data-act=clearSample]');
  await expect(
    page.locator('[data-act=showDemo], .banner', { hasText: 'type the price' }).first(),
  ).toBeVisible();
  await expect(tip).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('qirsh.tipPriceFirst', 'done'));
  await page.click('.tabs [data-act=nav][data-v=history]');
  await page.click('.tabs [data-act=nav][data-v=home]');
  await expect(tip).toBeVisible();
  // Only on Home.
  await page.click('.tabs [data-act=nav][data-v=history]');
  await expect(tip).toHaveCount(0);
  await page.click('.tabs [data-act=nav][data-v=home]');

  // "Send feedback" opens the feedback sheet, and the note doesn't come back.
  await tip.locator('[data-act=feedbackOpen]').click();
  await expect(page.locator('#sheet h2')).toHaveText('Feedback & bugs');
  await page.click('#sheet [data-act=close]');
  await expect(tip).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(tip).toHaveCount(0);
});

test('"Got it" puts the feedback note away for good', async ({ page }) => {
  await openApp(page, { showTips: true, storage: { 'qirsh.tipPriceFirst': 'done' } });
  await page.click('[data-act=clearSample]');
  await page.click('[data-act=feedbackTipDone]');
  await expect(page.locator('#alerts .banner', { hasText: 'report bugs' })).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__qirsh);
  await expect(page.locator('#alerts .banner', { hasText: 'report bugs' })).toHaveCount(0);
});

test('the button at the top opens Feedback & bugs from any tab, saying which tab', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=budgets]');
  await page.click('.top [data-act=feedbackOpen]');
  await expect(page.locator('#sheet h2')).toHaveText('Feedback & bugs');
  const wa = new URL(await page.locator('#sheet a', { hasText: 'WhatsApp' }).getAttribute('href'));
  expect(wa.searchParams.get('text')).toMatch(/, \d+×\d+, on Budgets\):\n\n$/);
  await expect(page.locator('#sheet a', { hasText: 'Email' })).toHaveAttribute(
    'href',
    /^mailto:support@frata\.cc\?/,
  );
});

test('Support Frata opens the maker’s Whish payment link', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  const titles = await page.locator('#v-settings .sec > h2').allInnerTexts();
  expect(titles.indexOf('Support Frata')).toBe(titles.indexOf('Feedback & bugs') + 1);
  const link = page.locator('#supportSec a', { hasText: 'Buy me a coffee' });
  await expect(link).toHaveAttribute('href', 'https://whish.money/app/pay/ynLO2j39h');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
});
