const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1512, height: 3000 } })

  await page.goto('https://frontend-fawn-ten-90.vercel.app/', { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(2000)

  const structure = await page.evaluate(() => {
    const getText = (el) => el ? el.textContent.trim().replace(/\s+/g, ' ').substring(0, 100) : ''
    const headings = [...document.querySelectorAll('h1,h2,h3')]
      .map(h => ({ tag: h.tagName, text: getText(h) }))
    const buttons = [...document.querySelectorAll('button')]
      .map(b => getText(b)).filter(Boolean)
    const nav = [...document.querySelectorAll('nav a, aside a')]
      .map(a => ({ text: getText(a), href: a.getAttribute('href') })).filter(a => a.text)
    return { headings, buttons, nav }
  })

  console.log(JSON.stringify(structure, null, 2))
  await browser.close()
})()