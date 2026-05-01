const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const logs = [];
  const errors = [];

  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => errors.push(err.message));
  page.on('requestfailed', req => errors.push(`request failed ${req.url()} ${req.failure()?.errorText}`));

  await page.goto('https://solar-dashboard-rouge.vercel.app', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(8000);

  const html = await page.content();
  const body = await page.locator('body').innerText().catch(e => 'ERR:' + e.message);
  await page.screenshot({ path: 'debug-production-page.png' });

  console.log(JSON.stringify({
    url: page.url(),
    title: await page.title(),
    bodyText: body.slice(0, 1000),
    htmlLength: html.length,
    logs: logs.slice(-20),
    errors,
  }, null, 2));

  await browser.close();
})();
