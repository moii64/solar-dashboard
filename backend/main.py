import os
import json
import asyncio
import math
import logging
import threading
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Any

from dotenv import load_dotenv
load_dotenv()

try:
    from backend.telegram_notifier import send_telegram_alert
except ModuleNotFoundError:
    from telegram_notifier import send_telegram_alert

import paho.mqtt.client as mqtt

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from contextlib import asynccontextmanager
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel, field_serializer


def _utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Serialize datetime as UTC ISO-8601 with explicit 'Z' suffix.

    SQLite/PostgreSQL store our timestamps as naive UTC. Without this,
    Pydantic serializes them without a timezone marker and JS Date()
    on the frontend interprets them as local time, breaking
    `Date.now() - timestamp` calculations (e.g. stale-data detection).
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")

try:
    from backend.connectors import (
        GoodWeConnector,
        HuaweiFusionSolarConnector,
        SMAConnector,
        SungrowICloudConnector,
    )
    from backend.importers import import_energydata_dataset
except ModuleNotFoundError:
    from connectors import (
        GoodWeConnector,
        HuaweiFusionSolarConnector,
        SMAConnector,
        SungrowICloudConnector,
    )
    from importers import import_energydata_dataset

# === Cấu hình ===
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./solar.db")
ENABLE_BACKGROUND_TELEMETRY = os.getenv("ENABLE_BACKGROUND_TELEMETRY", "1") == "1"
TELEMETRY_INTERVAL_SECONDS = int(os.getenv("TELEMETRY_INTERVAL_SECONDS", "5"))
ENABLE_MQTT_CONSUMER = os.getenv("ENABLE_MQTT_CONSUMER", "0") == "1"
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "solar/inverters/#")
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "solar-dashboard-backend")
MQTT_TLS_ENABLED = os.getenv("MQTT_TLS_ENABLED", "0") == "1"
MQTT_TLS_INSECURE = os.getenv("MQTT_TLS_INSECURE", "0") == "1"
MQTT_AUTO_CREATE_INVERTER = os.getenv("MQTT_AUTO_CREATE_INVERTER", "1") == "1"
logger = logging.getLogger("solar-backend")
MQTT_CONNECTION_STATE = {"connected": False}

# === Database ===
is_sqlite = DATABASE_URL.startswith("sqlite")
engine_kwargs = {"connect_args": {"check_same_thread": False}} if is_sqlite else {}
engine = create_engine(DATABASE_URL, **engine_kwargs)
Base = declarative_base()
SessionLocal = sessionmaker(bind=engine)


class Inverter(Base):
    __tablename__ = "inverters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    ip_address = Column(String)
    device_type = Column(String)
    status = Column(String, default="offline")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Per-site alert thresholds. Power threshold is in kW, temperature in °C, offline in minutes.
    alert_temp_max = Column(Float, default=70.0)
    alert_power_min = Column(Float, default=0.0)
    alert_offline_mins = Column(Integer, default=5)


class InverterData(Base):
    __tablename__ = "inverter_data"
    id = Column(Integer, primary_key=True, index=True)
    inverter_id = Column(Integer, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    voltage = Column(Float, nullable=True)
    current = Column(Float, nullable=True)
    power = Column(Float, nullable=True)
    energy_today = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    error_code = Column(String, nullable=True)
    is_online = Column(Boolean, default=True)


class WeatherObservation(Base):
    __tablename__ = "weather_observations"
    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String, nullable=False, index=True)
    station_id = Column(String, nullable=True, index=True)
    station_name = Column(String, nullable=True, index=True)
    observed_at = Column(DateTime, nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    solar_radiation = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    wind_speed = Column(Float, nullable=True)
    pressure = Column(Float, nullable=True)
    raw_payload = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SourceSyncLog(Base):
    __tablename__ = "source_sync_logs"
    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String, nullable=False, index=True)
    sync_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="running")
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    finished_at = Column(DateTime, nullable=True)
    records_processed = Column(Integer, default=0)
    message = Column(String, nullable=True)


class InverterCreate(BaseModel):
    name: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = "generic"
    alert_temp_max: Optional[float] = 70.0
    alert_power_min: Optional[float] = 0.0
    alert_offline_mins: Optional[int] = 5


class InverterUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = None
    alert_temp_max: Optional[float] = None
    alert_power_min: Optional[float] = None
    alert_offline_mins: Optional[int] = None


class InverterResponse(InverterCreate):
    id: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def _ser_created_at(self, dt: datetime) -> str:
        return _utc_iso(dt)  # type: ignore[return-value]


class InverterDataResponse(BaseModel):
    id: int
    inverter_id: int
    timestamp: datetime
    voltage: Optional[float]
    current: Optional[float]
    power: Optional[float]
    energy_today: Optional[float]
    temperature: Optional[float]
    error_code: Optional[str]
    is_online: bool

    model_config = {"from_attributes": True}

    @field_serializer("timestamp")
    def _ser_timestamp(self, dt: datetime) -> str:
        return _utc_iso(dt)  # type: ignore[return-value]


