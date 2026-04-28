# Solar Dashboard - Progress Log

Cập nhật gần nhất: 2026-04-28 06:57 (GMT+7)

## ✅ Đã thực hiện
- Kiểm tra lại project thực tế ở root:
  - `backend/`
  - `frontend/`
  - `tests/`
  - `.env`, `.env.example`, `docker-compose.yml`, `PROGRESS.md`
- Đã rà soát các file chính:
  - `backend/main.py`
  - `backend/simulator.py`
  - `frontend/src/App.tsx`
  - `frontend/src/pages/DashboardPage.tsx`
  - `docker-compose.yml`, `.env.example`
  - `tests/test_api.py`
- Đã chốt trạng thái hiện tại:
  - **Backend:** FastAPI + SQLAlchemy, có CRUD cơ bản cho inverter, seed demo data khi startup, WebSocket broadcast dữ liệu realtime.
  - **Simulator:** có Modbus TCP simulator ở cổng `5020`.
  - **Frontend:** UI khá đẹp, dark mode, dashboard overview, list/select/add/delete inverter, polling dữ liệu mỗi 15s, chart công suất bằng Recharts.
  - **Docker/Infra:** có `redis`, `postgres`, `backend`, `frontend` trong `docker-compose.yml`.
- Đã verify nhanh:
  - `frontend`: `npm run build` ✅ thành công
  - `backend tests`: `python -m pytest tests -q` ✅ 15 tests pass
- Đã hoàn thiện backend block tiếp theo:
  - thêm `PUT /inverters/{id}` để cập nhật thông tin inverter
  - thêm `GET /stats/overview` cho dashboard summary
  - thêm `GET /stats/history` hỗ trợ chart fleet / single inverter
- Đã nối frontend sang stats API mới:
  - card overview lấy dữ liệu từ `GET /stats/overview`
  - biểu đồ công suất dùng `GET /stats/history?inverter_id=...`
  - giữ live snapshot từ endpoint `latest`
- Đã verify lại frontend build ✅
- Đã setup realtime flow bản nền:
  - backend có background telemetry loop tạo dữ liệu live theo từng inverter
  - thêm `POST /telemetry/readings` để sau này nối simulator/MQTT/gateway thật
  - WebSocket `/ws/inverters` chuyển sang broadcast dữ liệu realtime thay vì mock cứng
  - frontend nhận WebSocket và tự cập nhật live snapshot + power chart
- Đã mở rộng test backend cho luồng ingest telemetry
- Đã hoàn thiện block simulator end-to-end:
  - bổ sung dependency còn thiếu cho simulator (`httpx`, `pymodbus`) vào `backend/requirements.txt`
  - nâng `backend/simulator.py` thành simulator có cấu hình qua env, tự match/tạo inverter trên backend và tự retry khi inverter ID không còn hợp lệ
  - thêm service `simulator` vào `docker-compose.yml` để chạy Modbus + telemetry ingest xuyên suốt với backend
  - tắt `ENABLE_BACKGROUND_TELEMETRY` mặc định trong flow Docker để tránh bị trộn dữ liệu giả từ backend loop với dữ liệu simulator
  - mở rộng `.env.example` cho luồng simulator local/Docker
- Đã chuyển concept UI từ “giám sát biến tần thời gian thực” sang **multi-site solar control center**:
  - viết lại hero/home section theo hướng điều hành danh mục site
  - thêm bản đồ danh mục, tổng hợp theo khu vực, ranking cụm dự án
  - đổi danh sách thiết bị thành bảng điều hành đa site + selected site focus panel
  - cập nhật header/app shell theo định vị mới
- Đã verify lại:
  - `backend_venv\\Scripts\\python -m pytest tests -q` ✅ 9 tests pass
  - `backend_venv\\Scripts\\python -m py_compile backend\\simulator.py` ✅ pass
  - `frontend npm run build` ✅ pass
- Đã verify runtime end-to-end với Docker test mode (không chiếm cổng host đang bị project khác dùng):
  - Docker engine đã lên lại sau khi shutdown WSL lingering processes
  - dựng `postgres` + `backend` + `simulator` test containers trên network nội bộ
  - backend healthz OK, DB connected
  - simulator tạo/match inverter và POST thành công vào `/telemetry/readings`
  - xác minh `GET /inverters/{id}/latest` trả về reading mới từ simulator
  - đã vá compatibility cho `pymodbus` mới (import/context/register update) sau khi bắt được lỗi runtime thật
- Đã thêm MQTT consumer bản nền ở backend:
  - hỗ trợ bật/tắt bằng `ENABLE_MQTT_CONSUMER`
  - subscribe topic cấu hình từ env và ingest JSON payload từ gateway/device thật
  - hỗ trợ match inverter theo `inverter_id`, `ip_address`, `name`
  - hỗ trợ auto-create inverter mới từ MQTT payload khi chưa có mapping
  - hỗ trợ payload lồng kiểu `inverter` + `telemetry`
  - bổ sung test cho luồng MQTT ingest và auto-create inverter
  - verify lại backend test: `11` tests pass
- Đã dọn block tech debt/deprecation ở backend:
  - đổi `from sqlalchemy.ext.declarative import declarative_base` -> `from sqlalchemy.orm import declarative_base`
  - đổi `@app.on_event("startup"/"shutdown")` sang `lifespan` (`@asynccontextmanager` + `FastAPI(..., lifespam=lifespan)`)
  - đổi model response từ Pydantic `class Config` sang `model_config`
  - đổi các chỗ `datetime.utcnow()` sang timezone-aware (`datetime.now(timezone.utc)`)
