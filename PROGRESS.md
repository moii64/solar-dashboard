# Solar Dashboard - Progress Log

Cập nhật gần nhất: 2026-04-26 15:46 (GMT+7)

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
  - **Backend:** FastAPI + SQLAlchemy, có CRUD cơ bản cho inverter, seed demo data khi startup, endpoint latest/data/delete, WebSocket mock realtime.
  - **Simulator:** có Modbus TCP simulator ở cổng `5020`.
  - **Frontend:** UI khá đẹp, dark mode, dashboard overview, list/select/add/delete inverter, polling dữ liệu mỗi 15s, chart công suất bằng Recharts.
  - **Docker/Infra:** có `redis`, `postgres`, `backend`, `frontend` trong `docker-compose.yml`.
- Đã verify nhanh:
  - `frontend`: `npm run build` ✅ thành công
  - `backend tests`: `pytest tests -q` ✅ 5 tests pass
- Đã hoàn thiện backend block tiếp theo:
  - thêm `PUT /inverters/{id}` để cập nhật thông tin inverter
  - thêm `GET /stats/overview` cho dashboard summary
  - thêm `GET /stats/history` hỗ trợ chart fleet / single inverter
- Đã mở rộng test API cho các endpoint mới và cập nhật lại file tiến độ
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
  - đổi `@app.on_event("startup"/"shutdown")` sang `lifespan` (`@asynccontextmanager` + `FastAPI(..., lifespan=lifespan)`)
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

## ⏳ Đang làm
- Realtime nền hiện đã có 3 đường: backend mock loop, simulator Modbus → telemetry ingest, và MQTT consumer → telemetry ingest.
- Luồng simulator → backend đã được verify chạy thật trong Docker network nội bộ.
- MQTT consumer đã xong bản nền ở backend; bước sau là có thể gắn broker/gateway thật để smoke test ngoài đời.
- Host ports `8000/5432/6379` hiện đang bị project khác chiếm, nên nếu muốn chạy full compose nguyên bản cần đổi port hoặc tắt stack kia.
- UI hiện tại đã chuyển sang góc nhìn multi-site control center.
- Bước kế tiếp là làm dữ liệu và trải nghiệm map thật hơn để xứng với định vị mới.

## ✅ Đã xong (block này)
- **Tối ưu frontend bundle:**
  - Vite config: thêm `manualChunks` chia vendor thành 8 chunk riêng (react, router, query, charts, map, utils)
  - Main bundle giảm: 656KB → 42KB (gzip ~11KB)
  - Recharts tách thành `ChartComponent` lazy-loaded (`React.lazy` + `Suspense`)
  - vendor-charts (Recharts): 378KB (gzip ~104KB) - load khi cần
  - vendor-router (155KB), vendor-query (36KB), vendor-utils (39KB)
  - vendor-map: 1KB (maplibre/deck.gl chưa dùng)
  - Build pass, no chunk size warnings

## ✅ Cập nhật mới (14:25)
- Đã nâng cấp MapComponent lên bản "thật" hơn:
  - Heat layer: density visualization theo health weight ở zoom thấp (4-9)
  - Cluster layer: nhóm markers có count badge, click để expand, ở zoom trung (9-10)
  - Point layer: circles size theo công suất (interpolated), color theo health, highlight khi selected
  - Popup on click/hover hiện thông tin site
  - Smooth transitions và fit bounds khi data thay đổi
- Build verify thành công: `npm run build` ✅ (8.16s)

## ✅ Cập nhật mới (14:30)
- Đã hoàn thiện UI detail panel cho site được select:
  - Tách component `SiteDetailPanel` riêng, hiển thị thông tin chi tiết site ở panel bên phải
  - Hiển thị trạng thái sức khỏe, metadata vị trí/thiết bị, KPI nhanh (power/energy/temp/last update)
  - Nhúng biểu đồ lịch sử 24h bằng `ChartComponent` trong panel
  - Đóng/mở panel theo site được chọn từ map hoặc bảng
- Đã sửa wiring giữa `MapComponent` và `DashboardPage`:
  - Đồng bộ `onSiteClick(siteId)` -> map sang `selectedSite`
  - Sửa import path và lỗi type để build sạch
- Build verify thành công: `npm run build` ✅ (8.53s)

## ✅ Cập nhật mới (15:00)
- Đã thêm weather overlay tile layer cho `MapComponent`:
  - Hỗ trợ source/layer raster thời tiết với env `VITE_WEATHER_TILE_URL`
  - Có toggle `Weather` trong panel layer controls để bật/tắt lớp thời tiết
  - Overlay dùng `raster-opacity` để chồng nhẹ lên base map
  - Khi chưa cấu hình URL, UI hiển thị cảnh báo nhỏ để biết overlay đang tắt
- Đã mở rộng cấu hình môi trường:
  - thêm `VITE_WEATHER_TILE_URL` vào `solar-dashboard/.env.example`
  - kèm ví dụ OpenWeather tile template `{z}/{x}/{y}`
- Build verify thành công: `npm run build` ✅ (11.44s)

## ✅ Cập nhật mới (15:46)
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

## 📌 Việc tiếp theo
1. (Optional) Thêm time slider cho weather animation nếu có tile hỗ trợ timestamp
2. (Optional) Tích hợp weather forecast API để hiển thị dự báo 3-7 ngày
3. Tiếp tục làm data pipeline thật (nối gateway/MQTT broker production)

## 🧭 Cách dùng file này
- Mỗi lần tiếp tục, chỉ cần quét `solar-dashboard/PROGRESS.md` trước.
- Agent sẽ cập nhật mục `Đã thực hiện / Đang làm / Việc tiếp theo` sau mỗi block công việc.
