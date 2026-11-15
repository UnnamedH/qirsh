/* Settings → Feedback & bugs: WhatsApp and email links with the version and phone, and nothing else. */
import { test, expect, openApp } from './helpers.js';

test('the feedback links open WhatsApp and email with the version and phone filled in', async ({ page }) => {
  await openApp(page);
  await page.click('.tabs [data-act=nav][data-v=settings]');
  const version = await page.evaluate(() => window.__qirsh.APP_VERSION);
  const intro = `Frata feedback (version ${version}, Android, Chrome):\n\n`;

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
