# Browser-Use Flow (Solar Dashboard)

Mục tiêu: thêm lane tự động hoá browser để smoke test UI production/local nhanh, ổn định và lặp lại được.

## 1) Khi nào dùng browser-use

Dùng browser-use cho các việc:
- Smoke test sau deploy (mở app, kiểm tra UI có render, không crash)
- Verify dữ liệu chính trên dashboard (cards, chart, site list)
- Kiểm tra flow tương tác đơn giản (mở detail panel, đổi range chart)

Không dùng browser-use cho:
- Unit/integration test backend (đã có pytest)
- Build check (đã có npm run build)

## 2) Setup nhanh (local)

Yêu cầu: Python >= 3.11 + uv

```bash
uv init
uv add browser-use
uv sync
```

Tạo `.env` (tuỳ chọn, nếu dùng cloud/model ngoài):

```env
BROWSER_USE_API_KEY=your_key
# GOOGLE_API_KEY=...
# ANTHROPIC_API_KEY=...
```

## 3) Kịch bản mặc định cho Solar Dashboard

### 3.1 Smoke test production
Mục tiêu:
- Mở `https://solar-dashboard-rouge.vercel.app`
- Xác nhận thấy "SolarVN" hoặc "Control Center"
- Xác nhận có khu vực cards/stats và site list

### 3.2 Smoke test local
Mục tiêu:
- Mở `http://localhost:5173`
- Xác nhận layout chính render đầy đủ
- Chụp screenshot để lưu bằng chứng

## 4) Quy trình chạy chuẩn (gắn vào deploy flow)

1. `npm run build` pass
2. Deploy Vercel
3. Chạy `node scripts/vercel-check.cjs --brief`
4. Chạy browser-use smoke test (production)
5. Nếu pass => đánh dấu ready

## 5) Pass/Fail rule

Pass khi:
- Trang mở được
- Có text nhận diện thương hiệu (SolarVN/Control Center)
- Có ít nhất 1 card chỉ số + khu vực site list

Fail khi:
- Timeout mở trang
- Trang trắng/lỗi render
- Thiếu layout chính

## 6) Lưu ý vận hành

- Ưu tiên chạy browser-use ở vai trò "UI verification", không thay thế test code.
- Khi môi trường cloud bị lỗi tạm thời, vẫn giữ `vercel-check.cjs` làm health gate chính.
- Với tác vụ anti-bot/captcha, cân nhắc Browser Use Cloud.
