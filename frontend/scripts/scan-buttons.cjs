const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('https://frontend-fawn-ten-90.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(5000);

  const btns = await p.evaluate(() => {
    return [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean);
  });

  console.log('All buttons found:');
  btns.forEach(t => console.log(' -', t));

  console.log('\nTotal:', btns.length, 'buttons');

  const hasAuto = btns.some(t => t.includes('Auto refresh'));
  console.log('Has Auto refresh:', hasAuto);

  await b.close();
})();