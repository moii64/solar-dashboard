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
  await page.waitForTimeout(2000);

  const before = await page.locator('body').innerText();
  const siteCount = await page.locator('.site-list-item').count();
  console.log('BEFORE_TEXT:', before.slice(0, 800));
  console.log('SITE_COUNT:', siteCount);

  if (siteCount > 0) {
    await page.locator('.site-list-item').first().click();
    await page.waitForTimeout(2500);
  }

  const after = await page.locator('body').innerText().catch(e => `ERR ${e.message}`);
  await page.screenshot({ path: 'debug-click-site.png', fullPage: false });
  console.log(JSON.stringify({
    afterText: after.slice(0, 1500),
    url: page.url(),
    logs: logs.slice(-30),
    errors,
  }, null, 2));

  await browser.close();
})();
