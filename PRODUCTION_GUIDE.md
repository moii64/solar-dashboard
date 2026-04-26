# Solar Dashboard - Production Deployment Guide

## Quick Start (Chạy nhanh)

### Linux/Mac
```bash
cd solar-dashboard
chmod +x setup-prod.sh
./setup-prod.sh
```

### Windows (PowerShell)
```powershell
cd solar-dashboard
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\setup-prod.ps1
```

---

## Manual Setup (Nếu script không chạy được)

### 1. Chuẩn bị env
```bash
cp backend/.env.production.example backend/.env.production
```

Sửa file `backend/.env.production`:
- `POSTGRES_PASSWORD=<STRONG_PASSWORD>`
- `MQTT_PASSWORD=<STRONG_PASSWORD>`

### 2. Tạo MQTT user
```bash
docker run --rm -v $(pwd):/work eclipse-mosquitto:2 mosquitto_passwd -c -b /work/mosquitto_passwd solar_ingest <STRONG_MQTT_PASSWORD>
```

### 3. Chạy stack
```bash
POSTGRES_PASSWORD='<STRONG_PASSWORD>' docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Verify
```bash
curl http://localhost:8000/healthz
```

Kỳ vọng:
```json
{
  "status": "ok",
  "db": "connected",
  "mqtt_consumer_enabled": false,
  "mqtt_connected": null
}
```

---

## Cấu hình Reverse Proxy (SSL + Domain)

### Nginx (khuyên dùng)
Tạo file `/etc/nginx/sites-available/api.solarvn.com`:

```nginx
server {
    listen 80;
    server_name api.solarvn.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.solarvn.com;

    ssl_certificate /etc/letsencrypt/live/api.solarvn.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.solarvn.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/api.solarvn.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d api.solarvn.com
```

---

## MQTT Test (Publish dữ liệu thật)

### Từ server
```bash
docker compose -f docker-compose.prod.yml exec mqtt mosquitto_pub \
  -h localhost -p 1883 \
  -u solar_ingest -P '<STRONG_MQTT_PASSWORD>' \
  -t solar/inverters/demo-01 \
  -m '{"name":"MQTT Demo Inverter","ip_address":"192.168.50.10","location":"Solar Farm A","device_type":"sungrow","timestamp":"2026-04-26T16:10:00Z","voltage":229.8,"current":11.7,"power":2688,"energy_today":15.42,"temperature":41.3,"is_online":true}'
```

### Verify ingest
```bash
docker compose -f docker-compose.prod.yml logs backend | grep "ingest success"
```

---

## Monitoring & Logs

### Backend logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

### MQTT logs
```bash
docker compose -f docker-compose.prod.yml logs -f mqtt
```

### Database logs
```bash
docker compose -f docker-compose.prod.yml logs -f db
```

---

## Backup Database

### Manual backup
```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U solar_user solar_db > backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restore
```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U solar_user solar_db < backup-20260426-165000.sql
```

---

## Update Frontend to Production

Khi backend đã chạy ở `https://api.solarvn.com`, update frontend env:

```bash
cd frontend
npx vercel env add VITE_API_BASE production
# Nhập: https://api.solarvn.com

npx vercel env add VITE_WS_URL production
# Nhập: wss://api.solarvn.com/ws/inverters

npx vercel --prod
```

---

## Troubleshooting

### Backend 500 error
```bash
docker compose -f docker-compose.prod.yml logs backend
```

### MQTT không connect
- Check `MQTT_BROKER` = `mqtt` (service name)
- Check `MQTT_PORT` = `1883`
- Check `ENABLE_MQTT_CONSUMER` = `1`

### Database connection failed
```bash
docker compose -f docker-compose.prod.yml exec db psql -U solar_user -d solar_db -c "SELECT 1"
```

### Port 8000 already in use
```bash
lsof -i :8000
kill -9 <PID>
```

---

## Production Checklist

- [ ] Backend chạy ổn định (`/healthz` = ok)
- [ ] MQTT consumer bật (`mqtt_consumer_enabled=true`)
- [ ] Database backup định kỳ
- [ ] SSL certificate cấu hình
- [ ] Reverse proxy (nginx) chạy
- [ ] Domain `api.solarvn.com` trỏ đúng
- [ ] Frontend env cập nhật
- [ ] Test MQTT publish/ingest
- [ ] Monitor logs hàng ngày
- [ ] Firewall chỉ mở port 80/443 (MQTT 1883 nếu cần)

---

## Support

Nếu gặp vấn đề:
1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Verify env: `cat backend/.env.production`
3. Test API: `curl http://localhost:8000/healthz`
4. Test MQTT: `mosquitto_sub -h localhost -u solar_ingest -P <pass> -t solar/inverters/#`
