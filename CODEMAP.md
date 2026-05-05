# CODEMAP - Solar Dashboard

Last updated: 2026-05-05 17:36 (GMT+7)

## 📁 Structure Overview

```
solar-dashboard/
├── backend/
│   ├── main.py
│   ├── simulator.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   └── test_api.py
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── PROGRESS.md
```

## 🔑 Entry Points

- `backend/main.py` - FastAPI backend application, MQTT consumer, WebSocket broadcaster.
- `backend/simulator.py` - Modbus TCP simulator & telemetry generator.
- `frontend/src/main.tsx` - React application entry point.

## 📦 Core Modules

### ⚙️ Backend (`backend/main.py`)
**Data Models:**
- `Inverter`: Quản lý thông tin site (Tên, Tọa độ, IP, Loại, Alert Thresholds).
- `InverterData`: Lịch sử telemetry.
- `WeatherObservation`, `SourceSyncLog`.

**Core Endpoints:**
- `GET /inverters` & `POST /inverters`: Quản lý danh sách site.
- `GET /inverters/{id}/latest`: Lấy telemetry mới nhất.
- `POST /telemetry/readings`: Webhook/MQTT ingest point cho dữ liệu inverter.
- `GET /stats/overview` & `GET /stats/history`: Phân tích xu hướng toàn hệ thống / từng site.
- `GET /healthz`: System health check (DB, MQTT).
- `WS /ws/inverters`: WebSocket realtime updates cho frontend.

**Key Background Tasks:**
- `start_mqtt_consumer()`: Lắng nghe telemetry từ broker MQTT thực tế.
- `generate_simulated_telemetry()`: (Fallback) Tự tạo data mô phỏng nếu không có simulator ngoài.

### 🎨 Frontend (`frontend/src/`)

**Pages:**
- `DashboardPage.tsx` - Màn hình chính (Control Center).
  - Tích hợp: Map, Stats Overview, Cảnh báo thông minh (Smart Alerts), Trend Analytics.
- `ChartComponent.tsx` - Biểu đồ Recharts hiển thị xu hướng công suất.
- `MapComponent.tsx` - Bản đồ tương tác dùng MapLibre (Heatmap, Clusters, Weather Overlay).

**Components:**
- `SiteDetailPanel.tsx` - Panel trượt hiển thị chi tiết 1 site, cho phép cấu hình "Ngưỡng cảnh báo" (Temp Max, Power Min, Offline Timeout).
- `InverterModelForm.tsx` - Form hỗ trợ tra cứu tham số biến tần theo model (Sungrow, Huawei...).
- `Icons.tsx` - Bộ icon SVG dùng toàn dự án.

## 🔌 External Integrations

- **Database:** PostgreSQL (production), SQLite (local).
- **Message Broker:** MQTT (Mosquitto/EMQX) cho ingestion.
- **Cache:** Redis.
- **Frontend Map:** OpenStreetMap / Carto (via MapLibre).

## ⚠️ Important Files

- `docker-compose.yml` - Setup môi trường phát triển (Backend, Frontend, DB, Redis, MQTT, Simulator).
- `docker-compose.prod.yml` - Setup môi trường production.
- `backend/.env.production.example` - Config biến môi trường cho Backend.

## 📝 Notes

- **Tech Stack:** FastAPI (Python), React 18 + Vite + TypeScript.
- **UI Framework:** Tailwind CSS.
- **Realtime:** HTTP Polling (fallback) + WebSockets.
- Cấu trúc cảnh báo (Smart Alerts) được xử lý trực tiếp trên Frontend dựa vào dữ liệu telemetry mới nhất so với ngưỡng lưu trong Backend.
