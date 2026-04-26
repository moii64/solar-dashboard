#!/bin/bash
set -e

echo "=== Solar Dashboard - Production Setup ==="
echo ""

# Check if .env.production exists
if [ ! -f backend/.env.production ]; then
  echo "Creating backend/.env.production from example..."
  cp backend/.env.production.example backend/.env.production
  echo "⚠️  Please edit backend/.env.production and set strong passwords!"
  echo ""
  read -p "Press Enter after you've updated the passwords..."
fi

# Check if mosquitto_passwd exists
if [ ! -f mosquitto_passwd ]; then
  echo "Creating MQTT user 'solar_ingest'..."
  read -sp "Enter MQTT password for 'solar_ingest': " MQTT_PASS
  echo ""
  docker run --rm -v "$(pwd):/work" eclipse-mosquitto:2 mosquitto_passwd -c -b /work/mosquitto_passwd solar_ingest "$MQTT_PASS"
  echo "✅ MQTT password file created"
  echo ""
fi

# Get Postgres password
if [ -z "$POSTGRES_PASSWORD" ]; then
  read -sp "Enter PostgreSQL password: " POSTGRES_PASSWORD
  echo ""
  export POSTGRES_PASSWORD
fi

echo "Starting production stack..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✅ Production stack started!"
echo ""
echo "Waiting 10 seconds for services to initialize..."
sleep 10

echo ""
echo "Checking backend health..."
curl -s http://localhost:8000/healthz | jq .

echo ""
echo "=== Production URLs ==="
echo "Backend API: http://localhost:8000"
echo "Backend healthz: http://localhost:8000/healthz"
echo "MQTT broker: localhost:1883"
echo ""
echo "Next steps:"
echo "1. Point your domain 'api.solarvn.com' to this server's IP"
echo "2. Set up reverse proxy (nginx/caddy) with SSL"
echo "3. Update frontend env to use https://api.solarvn.com"
echo ""