class StatsOverviewResponse(BaseModel):
    total_inverters: int
    online_inverters: int
    offline_inverters: int
    total_power: float
    total_energy_today: float
    last_updated: Optional[datetime]

    @field_serializer("last_updated")
    def _ser_last_updated(self, dt: Optional[datetime]) -> Optional[str]:
        return _utc_iso(dt)


class StatsHistoryPoint(BaseModel):
    timestamp: datetime
    inverter_id: Optional[int] = None
    power: float = 0.0
    energy_today: float = 0.0
    is_online: Optional[bool] = None

    @field_serializer("timestamp")
    def _ser_timestamp(self, dt: datetime) -> str:
        return _utc_iso(dt)  # type: ignore[return-value]


class StatsHistoryResponse(BaseModel):
    scope: str
    hours: int
    points: List[StatsHistoryPoint]


class TelemetryReadingIn(BaseModel):
    inverter_id: int
    timestamp: Optional[datetime] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    power: Optional[float] = None
    energy_today: Optional[float] = None
    temperature: Optional[float] = None
    error_code: Optional[str] = None
    is_online: Optional[bool] = None


class WeatherObservationResponse(BaseModel):
    id: int
    source_name: str
    station_id: Optional[str]
    station_name: Optional[str]
    observed_at: datetime
    latitude: Optional[float]
    longitude: Optional[float]
    solar_radiation: Optional[float]
    temperature: Optional[float]
    wind_speed: Optional[float]
    pressure: Optional[float]
    raw_payload: Optional[str]

    model_config = {"from_attributes": True}

    @field_serializer("observed_at")
    def _ser_observed_at(self, dt: datetime) -> str:
        return _utc_iso(dt)  # type: ignore[return-value]


class SourceSyncLogResponse(BaseModel):
    id: int
    source_name: str
    sync_type: str
    status: str
    started_at: datetime
    finished_at: Optional[datetime]
    records_processed: int
    message: Optional[str]

    model_config = {"from_attributes": True}

    @field_serializer("started_at")
    def _ser_started_at(self, dt: datetime) -> str:
        return _utc_iso(dt)  # type: ignore[return-value]

    @field_serializer("finished_at")
    def _ser_finished_at(self, dt: Optional[datetime]) -> Optional[str]:
        return _utc_iso(dt)


class EnergyDataImportRequest(BaseModel):
    source_url: Optional[str] = None
    file_path: Optional[str] = None
    limit: Optional[int] = None


class EnergyDataImportResponse(BaseModel):
    source_name: str
    loaded_from: str
    records_processed: int
    stations: List[str]
    matched_columns: Dict[str, str]
    sync_log_id: Optional[int]


class ConnectorCapabilityResponse(BaseModel):
    source_name: str
    auth_requirements: Dict[str, Any]
    implementation_status: str


# Inverter catalog for setup guide
class InverterCatalogEntry(BaseModel):
    id: str
    brand: str
    model: str
    power_kw: float
    protocol: str
    default_port: Optional[int] = None
    mqtt_topic_pattern: Optional[str] = None
    api_endpoint: Optional[str] = None
    setup_steps: List[str]
    notes: Optional[str] = None


