import { chromium } from 'playwright'

const targetUrl = process.argv[2] || 'http://localhost:5173/'
const width = parseInt(process.argv[3]) || 1512
const height = parseInt(process.argv[4]) || 2400
const outputPath = process.argv[5] || 'C:/Users/Acer/.openclaw/workspace/solar-dashboard/frontend/solarvn-live-capture.png'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width, height } })

await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(2500)

await page.screenshot({ path: outputPath, fullPage: true })

await browser.close()
console.log(`Saved screenshot to ${outputPath}`)