- Đã cài `psycopg[binary]` trong `backend_venv` để gỡ lỗi thiếu driver PostgreSQL khi verify import.
- Đã fix MQTT consumer hoạt động end-to-end:
  - MQTT broker connect/subscribe thành công nhưng callback không chạy do paho-mqtt v2 callback API
  - Root cause: `reason_code` trong `on_connect(V2)` là object `ReasonCode` không cast int() được
  - Fix: dùng `callback_api_version=mqtt.CallbackAPIVersion.VERSION2` và `reason_value = getattr(reason_code, "value", reason_code)`
  - Đổi MQTT loop từ `loop_start()` sang `threading.Thread(target=client.loop_forever, daemon=True)` để đảm bảo callback chạy
  - Thêm `mqtt_connected` state vào `/healthz` để verify
  - Thêm debug logs (print statements) để trace callback execution
  - Smoke test PASS: publish payload từ backend → broker → consumer → DB persist thành công (reading_id=847)

## ✅ Cập nhật mới (2026-04-26 15:46)
- Đã hoàn thiện weather overlay với legend + opacity control:
  - Thêm `VITE_WEATHER_LAYER_KIND` env để chọn loại overlay: `precipitation` | `clouds` | `temp`
  - Mỗi loại có metadata riêng: title, unit, gradient màu, marks (min/mid/max)
  - UI hiển thị legend với gradient bar + 3 mốc giá trị
  - Thêm slider opacity (15%-85%) để điều chỉnh độ trong suốt overlay realtime
  - Toggle label hiện tên đầy đủ của layer (ví dụ: "Weather · Mưa (Precipitation)")
  - Khi thiếu `VITE_WEATHER_TILE_URL`, hiện cảnh báo nhỏ thay vì legend
- Đã cập nhật `.env.example`:
  - Thêm `VITE_WEATHER_LAYER_KIND=precipitation` với comment hướng dẫn 3 loại
- Build verify thành công: `npm run build` ✅ (7.27s)

## ✅ Cập nhật mới (2026-04-26 17:50)
- Đã deploy thành công frontend lên Vercel:
  - URL: https://frontend-fawn-ten-90.vercel.app (alias: https://solarvn-app.vercel.app)
  - Branding changed to "SolarVN Control Center"
- Đã deploy backend lên Render.com:
  - URL: https://solar-dashboard-dzxk.onrender.com
  - Health check: https://solar-dashboard-dzxk.onrender.com/healthz OK
- Đã cấu hình frontend gọi backend production:
  - `VITE_API_BASE=https://solar-dashboard-dzxk.onrender.com`
  - `VITE_WS_URL=wss://solar-dashboard-dzxk.onrender.com/ws/inverters`
- Đã push repository lên GitHub:
  - Repo: https://github.com/moii64/solar-dashboard
  - Commit baseline: `a2bd7cd`
- Đã chuẩn bị bộ production kit:
  - `docker-compose.prod.yml` (Postgres, Redis, MQTT, Backend)
  - `backend/.env.production.example`
  - `mosquitto.prod.conf`
  - `setup-prod.sh`, `setup-prod.ps1`
  - `PRODUCTION_GUIDE.md`
  - `render.yaml`
  - `backend/Dockerfile` (Render-ready)
- Đã thêm **Inverter Model Form** vào Dashboard:
  - Nhập mã model (SG50CX, SG110CX, GW50KN-MT, SUN2000-50KTL, SE33.3K)
  - Tự điền thông số P02.01~P02.05
  - Button Copy checklist cấu hình biến tần

## ✅ Cập nhật mới (2026-04-28 06:57)
- Đã commit và push code lên GitHub (commit `94bc6ef`):
  - Cập nhật branding từ "Solar Việt Nam Dashboard" → "SolarVN Dashboard"
  - Rút gọn PROGRESS.md
- Đã deploy lại frontend lên Vercel:
  - Production URL: https://solar-dashboard-rouge.vercel.app
  - Preview URL: https://solar-dashboard-h73v4vc18-mmax64s-projects.vercel.app
  - Build thành công trong 59s (Vite + TypeScript)
  - Vercel tự động tạo Python venv cho backend service

## ✅ Việc tiếp theo
1. Kiểm tra frontend production hoạt động:
   - Verify API connection với backend Render
   - Test WebSocket realtime updates
   - Kiểm tra responsive trên mobile
2. Tiếp tục nâng cấp UI:
   - Thêm micro-animations & transitions tinh tế
   - Tối ưu typography & spacing
   - Nâng cấp data visualization (Recharts, Map)
3. Backend production thực thụ:
   - Cấu hình SSL + reverse proxy
   - Map domain `solarvn.com`, `app.solarvn.com`, `api.solarvn.com`
4. Tích hợp dữ liệu thật:
   - Kết nối MQTT broker/gateway thực tế
   - Import historical data từ weather stations
   - Dự báo sản lượng (ML/yield prediction)

## 🧭 Cách dùng file này
- Mỗi lần tiếp tục, chỉ cần quét `solar-dashboard/PROGRESS.md` trước.
- Agent sẽ cập nhật mục `Đã thực hiện / Đang làm / Việc tiếp theo` sau mỗi block công việc.