# Hardcoded catalog of common inverter models with setup instructions
# Stored as plain dicts; FastAPI will coerce to InverterCatalogEntry via response_model
INVERTER_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "goodwe-sdt-g2",
        "brand": "GoodWe",
        "model": "SDT G2 Series",
        "power_kw": 5.0,
        "protocol": "SEMS API",
        "default_port": 10050,
        "api_endpoint": "https://semsportal.com/api",
        "mqtt_topic_pattern": None,
        "setup_steps": [
            "1. Đăng ký tài khoản SEMS Portal tại https://semsportal.com",
            "2. Thêm inverter vào SEMS Portal bằng serial number (mặt sau thiết bị)",
            "3. Kết nối inverter với mạng internet qua Ethernet hoặc WiFi",
            "4. Đợi inverter xuất hiện trong SEMS Portal (thường mất 1-5 phút)",
            "5. Tạo API token trong Settings → API Key",
            "6. Copy API token vào hệ thống Solar Dashboard",
            "7. Điền Serial Number và Station ID từ SEMS Portal",
            "8. Test connection để xác nhận dữ liệu nhận được",
        ],
        "notes": "GoodWe SDT G2 hỗ trợ cả Ethernet và WiFi. Nên dùng Ethernet cho độ ổn định cao hơn.",
    },
    {
        "id": "huawei-sun2000",
        "brand": "Huawei",
        "model": "SUN2000 Series",
        "power_kw": 5.0,
        "protocol": "Modbus TCP",
        "default_port": 502,
        "api_endpoint": None,
        "mqtt_topic_pattern": None,
        "setup_steps": [
            "1. Kết nối máy tính với inverter qua Ethernet (cùng mạng LAN)",
            "2. Mở trình duyệt, truy cập http://192.168.1.1 (default IP inverter)",
            "3. Login (default: admin/Admin@123)",
            "4. Vào Settings → Network → Modbus TCP",
            "5. Bật Modbus TCP, port mặc định 502",
            "6. Lưu cấu hình và reboot inverter",
            "7. Trong Solar Dashboard, điền IP inverter và port 502",
            "8. Điền Device ID (thường là 1)",
            "9. Test connection để đọc dữ liệu",
        ],
        "notes": "Huawei SUN2000 dùng Modbus TCP. Đảm bảo firewall không chặn port 502.",
    },
    {
        "id": "sungrow-sg5ktl",
        "brand": "Sungrow",
        "model": "SG5KTL-M / SH5K-20",
        "power_kw": 5.0,
        "protocol": "iSolarCloud / MQTT",
        "default_port": 8899,
        "api_endpoint": None,
        "mqtt_topic_pattern": "/solar/{serial}/telemetry",
        "setup_steps": [
            "1. Đăng ký tài khoản iSolarCloud tại https://www.isolarcloud.com",
            "2. Thêm inverter bằng serial number",
            "3. Cấu hình MQTT broker trong iSolarCloud Settings",
            "4. Lấy MQTT broker address, port, username, password",
            "5. Trong Solar Dashboard, chọn protocol MQTT",
            "6. Điền MQTT broker info: host, port, username, password",
            "7. Topic pattern: /solar/{serial}/telemetry",
            "8. Test connection",
        ],
        "notes": "Sungrow hỗ trợ cả iSolarCloud API và MQTT. MQTT realtime hơn.",
    },
    {
        "id": "sma-sunny-boy",
        "brand": "SMA",
        "model": "Sunny Boy 5.0",
        "power_kw": 5.0,
        "protocol": "SMA Speedwire / Modbus",
        "default_port": 502,
        "api_endpoint": "https://www.sunnyportal.com",
        "mqtt_topic_pattern": None,
        "setup_steps": [
            "1. Kết nối Sunny WebBox hoặc Sunny Home Manager với inverter",
            "2. Đăng ký tài khoản Sunny Portal",
            "3. Thêm WebBox vào Sunny Portal",
            "4. Trong Solar Dashboard, dùng SMA Speedwire hoặc Modbus TCP",
            "5. Nếu Modbus: port 502, Device ID = 1",
            "6. Nếu Sunny Portal API: lấy API key từ Sunny Portal",
            "7. Test connection",
        ],
        "notes": "SMA có nhiều cách kết nối. Sunny WebBox cho độ ổn định cao nhất.",
    },
    {
        "id": "fronius-galvo",
        "brand": "Fronius",
        "model": "Galvo / Primo",
        "power_kw": 5.0,
        "protocol": "Fronius Solar API / Modbus",
        "default_port": 502,
        "api_endpoint": "http://{ip}/solar_api/v1/GetInverterRealtimeData.cgi",
        "mqtt_topic_pattern": None,
        "setup_steps": [
            "1. Kết nối máy tính với inverter qua Ethernet",
            "2. Truy cập http://192.168.0.1 (default IP)",
            "3. Login (default: admin)",
            "4. Vào Settings → Communication → Fronius Solar API",
            "5. Bật Solar API, port mặc định 80",
            "6. Trong Solar Dashboard, chọn protocol Fronius Solar API",
            "7. Điền IP inverter",
            "8. Test connection",
        ],
        "notes": "Fronius Solar API đơn giản hơn Modbus. Port mặc định 80 (HTTP).",
    },
    {
        "id": "solaredge-optim",
        "brand": "SolarEdge",
        "model": "SE5000H",
        "power_kw": 5.0,
        "protocol": "SolarEdge Monitoring API",
        "default_port": None,
        "api_endpoint": "https://monitoringapi.solaredge.com",
        "mqtt_topic_pattern": None,
        "setup_steps": [
            "1. Đăng ký tài khoản SolarEdge Monitoring Portal",
            "2. Thêm inverter bằng serial number",
            "3. Tạo API key trong Settings → API Keys",
            "4. Trong Solar Dashboard, chọn protocol SolarEdge API",
            "5. Điền API key và Site ID từ SolarEdge Portal",
            "6. Test connection",
        ],
        "notes": "SolarEdge dùng cloud API, không kết nối trực tiếp local.",
    },
    {
        "id": "generic-modbus",
        "brand": "Generic",
        "model": "Modbus TCP Inverter",
        "power_kw": 5.0,
        "protocol": "Modbus TCP",
        "default_port": 502,
        "api_endpoint": None,
        "mqtt_topic_pattern": None,
        "setup_steps": [
            "1. Kết nối máy tính với inverter qua Ethernet",
            "2. Xác định IP inverter (thường in trên mặt sau thiết bị)",
            "3. Ping IP để xác nhận kết nối",
            "4. Trong Solar Dashboard, chọn protocol Modbus TCP",
            "5. Điền IP inverter, port (mặc định 502), Device ID (thường 1)",
            "6. Test connection",
            "7. Nếu fail, kiểm tra Modbus register mapping trong manual",
        ],
        "notes": "Generic Modbus cần register mapping cụ thể theo từng hãng. Xem manual inverter.",
    },
]


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, payload: dict):
        if not self.active_connections:
            return

        stale_connections: list[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(payload)
            except Exception:
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(connection)


manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await on_startup()
    yield
    await on_shutdown()

app = FastAPI(title="Solar Dashboard API", lifespan=lifespan)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def model_dump_compat(model: BaseModel, **kwargs):
    if hasattr(model, "model_dump"):
        return model.model_dump(**kwargs)
    return model.dict(**kwargs)


def serialize_reading(reading: InverterData) -> dict:
    return jsonable_encoder(
        {
            "id": reading.id,
            "inverter_id": reading.inverter_id,
            "timestamp": _utc_iso(reading.timestamp),
            "voltage": reading.voltage,
            "current": reading.current,
            "power": reading.power,
            "energy_today": reading.energy_today,
            "temperature": reading.temperature,
            "error_code": reading.error_code,
            "is_online": reading.is_online,
        }
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_connector_capabilities() -> list[dict[str, Any]]:
    connectors = [
        GoodWeConnector(),
        HuaweiFusionSolarConnector(),
        SungrowICloudConnector(),
        SMAConnector(),
    ]
    return [
        {
            "source_name": connector.source_name,
            "auth_requirements": connector.describe_auth_requirements(),
            "implementation_status": "stub",
        }
        for connector in connectors
    ]


def import_energydata_into_db(
    db: Session,
    *,
    source_url: Optional[str] = None,
    file_path: Optional[str] = None,
    limit: Optional[int] = None,
) -> dict[str, Any]:
    if bool(source_url) == bool(file_path):
        raise ValueError("Provide exactly one of source_url or file_path")

    requested_limit = None if limit is None else max(1, min(limit, 10000))
    sync_log = SourceSyncLog(
        source_name="energydata",
        sync_type="import",
        status="running",
        message=source_url or file_path,
    )
    db.add(sync_log)
    db.commit()
    db.refresh(sync_log)

    try:
        result = import_energydata_dataset(source_url=source_url, file_path=file_path, limit=requested_limit)
        rows = [
            WeatherObservation(
                source_name=observation["source_name"],
                station_id=observation["station_id"],
                station_name=observation["station_name"],
                observed_at=observation["observed_at"],
                latitude=observation["latitude"],
                longitude=observation["longitude"],
                solar_radiation=observation["solar_radiation"],
                temperature=observation["temperature"],
                wind_speed=observation["wind_speed"],
                pressure=observation["pressure"],
                raw_payload=json.dumps(observation["raw_payload"], ensure_ascii=False),
            )
            for observation in result.observations
        ]
        if rows:
            db.add_all(rows)

        sync_log.status = "success"
        sync_log.finished_at = utcnow()
        sync_log.records_processed = result.records_processed
        sync_log.message = f"Imported from {result.loaded_from}"
        db.add(sync_log)
        db.commit()
        db.refresh(sync_log)

        return {
            "source_name": result.source_name,
            "loaded_from": result.loaded_from,
            "records_processed": result.records_processed,
            "stations": result.stations,
            "matched_columns": result.matched_columns,
            "sync_log_id": sync_log.id,
        }
    except Exception as exc:
        db.rollback()
        sync_log.status = "failed"
        sync_log.finished_at = utcnow()
        sync_log.records_processed = 0
        sync_log.message = str(exc)
        db.add(sync_log)
        db.commit()
        raise


def seed_mock_history(db: Session, inverter_id: int, points: int = 24):
    now = utcnow()
    rows = []
    for index in range(points):
        ts = now - timedelta(hours=points - index - 1)
        solar_factor = max(0.0, math.sin(((ts.hour + ts.minute / 60) - 6) / 12 * math.pi))
        power = round(450 + solar_factor * 4550, 2)
        rows.append(
            InverterData(
                inverter_id=inverter_id,
                timestamp=ts,
                voltage=round(220 + solar_factor * 8, 2),
                current=round(2.2 + solar_factor * 18, 2),
                power=power,
                energy_today=round((index + 1) * max(power, 200) / 1000 / 4, 2),
                temperature=round(28 + solar_factor * 16, 2),
                error_code=None,
                is_online=solar_factor > 0.08,
            )
        )
    db.add_all(rows)
    db.commit()


def compute_stats_overview(db: Session) -> dict:
    inverters = db.query(Inverter).all()
    latest_by_inverter = {}

    rows = (
        db.query(InverterData)
        .order_by(InverterData.inverter_id.asc(), InverterData.timestamp.desc())
        .all()
    )
    for row in rows:
        if row.inverter_id not in latest_by_inverter:
            latest_by_inverter[row.inverter_id] = row

    online_inverters = 0
    total_power = 0.0
    total_energy_today = 0.0
    last_updated = None

    for inverter in inverters:
        latest = latest_by_inverter.get(inverter.id)
        is_online = latest.is_online if latest else inverter.status == "online"
        if is_online:
            online_inverters += 1

        if latest:
            total_power += latest.power or 0.0
            total_energy_today += latest.energy_today or 0.0
            if last_updated is None or latest.timestamp > last_updated:
                last_updated = latest.timestamp

    total_inverters = len(inverters)
    return {
        "total_inverters": total_inverters,
        "online_inverters": online_inverters,
        "offline_inverters": total_inverters - online_inverters,
        "total_power": round(total_power, 2),
        "total_energy_today": round(total_energy_today, 2),
        # Keep raw datetime so Pydantic StatsOverviewResponse.field_serializer can convert it
        # for HTTP responses, and convert manually when broadcast over WebSocket.
        "last_updated": last_updated,
    }


def check_and_send_alerts(inverter: Inverter, reading: InverterData):
    alerts = []
    
    if not reading.is_online:
        alerts.append(("critical", f"Inverter `{inverter.name}` bị mất kết nối (OFFLINE)."))
    
    if reading.temperature is not None and inverter.alert_temp_max is not None:
        if reading.temperature >= inverter.alert_temp_max:
            alerts.append(("warning", f"Nhiệt độ inverter `{inverter.name}` quá cao: {reading.temperature}°C (ngưỡng: {inverter.alert_temp_max}°C)."))
            
    if reading.power is not None and inverter.alert_power_min is not None and reading.power < inverter.alert_power_min:
        alerts.append(("warning", f"Công suất inverter `{inverter.name}` quá thấp: {reading.power}W (ngưỡng: {inverter.alert_power_min}W)."))
        
    for level, msg in alerts:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(send_telegram_alert(msg, level))
        except RuntimeError:
            asyncio.run(send_telegram_alert(msg, level))

def persist_telemetry(db: Session, inverter: Inverter, payload: TelemetryReadingIn) -> InverterData:
    is_online = payload.is_online
    if is_online is None:
        is_online = (payload.power or 0) > 50

    reading = InverterData(
        inverter_id=inverter.id,
        timestamp=payload.timestamp or utcnow(),
        voltage=payload.voltage,
        current=payload.current,
        power=payload.power,
        energy_today=payload.energy_today,
        temperature=payload.temperature,
        error_code=payload.error_code,
        is_online=is_online,
    )

    inverter.status = "online" if is_online else "offline"
    db.add(inverter)
    db.add(reading)
    db.commit()
    db.refresh(reading)
    
    check_and_send_alerts(inverter, reading)
    
    return reading


def build_telemetry_message(db: Session, reading: InverterData) -> dict:
    overview = compute_stats_overview(db)
    overview["last_updated"] = _utc_iso(overview.get("last_updated"))
    return {
        "type": "telemetry",
        "reading": serialize_reading(reading),
        "stats_overview": jsonable_encoder(overview),
    }


def parse_optional_timestamp(value: Any) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        raise ValueError("timestamp must be an ISO-8601 string or datetime")

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def normalize_mqtt_payload(message_payload: bytes | str | dict) -> dict:
    if isinstance(message_payload, bytes):
        payload = json.loads(message_payload.decode("utf-8"))
    elif isinstance(message_payload, str):
        payload = json.loads(message_payload)
    elif isinstance(message_payload, dict):
        payload = dict(message_payload)
    else:
        raise ValueError("Unsupported MQTT payload type")

    if not isinstance(payload, dict):
        raise ValueError("MQTT payload must be a JSON object")

    normalized = dict(payload)
    nested_reading = next(
        (payload[key] for key in ("telemetry", "reading", "payload", "data") if isinstance(payload.get(key), dict)),
        None,
    )
    if nested_reading:
        normalized = {**normalized, **nested_reading}

    inverter_meta = payload.get("inverter") if isinstance(payload.get("inverter"), dict) else {}
    if inverter_meta:
        normalized = {**inverter_meta, **normalized}
        if "id" in inverter_meta and "inverter_id" not in normalized:
            normalized["inverter_id"] = inverter_meta["id"]

    if "timestamp" in normalized:
        normalized["timestamp"] = parse_optional_timestamp(normalized.get("timestamp"))

    return normalized


def resolve_inverter_for_mqtt(db: Session, payload: dict) -> Inverter:
    inverter = None
    inverter_id = payload.get("inverter_id")
    if inverter_id is not None:
        inverter = db.query(Inverter).filter(Inverter.id == inverter_id).first()
        if not inverter:
            raise ValueError(f"Inverter id={inverter_id} not found for MQTT payload")
        return inverter

    ip_address = payload.get("ip_address")
    name = payload.get("name")

    if ip_address:
        inverter = db.query(Inverter).filter(Inverter.ip_address == ip_address).first()
    if not inverter and name:
        inverter = db.query(Inverter).filter(Inverter.name == name).first()
    if inverter:
        return inverter

    if not MQTT_AUTO_CREATE_INVERTER:
        raise ValueError("MQTT payload does not map to an existing inverter and auto-create is disabled")

    inverter = Inverter(
        name=name or f"MQTT Inverter {ip_address or utcnow().strftime('%H%M%S')}",
        location=payload.get("location"),
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        ip_address=ip_address,
        device_type=payload.get("device_type") or "generic",
        status="online" if payload.get("is_online", True) else "offline",
    )
    db.add(inverter)
    db.commit()
    db.refresh(inverter)
    return inverter


def ingest_mqtt_payload(message_payload: bytes | str | dict, db: Session) -> InverterData:
    payload = normalize_mqtt_payload(message_payload)
    inverter = resolve_inverter_for_mqtt(db, payload)
    telemetry = TelemetryReadingIn(
        inverter_id=inverter.id,
        timestamp=payload.get("timestamp"),
        voltage=payload.get("voltage"),
        current=payload.get("current"),
        power=payload.get("power"),
        energy_today=payload.get("energy_today"),
        temperature=payload.get("temperature"),
        error_code=payload.get("error_code"),
        is_online=payload.get("is_online"),
    )
    return persist_telemetry(db, inverter, telemetry)


def start_mqtt_consumer(event_loop: asyncio.AbstractEventLoop):
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=MQTT_CLIENT_ID,
        protocol=mqtt.MQTTv311,
    )
    client.enable_logger(logger)
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD or "")
    if MQTT_TLS_ENABLED:
        client.tls_set()
        client.tls_insecure_set(MQTT_TLS_INSECURE)

    logger.info(
        "Starting MQTT consumer client_id=%s broker=%s:%s topic=%s",
        MQTT_CLIENT_ID,
        MQTT_BROKER,
        MQTT_PORT,
        MQTT_TOPIC,
    )

    def on_connect(client, userdata, flags, reason_code, properties=None):
        print(f"[MQTT] on_connect called: reason_code={reason_code}", flush=True)
        reason_value = getattr(reason_code, "value", reason_code)
        if reason_value == 0:
            MQTT_CONNECTION_STATE["connected"] = True
            logger.info("MQTT connected to %s:%s, subscribing %s", MQTT_BROKER, MQTT_PORT, MQTT_TOPIC)
            result, mid = client.subscribe(MQTT_TOPIC)
            print(f"[MQTT] subscribe result={result} mid={mid}", flush=True)
            logger.info("MQTT subscribe result=%s mid=%s", result, mid)
            return
        logger.error("MQTT connection failed with reason_code=%s", reason_code)

    def on_subscribe(client, userdata, mid, granted_qos, properties=None):
        print(f"[MQTT] on_subscribe mid={mid} qos={granted_qos}", flush=True)
        logger.info("MQTT subscribed mid=%s qos=%s", mid, granted_qos)

    def on_disconnect(client, userdata, reason_code, properties=None):
        MQTT_CONNECTION_STATE["connected"] = False
        logger.warning("MQTT disconnected reason_code=%s", reason_code)

    def on_log(client, userdata, level, buf):
        logger.info("MQTT client log level=%s msg=%s", level, buf)

    def on_message(client, userdata, message):
        print(f"[MQTT] on_message topic={message.topic}", flush=True)
        db = SessionLocal()
        try:
            payload_preview = message.payload[:300].decode("utf-8", errors="replace")
            print(f"[MQTT] payload={payload_preview}", flush=True)
            logger.info("MQTT message topic=%s payload=%s", message.topic, payload_preview)
            reading = ingest_mqtt_payload(message.payload, db)
            print(f"[MQTT] ingest success inverter_id={reading.inverter_id} reading_id={reading.id}", flush=True)
            logger.info("MQTT ingest success inverter_id=%s reading_id=%s", reading.inverter_id, reading.id)
            telemetry_message = build_telemetry_message(db, reading)
            future = asyncio.run_coroutine_threadsafe(manager.broadcast(telemetry_message), event_loop)
            future.add_done_callback(lambda task: task.exception() and logger.error("MQTT broadcast failed: %s", task.exception()))
        except Exception as e:
            print(f"[MQTT] ingest failed: {e}", flush=True)
            db.rollback()
            logger.exception("Failed to ingest MQTT payload from topic %s", message.topic)
        finally:
            db.close()

    client.on_connect = on_connect
    client.on_subscribe = on_subscribe
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    client.on_log = on_log
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)

    loop_thread = threading.Thread(target=client.loop_forever, kwargs={"retry_first_connection": True}, daemon=True, name="mqtt-loop")
    loop_thread.start()
    client._loop_thread = loop_thread
    return client


