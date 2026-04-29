# MQTT Production Guide

This guide wires real inverter/gateway telemetry into SolarVN Dashboard through MQTT.

## Current production decision

Custom API domain is blocked because `api.solarvn.com` is not under our DNS control. Until DNS access is available, keep using:

- Backend: `https://solar-dashboard-xs4b.onrender.com`
- Frontend: `https://solar-dashboard-rouge.vercel.app`

## Architecture

```text
Inverter/Gateway -> MQTT Broker -> Backend MQTT Consumer -> DB -> WebSocket -> Frontend
```

## Broker deployment

The repo already includes:

- `docker-compose.prod.yml`
- `mosquitto.prod.conf`
- `backend/.env.production.example`

### 1. Create MQTT password file

On the production machine:

```bash
docker run --rm -it -v "$PWD:/work" eclipse-mosquitto:2 \
  mosquitto_passwd -c /work/mosquitto_passwd solar_ingest
```

Use a strong password and save it in `backend/.env.production` as `MQTT_PASSWORD`.

### 2. Configure backend env

Create `backend/.env.production` from `backend/.env.production.example`.

Required values:

```env
ENABLE_MQTT_CONSUMER=1
MQTT_BROKER=mqtt
MQTT_PORT=1883
MQTT_TOPIC=solar/inverters/#
MQTT_USERNAME=solar_ingest
MQTT_PASSWORD=<STRONG_MQTT_PASSWORD>
MQTT_CLIENT_ID=solar-dashboard-backend-prod
MQTT_AUTO_CREATE_INVERTER=1
ENABLE_BACKGROUND_TELEMETRY=0
```

### 3. Start production stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Verify health

```bash
curl http://localhost:8000/healthz
```

Expected:

```json
{
  "status": "ok",
  "db": "connected",
  "mqtt_consumer_enabled": true,
  "mqtt_connected": true
}
```

## MQTT payload schema

Recommended topic:

```text
solar/inverters/<site-or-device-id>
```

Recommended JSON payload:

```json
{
  "inverter_id": 1,
  "timestamp": "2026-04-30T00:00:00Z",
  "voltage": 221.5,
  "current": 3.2,
  "power": 708.8,
  "energy_today": 4.2,
  "temperature": 31.4,
  "is_online": true
}
```

If `MQTT_AUTO_CREATE_INVERTER=1`, the backend can also match/create from metadata such as `name`, `ip_address`, or nested `inverter` + `telemetry` payloads.

## Smoke test

From a machine that can reach the broker:

```bash
python scripts/mqtt-prod-smoke-test.py \
  --broker <BROKER_HOST> \
  --port 1883 \
  --username solar_ingest \
  --password '<STRONG_MQTT_PASSWORD>' \
  --backend https://solar-dashboard-xs4b.onrender.com \
  --topic solar/inverters/smoke-test
```

Expected output:

```json
{
  "ok": true,
  "inverter_id": 123,
  "latest": {
    "power": 708.8
  }
}
```

## Security notes

- Keep port `1883` private if possible (VPN/VPC/Tailscale preferred).
- If the broker must be public, add TLS (`8883`) before allowing devices outside the private network.
- Use per-device credentials when moving beyond one gateway.
- Rotate `MQTT_PASSWORD` after smoke testing.

## Render caveat

The current Render backend cannot connect to the local Docker broker unless the broker is reachable from Render. Options:

1. Run backend + broker together on the same VPS using `docker-compose.prod.yml`.
2. Use a managed MQTT broker accessible from Render.
3. Expose broker securely via TLS/VPN and set Render env:
   - `ENABLE_MQTT_CONSUMER=1`
   - `MQTT_BROKER=<public-or-private-broker-host>`
   - `MQTT_PORT=8883` or `1883`
   - `MQTT_USERNAME=...`
   - `MQTT_PASSWORD=...`
