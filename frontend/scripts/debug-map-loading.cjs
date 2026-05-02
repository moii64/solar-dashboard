const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const logs = [];
  const errors = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => errors.push(err.stack || err.message));

  await page.goto('https://solar-dashboard-rouge.vercel.app', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('[class*="dc-stat-card"]', { timeout: 60000 });
  await page.waitForTimeout(5000); // Wait for potential re-renders

  const bodyText = await page.locator('body').innerText();
  await page.screenshot({ path: 'debug-map-loading.png', fullPage: false });

  console.log(JSON.stringify({
    url: page.url(),
    title: await page.title(),
    bodyText: bodyText.slice(0, 1500),
    logs: logs.slice(-50),
    errors,
  }, null, 2));

  await browser.close();
})();
