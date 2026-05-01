# Task: Solar Dashboard Smoke Test

## Goal
Verify the Solar Dashboard production site loads correctly and displays key information.

## URL
https://solar-dashboard-rouge.vercel.app

## Steps
1. Navigate to the production URL
2. Wait for the page to load completely
3. Verify the brand name "SolarVN" or "Control Center" is visible
4. Check that stats cards are displayed (Tổng Sites, Tổng công suất, etc.)
5. Verify the site list panel shows "Sites hoạt động"
6. Check that regional stats (Miền Bắc, Miền Trung, Miền Nam) are visible
7. Verify the map component loads

## Expected Output
```json
{
  "success": true,
  "brand_visible": true,
  "stats_cards_count": 4,
  "site_list_visible": true,
  "regional_stats_visible": true,
  "map_loaded": true,
  "screenshot_path": "dashboard-verified.png"
}
```

## Success Criteria
- Page loads without errors
- All key UI elements are present
- No console errors (except known 404 font glyphs)