def generate_simulated_telemetry(inverter: Inverter) -> TelemetryReadingIn:
    now = utcnow()
    hour_fraction = now.hour + now.minute / 60 + now.second / 3600
    phase_shift = (inverter.id % 5) * 0.25
    solar_factor = max(0.0, math.sin(((hour_fraction - 6 + phase_shift) / 12) * math.pi))
    device_factor = {
        "solaredge": 0.92,
        "sungrow": 1.0,
        "goodwe": 0.88,
    }.get((inverter.device_type or "generic").lower(), 0.95)
    noise = math.sin(now.timestamp() / 18 + inverter.id) * 110
    power = round(max(0.0, 180 + solar_factor * 4650 * device_factor + noise), 2)
    voltage = round(220 + math.sin(now.timestamp() / 40 + inverter.id) * 4 + solar_factor * 6, 2)
    current = round(power / voltage, 2) if voltage > 0 else 0.0
    daylight_hours = max(0.0, min(12.0, hour_fraction - 6))
    energy_today = round(max(0.0, daylight_hours * (0.42 + solar_factor * 0.38) * device_factor), 2)
    temperature = round(27 + solar_factor * 18 + (inverter.id % 3) * 1.4 + abs(noise) * 0.01, 2)
    is_online = power > 80

    return TelemetryReadingIn(
        inverter_id=inverter.id,
        timestamp=now,
        voltage=voltage,
        current=current,
        power=power,
        energy_today=energy_today,
        temperature=temperature,
        error_code=None,
        is_online=is_online,
    )


