# Solar Dashboard - Production Setup (Windows)

Write-Host "=== Solar Dashboard - Production Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env.production exists
if (-not (Test-Path "backend\.env.production")) {
    Write-Host "Creating backend\.env.production from example..." -ForegroundColor Yellow
    Copy-Item "backend\.env.production.example" "backend\.env.production"
    Write-Host "⚠️  Please edit backend\.env.production and set strong passwords!" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter after you've updated the passwords"
}

# Check if mosquitto_passwd exists
if (-not (Test-Path "mosquitto_passwd")) {
    Write-Host "Creating MQTT user 'solar_ingest'..." -ForegroundColor Yellow
    $MQTT_PASS = Read-Host "Enter MQTT password for 'solar_ingest'" -AsSecureString
    $MQTT_PASS_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($MQTT_PASS))
    
    docker run --rm -v "${PWD}:/work" eclipse-mosquitto:2 mosquitto_passwd -c -b /work/mosquitto_passwd solar_ingest $MQTT_PASS_PLAIN
    Write-Host "✅ MQTT password file created" -ForegroundColor Green
    Write-Host ""
}

# Get Postgres password
if (-not $env:POSTGRES_PASSWORD) {
    $PG_PASS = Read-Host "Enter PostgreSQL password" -AsSecureString
    $env:POSTGRES_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($PG_PASS))
}

Write-Host "Starting production stack..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml up -d --build

Write-Host ""
Write-Host "✅ Production stack started!" -ForegroundColor Green
Write-Host ""
Write-Host "Waiting 10 seconds for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "Checking backend health..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/healthz" -Method Get
    $response | ConvertTo-Json
} catch {
    Write-Host "⚠️  Backend not ready yet, check logs: docker compose -f docker-compose.prod.yml logs backend" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Production URLs ===" -ForegroundColor Cyan
Write-Host "Backend API: http://localhost:8000"
Write-Host "Backend healthz: http://localhost:8000/healthz"
Write-Host "MQTT broker: localhost:1883"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Point your domain 'api.solarvn.com' to this server's IP"
Write-Host "2. Set up reverse proxy (nginx/caddy) with SSL"
Write-Host "3. Update frontend env to use https://api.solarvn.com"
Write-Host ""
