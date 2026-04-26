# Solar Dashboard - Production Deploy Checklist

## 1) Chuẩn bị backend production

### 1.1 Tạo env backend
```bash
cp backend/.env.production.example backend/.env.production
```

Điền các giá trị mạnh:
- `POSTGRES_PASSWORD`
- `MQTT_PASSWORD`

### 1.2 Tạo MQTT user/password
Chạy tại thư mục `solar-dashboard`:
```bash
docker run --rm -it -v ${PWD}:/work eclipse-mosquitto:2 mosquitto_passwd -c /work/mosquitto_passwd solar_ingest
```

### 1.3 Chạy stack production
```bash
POSTGRES_PASSWORD='<STRONG_DB_PASSWORD>' docker compose -f docker-compose.prod.yml up -d --build
```

### 1.4 Verify backend
```bash
curl http://localhost:8000/healthz
```
Kỳ vọng:
- `status=ok`
- `mqtt_consumer_enabled=true`
- `mqtt_connected=true`

---

## 2) Frontend (Vercel)

`frontend/.env.production` đã set:
- `VITE_API_BASE=https://api.solarvn.com`
- `VITE_WS_URL=wss://api.solarvn.com/ws/inverters`

Deploy:
```bash
cd frontend
npx vercel --prod
```

---

## 3) Domain mapping

## 3.1 Frontend domain
- `app.solarvn.com` -> Vercel (CNAME `cname.vercel-dns.com`)

## 3.2 Backend domain
- `api.solarvn.com` -> IP server backend (A record)

## 3.3 SSL
- Bật HTTPS cho cả 2 domain (`app.solarvn.com`, `api.solarvn.com`)

---

## 4) MQTT test payload
```bash
docker compose -f docker-compose.prod.yml exec mqtt mosquitto_pub -h localhost -p 1883 -u solar_ingest -P '<STRONG_MQTT_PASSWORD>' -t solar/inverters/demo-01 -m '{"name":"MQTT Demo Inverter","ip_address":"192.168.50.10","location":"Solar Farm A","device_type":"sungrow","timestamp":"2026-04-26T16:10:00Z","voltage":229.8,"current":11.7,"power":2688,"energy_today":15.42,"temperature":41.3,"is_online":true}'
```

---

## 5) Hardening tối thiểu
- Tắt `allow_anonymous`
- Đổi password mạnh
- Chỉ mở public port cần thiết (80/443, 1883 nếu bắt buộc)
- Backup Postgres định kỳ
- Theo dõi log `backend` + `mqtt`