async def simulated_telemetry_loop():
    while True:
        db = SessionLocal()
        try:
            inverters = db.query(Inverter).all()
            for inverter in inverters:
                payload = generate_simulated_telemetry(inverter)
                reading = persist_telemetry(db, inverter, payload)
                await manager.broadcast(build_telemetry_message(db, reading))
        except Exception:
            db.rollback()
        finally:
            db.close()

        await asyncio.sleep(TELEMETRY_INTERVAL_SECONDS)


def _ensure_alert_columns():
    """Lightweight migration: add alert_* columns to legacy `inverters` tables.

    create_all() does not ALTER existing tables, so deployments created before
    the alert thresholds were added would otherwise be missing these columns.
    """
    column_specs = {
        "alert_temp_max": "FLOAT DEFAULT 70.0",
        "alert_power_min": "FLOAT DEFAULT 0.0",
        "alert_offline_mins": "INTEGER DEFAULT 5",
    }
    with engine.begin() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(inverters)").fetchall()} if is_sqlite else None
        if existing is None:
            existing = {
                row[0]
                for row in conn.exec_driver_sql(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='inverters'"
                ).fetchall()
            }
        for name, ddl in column_specs.items():
            if name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE inverters ADD COLUMN {name} {ddl}")


async def on_startup():
    Base.metadata.create_all(bind=engine)
    try:
        _ensure_alert_columns()
    except Exception as exc:  # pragma: no cover - best-effort migration
        logger.warning("alert column migration skipped: %s", exc)
    app.state.event_loop = asyncio.get_running_loop()

    db = SessionLocal()
    try:
        if db.query(Inverter).count() == 0:
            demo = Inverter(
                name="Inverter Demo 01",
                location="Solar Việt Nam - Showroom",
                latitude=10.7626,
                longitude=106.6602,
                ip_address="192.168.1.88",
                device_type="sungrow",
                status="online",
            )
            db.add(demo)
            db.commit()
            db.refresh(demo)
            seed_mock_history(db, demo.id)
    finally:
        db.close()

    app.state.telemetry_task = None
    app.state.mqtt_client = None
    if ENABLE_BACKGROUND_TELEMETRY:
        app.state.telemetry_task = asyncio.create_task(simulated_telemetry_loop())
    if ENABLE_MQTT_CONSUMER:
        app.state.mqtt_client = start_mqtt_consumer(app.state.event_loop)


