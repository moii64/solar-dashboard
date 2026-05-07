import { chromium } from 'playwright';

const url = 'http://localhost:5174/';
const result = {
  success: false,
  url,
  checks: {
    dashboard_loaded: false,
    map_panel_visible: false,
    layer_toggles_visible: false,
    deckgl_toggle_clickable: false
  },
  notes: [],
  error_reasoning: null
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  // Use domcontentloaded + extra wait instead of networkidle (external tiles never fully idle)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(6000); // wait for Vite to hydrate + map to render

  await page.locator('h3:has-text("Vị trí Sites")').first().waitFor({ timeout: 25000 });
  result.checks.dashboard_loaded = true;
  result.checks.map_panel_visible = true;

  const heatBtn = page.getByRole('button', { name: /Heatmap/i }).first();
  const clusterBtn = page.getByRole('button', { name: /Clusters/i }).first();
  const maplibreBtn = page.getByRole('button', { name: /MapLibre Sites/i }).first();
  const deckBtn = page.getByRole('button', { name: /DeckGL Sites/i }).first();

  await heatBtn.waitFor({ timeout: 10000 });
  await clusterBtn.waitFor({ timeout: 10000 });
  await maplibreBtn.waitFor({ timeout: 10000 });
  await deckBtn.waitFor({ timeout: 10000 });

  result.checks.layer_toggles_visible = true;

  await deckBtn.click({ timeout: 10000 });
  await page.waitForTimeout(300);
  await deckBtn.click({ timeout: 10000 });
  result.checks.deckgl_toggle_clickable = true;

  await page.screenshot({ path: 'smoke-solar-dashboard.png', fullPage: true });
  result.notes.push('Screenshot: smoke-solar-dashboard.png');

  result.success = Object.values(result.checks).every(Boolean);
} catch (e) {
  result.error_reasoning = e?.message || String(e);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exit(1);