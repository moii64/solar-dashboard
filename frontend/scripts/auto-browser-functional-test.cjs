#!/usr/bin/env node
const { chromium } = require('playwright');

const url = process.env.FRONTEND_URL || 'https://solar-dashboard-rouge.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const results = [];

  try {
    // 1. Navigate and wait for load
    console.log('1. Navigating to dashboard...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    console.log('Wait for loader to disappear...');
    await page.waitForSelector('text=Đang tải dữ liệu...', { state: 'hidden', timeout: 60000 }).catch(() => console.log('Loader not found or already gone'));
    
    console.log('Wait for stat cards...');
    await page.waitForSelector('[class*="dc-stat-card"]', { timeout: 30000 });
    
    await page.waitForTimeout(2000);
    results.push({ step: 'navigate', ok: true });

    // 2. Verify brand
    console.log('2. Checking brand...');
    const hasBrand = await page.locator('h1:has-text("SolarVN")').isVisible();
    results.push({ step: 'brand_visible', ok: hasBrand });

    // 3. Verify stats cards
    console.log('3. Checking stats cards...');
    const statsCount = await page.locator('[class*="dc-stat-card"]').count();
    results.push({ step: 'stats_cards', count: statsCount, ok: statsCount >= 3 });

    // 4. Verify site list
    console.log('4. Checking site list...');
    const siteListHeader = page.locator('h3:has-text("Sites hoạt động")');
    const siteListVisible = await siteListHeader.isVisible();
    results.push({ step: 'site_list_visible', ok: siteListVisible });

    const bodyTextBeforeClick = await page.locator('body').innerText();

    // 5. Check filter dropdown/text before opening overlay panel
    console.log('5. Checking filter controls...');
    const hasFilterText = /Tất cả\s+Healthy\s+Warning\s+Critical/i.test(bodyTextBeforeClick);
    const selectCount = await page.locator('select').count();
    results.push({ step: 'filter_visible', ok: hasFilterText && selectCount >= 2, selectCount });

    // 6. Check regional stats
    console.log('6. Checking regional stats...');
    const hasRegionalStats = /Miền Bắc|Miền Trung|Miền Nam/i.test(bodyTextBeforeClick);
    results.push({ step: 'regional_stats', ok: hasRegionalStats });

    // 7. Check map/layers section
    console.log('7. Checking map...');
    const hasMapControls = /LỚP HIỂN THỊ|Weather|Heatmap|Clusters|Sites/i.test(bodyTextBeforeClick);
    results.push({ step: 'map_visible', ok: hasMapControls });

    // 8. Click a known site in list
    console.log('8. Clicking known site...');
    const knownSite = page.locator('.site-list-item').filter({ hasText: 'SolarVN Hà Nội' }).first();
    if (await knownSite.isVisible({ timeout: 5000 }).catch(() => false)) {
      await knownSite.click();
      console.log('Clicked. Waiting for panel...');
      await page.waitForTimeout(2000);
      
      const bodyAfterClick = await page.locator('body').innerText();
      const panelVisible = /Thông tin site/i.test(bodyAfterClick);
      results.push({ step: 'detail_panel_opened', ok: panelVisible });
      
      if (panelVisible) {
        console.log('Panel OK. Taking panel screenshot...');
        await page.screenshot({ path: 'auto-browser-panel-check.png' });
      }
    } else {
      results.push({ step: 'detail_panel_opened', ok: false, reason: 'known_site_not_found' });
    }

    // 10. Screenshot (viewport only, not fullPage)
    console.log('10. Taking screenshot...');
    await page.screenshot({ path: 'auto-browser-functional-test.png', fullPage: false });
    results.push({ step: 'screenshot', ok: true, path: 'auto-browser-functional-test.png' });

    // Debug: dump visible text
    const allText = await page.locator('body').innerText();
    console.log('--- VISIBLE TEXT (first 1500 chars) ---');
    console.log(allText.slice(0, 1500));
    console.log('--- END ---');

  } catch (err) {
    results.push({ step: 'error', ok: false, error: err.message });
  } finally {
    await browser.close();
  }

  const allPassed = results.every(r => r.ok !== false);
  const summary = {
    ok: allPassed,
    url,
    timestamp: new Date().toISOString(),
    results,
  };

  console.log('\n=== FUNCTIONAL TEST RESULTS ===');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(allPassed ? 0 : 1);
})().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