async def on_shutdown():
    task = getattr(app.state, "telemetry_task", None)
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

    mqtt_client = getattr(app.state, "mqtt_client", None)
    if mqtt_client:
        with suppress(Exception):
            mqtt_client.disconnect()
        loop_thread = getattr(mqtt_client, "_loop_thread", None)
        if loop_thread:
            loop_thread.join(timeout=2)


app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("API_CORS_ORIGINS", "https://solar-dashboard-rouge.vercel.app,https://app.solarvn.com").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Solar Dashboard API", "version": "1.2.0"}


@app.get("/healthz")
def healthz(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "db": "connected",
        "background_telemetry": ENABLE_BACKGROUND_TELEMETRY,
        "mqtt_consumer_enabled": ENABLE_MQTT_CONSUMER,
        "mqtt_topic": MQTT_TOPIC if ENABLE_MQTT_CONSUMER else None,
        "mqtt_connected": MQTT_CONNECTION_STATE["connected"] if ENABLE_MQTT_CONSUMER else None,
        "mqtt_tls_enabled": MQTT_TLS_ENABLED if ENABLE_MQTT_CONSUMER else None,
    }


@app.get("/inverters", response_model=List[InverterResponse])
def list_inverters(db: Session = Depends(get_db)):
    return db.query(Inverter).all()


