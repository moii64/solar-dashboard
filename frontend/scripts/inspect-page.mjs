import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1512, height: 3000 } })

await page.goto('https://frontend-fawn-ten-90.vercel.app/', { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(2000)

// Extract page structure
const structure = await page.evaluate(() => {
  const getText = (el) => el ? el.textContent.trim().replace(/\s+/g, ' ') : ''
  const headings = [...document.querySelectorAll('h1,h2,h3')]
    .map(h => ({ tag: h.tagName, text: getText(h) }))
  const sections = [...document.querySelectorAll('[class*="section"], [class*="card"], [class*="panel"], main > *')]
    .map(s => ({
      tag: s.tagName,
      cls: s.className.substring(0, 80),
      text: getText(s).substring(0, 60)
    }))
  const buttons = [...document.querySelectorAll('button')]
    .map(b => getText(b)).filter(Boolean)
  return { headings, sections, buttons }
})

console.log(JSON.stringify(structure, null, 2))
await browser.close()