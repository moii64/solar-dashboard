const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  console.log('Navigating to dashboard...');
  await page.goto('https://solar-dashboard-rouge.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait a bit for React to render
  await page.waitForTimeout(3000);
  
  // Take screenshot
  const screenshotPath = 'C:\\Users\\Acer\\.openclaw\\workspace\\solar-dashboard\\frontend\\dashboard-screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  
  console.log('Screenshot saved to:', screenshotPath);
  
  // Get page title and some info
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check for console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.waitForTimeout(1000);
  
  if (errors.length > 0) {
    console.log('Console errors:', errors);
  } else {
    console.log('No console errors detected');
  }
  
  await browser.close();
})();