@app.get("/inverters/catalog", response_model=List[InverterCatalogEntry])
def get_inverter_catalog(
    search: Optional[str] = None,
    brand: Optional[str] = None,
    protocol: Optional[str] = None,
):
    """Return inverter catalog with optional search/filter.

    - search: filter by model name or brand (case-insensitive)
    - brand: filter by exact brand name
    - protocol: filter by exact protocol name
    """
    filtered = INVERTER_CATALOG
    if search:
        search_lower = search.lower()
        filtered = [e for e in filtered if search_lower in e["brand"].lower() or search_lower in e["model"].lower()]
    if brand:
        filtered = [e for e in filtered if e["brand"].lower() == brand.lower()]
    if protocol:
        filtered = [e for e in filtered if e["protocol"].lower() == protocol.lower()]
    return filtered


@app.post("/inverters", response_model=InverterResponse)
def create_inverter(inverter: InverterCreate, db: Session = Depends(get_db)):
    db_inverter = Inverter(**model_dump_compat(inverter), status="online")
    db.add(db_inverter)
    db.commit()
    db.refresh(db_inverter)
    seed_mock_history(db, db_inverter.id, points=12)
    return db_inverter


@app.get("/inverters/{inverter_id}", response_model=InverterResponse)
def get_inverter(inverter_id: int, db: Session = Depends(get_db)):
    inverter = db.query(Inverter).filter(Inverter.id == inverter_id).first()
    if not inverter:
        raise HTTPException(status_code=404, detail="Inverter not found")
    return inverter


