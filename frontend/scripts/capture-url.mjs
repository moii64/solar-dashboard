import { chromium } from 'playwright'

const targetUrl = process.argv[2] || 'https://frontend-fawn-ten-90.vercel.app/'
const outputPath = process.argv[3] || 'C:/Users/Acer/.openclaw/workspace/solar-dashboard/frontend/solarvn-live-capture.png'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1512, height: 2400 } })

await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(2500)

await page.screenshot({ path: outputPath, fullPage: true })

await browser.close()
console.log(`Saved screenshot to ${outputPath}`)
