#!/usr/bin/env node
const { chromium } = require('playwright');

const url = process.env.FRONTEND_URL || 'https://solar-dashboard-rouge.vercel.app';
const screenshot = process.env.SCREENSHOT || 'auto-browser-smoke.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  const notFoundUrls = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => {
    if (res.status() === 404) {
      const u = res.url();
      notFoundUrls.push(u);
      if (!/openweathermap|tile\.openweathermap|demotiles\.maplibre/i.test(u)) {
        errors.push(`404: ${u}`);
      }
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('body', { timeout: 15000 });
  await page.waitForTimeout(5000);

  const bodyText = await page.locator('body').innerText({ timeout: 10000 });
  const hasBrand = /SolarVN|Control Center/i.test(bodyText);
  const hasStats = /Tổng Sites|Tổng công suất|Sản lượng hôm nay|Hiệu suất/i.test(bodyText);
  const hasSites = /Sites hoạt động|Vị trí Sites|Miền Bắc|Miền Trung|Miền Nam/i.test(bodyText);

  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();

  const meaningfulErrors = errors.filter((msg) => !/Failed to load resource: the server responded with a status of 404/.test(msg));
  const ok = hasBrand && hasStats && hasSites && meaningfulErrors.length === 0;
  const result = {
    ok,
    url,
    hasBrand,
    hasStats,
    hasSites,
    consoleErrors: meaningfulErrors.slice(0, 5),
    notFoundUrls: notFoundUrls.slice(0, 10),
    screenshot,
    checkedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message, checkedAt: new Date().toISOString() }, null, 2));
  process.exit(1);
});
