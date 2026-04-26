import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } })

await page.goto('http://localhost:20128/dashboard/usage', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
})
await page.waitForTimeout(1500)

const passwordInput = page
  .locator('input[type="password"], input[name*="pass" i], input[placeholder*="mật" i], input[placeholder*="password" i]')
  .first()

await passwordInput.fill('123456')

const submitButton = page
  .locator('button:has-text("Đăng nhập"), button:has-text("Login"), button[type="submit"]')
  .first()

await submitButton.click()
await page.waitForTimeout(6000)

await page.screenshot({
  path: 'C:/Users/Acer/.openclaw/workspace/solar-dashboard/frontend/ref-ui-9router-usage-after-login.png',
  fullPage: true,
})

await browser.close()