@app.put("/inverters/{inverter_id}", response_model=InverterResponse)
def update_inverter(inverter_id: int, payload: InverterUpdate, db: Session = Depends(get_db)):
    inverter = db.query(Inverter).filter(Inverter.id == inverter_id).first()
    if not inverter:
        raise HTTPException(status_code=404, detail="Inverter not found")

    update_data = model_dump_compat(payload, exclude_unset=True)
    for field, value in update_data.items():
        setattr(inverter, field, value)

    db.add(inverter)
    db.commit()
    db.refresh(inverter)
    return inverter


@app.get("/inverters/{inverter_id}/data", response_model=List[InverterDataResponse])
def get_inverter_data(inverter_id: int, limit: int = 100, db: Session = Depends(get_db)):
    inverter = db.query(Inverter).filter(Inverter.id == inverter_id).first()
    if not inverter:
        raise HTTPException(status_code=404, detail="Inverter not found")

    return (
        db.query(InverterData)
        .filter(InverterData.inverter_id == inverter_id)
        .order_by(InverterData.timestamp.desc())
        .limit(limit)
        .all()
    )


@app.delete("/inverters/{inverter_id}")
def delete_inverter(inverter_id: int, db: Session = Depends(get_db)):
    inverter = db.query(Inverter).filter(Inverter.id == inverter_id).first()
    if not inverter:
        raise HTTPException(status_code=404, detail="Inverter not found")

    db.query(InverterData).filter(InverterData.inverter_id == inverter_id).delete()
    db.delete(inverter)
    db.commit()
    return {"ok": True}


@app.get("/inverters/{inverter_id}/latest", response_model=InverterDataResponse)
async def get_latest_data(inverter_id: int, db: Session = Depends(get_db)):
    latest = (
        db.query(InverterData)
        .filter(InverterData.inverter_id == inverter_id)
        .order_by(InverterData.timestamp.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No data for inverter")
    return latest


@app.post("/telemetry/readings", response_model=InverterDataResponse)
async def ingest_telemetry(payload: TelemetryReadingIn, db: Session = Depends(get_db)):
    inverter = db.query(Inverter).filter(Inverter.id == payload.inverter_id).first()
    if not inverter:
        raise HTTPException(status_code=404, detail="Inverter not found")

    reading = persist_telemetry(db, inverter, payload)
    await manager.broadcast(build_telemetry_message(db, reading))
    return reading


@app.get("/stats/overview", response_model=StatsOverviewResponse)
def get_stats_overview(db: Session = Depends(get_db)):
    return compute_stats_overview(db)


@app.get("/stats/history", response_model=StatsHistoryResponse)
def get_stats_history(
    inverter_id: Optional[int] = None,
    hours: int = 24,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    hours = max(1, min(hours, 720))
    limit = max(1, min(limit, 500))
    since = utcnow() - timedelta(hours=hours)

    query = db.query(InverterData).filter(InverterData.timestamp >= since)

    if inverter_id is not None:
        inverter = db.query(Inverter).filter(Inverter.id == inverter_id).first()
        if not inverter:
            raise HTTPException(status_code=404, detail="Inverter not found")

        rows = (
            query.filter(InverterData.inverter_id == inverter_id)
            .order_by(InverterData.timestamp.asc())
            .limit(limit)
            .all()
        )
        points = [
            {
                "timestamp": row.timestamp,
                "inverter_id": row.inverter_id,
                "power": row.power or 0.0,
                "energy_today": row.energy_today or 0.0,
                "is_online": row.is_online,
            }
            for row in rows
        ]
        return {"scope": "inverter", "hours": hours, "points": points}

    rows = query.order_by(InverterData.timestamp.asc()).all()
    aggregated = {}
    for row in rows:
        bucket = aggregated.setdefault(
            row.timestamp,
            {
                "timestamp": row.timestamp,
                "inverter_id": None,
                "power": 0.0,
                "energy_today": 0.0,
                "is_online": None,
            },
        )
        bucket["power"] += row.power or 0.0
        bucket["energy_today"] += row.energy_today or 0.0

    points = list(aggregated.values())[-limit:]
    return {"scope": "fleet", "hours": hours, "points": points}


@app.get("/weather/observations", response_model=List[WeatherObservationResponse])
def list_weather_observations(limit: int = 100, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 500))
    return (
        db.query(WeatherObservation)
        .order_by(WeatherObservation.observed_at.desc(), WeatherObservation.id.desc())
        .limit(limit)
        .all()
    )


@app.get("/sources/sync-logs", response_model=List[SourceSyncLogResponse])
def list_source_sync_logs(limit: int = 50, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 200))
    return (
        db.query(SourceSyncLog)
        .order_by(SourceSyncLog.started_at.desc(), SourceSyncLog.id.desc())
        .limit(limit)
        .all()
    )


@app.get("/sources/connectors", response_model=List[ConnectorCapabilityResponse])
def list_source_connectors():
    return get_connector_capabilities()


@app.post("/imports/energydata", response_model=EnergyDataImportResponse)
def import_energydata(payload: EnergyDataImportRequest, db: Session = Depends(get_db)):
    try:
        return import_energydata_into_db(
            db,
            source_url=payload.source_url,
            file_path=payload.file_path,
            limit=payload.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.websocket("/ws/inverters")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
