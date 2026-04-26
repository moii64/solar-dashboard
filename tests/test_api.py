import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# --------------------------------------------------------------
# Force backend to use SQLite in tests before importing the app
# --------------------------------------------------------------
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["ENABLE_BACKGROUND_TELEMETRY"] = "0"
os.environ["ENABLE_MQTT_CONSUMER"] = "0"

from backend.main import app, get_db, Base, ingest_mqtt_payload  # noqa: E402
from backend.importers.energydata import parse_energydata_csv  # noqa: E402

# --------------------------------------------------------------
# Use one shared in-memory SQLite DB for the tests
# --------------------------------------------------------------
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Solar Dashboard API"
    assert body["version"] == "1.2.0"


def test_list_inverters_empty(client):
    response = client.get("/inverters")
    assert response.status_code == 200
    assert response.json() == []


def test_create_inverter(client):
    payload = {
        "name": "Demo-Inv-001",
        "location": "Hanoi-Site-A",
        "latitude": 21.0285,
        "longitude": 105.8542,
        "ip_address": "192.168.1.10",
        "device_type": "generic",
    }
    response = client.post("/inverters", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == payload["name"]
    assert data["id"] is not None
    assert data["status"] == "online"


def test_get_inverter(client):
    create_resp = client.post(
        "/inverters",
        json={
            "name": "Another-Demo-Inv",
            "location": "Da Nang-Site-B",
            "latitude": 16.0527,
            "longitude": 109.1822,
            "ip_address": "192.168.1.11",
            "device_type": "generic",
        },
    )
    created = create_resp.json()
    inverter_id = created["id"]

    response = client.get(f"/inverters/{inverter_id}")
    assert response.status_code == 200
    returned = response.json()
    assert returned["id"] == inverter_id
    assert returned["name"] == "Another-Demo-Inv"


def test_update_inverter(client):
    created = client.post(
        "/inverters",
        json={
            "name": "Update-Inv",
            "location": "Site-Old",
            "ip_address": "192.168.1.50",
            "device_type": "goodwe",
        },
    ).json()

    response = client.put(
        f"/inverters/{created['id']}",
        json={
            "name": "Update-Inv-Renamed",
            "location": "Site-New",
            "status": "maintenance",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Update-Inv-Renamed"
    assert data["location"] == "Site-New"
    assert data["status"] == "maintenance"
    assert data["ip_address"] == "192.168.1.50"


def test_get_latest_data(client):
    inv = client.post("/inverters", json={"name": "Mock-Latest-Inv"}).json()
    inv_id = inv["id"]
    resp = client.get(f"/inverters/{inv_id}/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["inverter_id"] == inv_id
    assert "timestamp" in data
    assert data["power"] is not None
    assert data["voltage"] is not None


def test_ingest_telemetry_updates_latest_and_overview(client):
    inv = client.post("/inverters", json={"name": "Realtime-Inv"}).json()
    inv_id = inv["id"]

    telemetry = {
        "inverter_id": inv_id,
        "voltage": 228.4,
        "current": 18.9,
        "power": 4321.5,
        "energy_today": 15.7,
        "temperature": 43.2,
        "is_online": True,
    }
    resp = client.post("/telemetry/readings", json=telemetry)
    assert resp.status_code == 200
    reading = resp.json()
    assert reading["inverter_id"] == inv_id
    assert reading["power"] == telemetry["power"]
    assert reading["temperature"] == telemetry["temperature"]

    latest = client.get(f"/inverters/{inv_id}/latest")
    assert latest.status_code == 200
    assert latest.json()["power"] == telemetry["power"]

    overview = client.get("/stats/overview")
    assert overview.status_code == 200
    overview_data = overview.json()
    assert overview_data["total_inverters"] == 1
    assert overview_data["online_inverters"] == 1
    assert overview_data["total_power"] == telemetry["power"]
    assert overview_data["total_energy_today"] == telemetry["energy_today"]


def test_stats_overview(client):
    client.post("/inverters", json={"name": "Overview-Inv-1"})
    client.post("/inverters", json={"name": "Overview-Inv-2"})

    response = client.get("/stats/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["total_inverters"] == 2
    assert data["online_inverters"] + data["offline_inverters"] == 2
    assert data["total_power"] > 0
    assert data["total_energy_today"] > 0
    assert data["last_updated"] is not None


def test_stats_history_for_fleet_and_single_inverter(client):
    first = client.post("/inverters", json={"name": "History-Inv-1"}).json()
    second = client.post("/inverters", json={"name": "History-Inv-2"}).json()

    fleet_resp = client.get("/stats/history", params={"hours": 24, "limit": 8})
    assert fleet_resp.status_code == 200
    fleet_data = fleet_resp.json()
    assert fleet_data["scope"] == "fleet"
    assert fleet_data["hours"] == 24
    assert 0 < len(fleet_data["points"]) <= 8
    assert fleet_data["points"][0]["inverter_id"] is None
    assert "timestamp" in fleet_data["points"][0]
    assert "power" in fleet_data["points"][0]

    single_resp = client.get(
        "/stats/history",
        params={"inverter_id": second["id"], "hours": 24, "limit": 5},
    )
    assert single_resp.status_code == 200
    single_data = single_resp.json()
    assert single_data["scope"] == "inverter"
    assert 0 < len(single_data["points"]) <= 5
    assert all(point["inverter_id"] == second["id"] for point in single_data["points"])
    assert first["id"] != second["id"]


def test_ingest_mqtt_payload_matches_existing_inverter_by_ip(client):
    inv = client.post(
        "/inverters",
        json={
            "name": "MQTT-Existing-Inv",
            "ip_address": "10.0.0.15",
            "device_type": "goodwe",
        },
    ).json()

    db = TestingSessionLocal()
    try:
        reading = ingest_mqtt_payload(
            {
                "ip_address": "10.0.0.15",
                "power": 3210.5,
                "voltage": 229.1,
                "current": 14.0,
                "energy_today": 11.4,
                "temperature": 41.8,
                "is_online": True,
            },
            db,
        )
    finally:
        db.close()

    assert reading.inverter_id == inv["id"]
    latest = client.get(f"/inverters/{inv['id']}/latest")
    assert latest.status_code == 200
    assert latest.json()["power"] == 3210.5


def test_ingest_mqtt_payload_auto_creates_inverter_from_nested_payload(client):
    db = TestingSessionLocal()
    try:
        reading = ingest_mqtt_payload(
            {
                "inverter": {
                    "name": "MQTT Auto Created",
                    "ip_address": "10.0.0.88",
                    "device_type": "sungrow",
                    "location": "Can Tho Hub",
                },
                "telemetry": {
                    "power": 1888.0,
                    "voltage": 227.6,
                    "current": 8.29,
                    "energy_today": 6.2,
                    "temperature": 39.5,
                    "is_online": True,
                },
            },
            db,
        )
    finally:
        db.close()

    latest = client.get(f"/inverters/{reading.inverter_id}/latest")
    assert latest.status_code == 200
    latest_data = latest.json()
    assert latest_data["power"] == 1888.0

    inverter = client.get(f"/inverters/{reading.inverter_id}")
    assert inverter.status_code == 200
    inverter_data = inverter.json()
    assert inverter_data["name"] == "MQTT Auto Created"
    assert inverter_data["ip_address"] == "10.0.0.88"


def test_parse_energydata_csv_flexible_columns():
    csv_content = """Station Name,Station ID,Date,Time,Latitude,Longitude,GHI (W/m2),Air Temperature,Wind Speed,Pressure\nHanoi Station,HN-01,2026-04-26,07:00,21.0285,105.8542,512.4,31.5,2.7,1007.9\n"""

    result = parse_energydata_csv(csv_content, loaded_from="memory://energydata.csv", limit=10)

    assert result.source_name == "energydata"
    assert result.records_processed == 1
    assert result.stations == ["Hanoi Station"]
    assert result.matched_columns["solar_radiation"] == "GHI (W/m2)"

    observation = result.observations[0]
    assert observation["station_id"] == "HN-01"
    assert observation["solar_radiation"] == 512.4
    assert observation["temperature"] == 31.5
    assert observation["wind_speed"] == 2.7
    assert observation["pressure"] == 1007.9


def test_parse_energydata_csv_real_energydata_comment_header():
    csv_content = """# Variables:\n# JulianTime,GTI_RefCell1_Wm-2_avg,GHI_ThPyra1_Wm-2_avg,Temp_ThHyg1_degC_avg,Pres_Logger1_hPa_avg,WindSpeed_Anemo1_ms_avg\n2017-10-01 00:00:00,110.835,129.639,26.6171,1007.12,1.88529\n"""

    result = parse_energydata_csv(
        csv_content,
        loaded_from="https://energydata.info/download/solar-measurements_vietnam_danang_wb-esmap_qc.csv",
        limit=10,
    )

    assert result.records_processed == 1
    assert result.matched_columns["observed_at"] == "JulianTime"
    assert result.matched_columns["solar_radiation"] == "GHI_ThPyra1_Wm-2_avg"
    observation = result.observations[0]
    assert observation["station_id"] == "VNDAN"
    assert observation["station_name"] == "VNDAN (Da Nang)"
    assert observation["solar_radiation"] == 129.639
    assert observation["temperature"] == 26.6171
    assert observation["pressure"] == 1007.12
    assert observation["wind_speed"] == 1.88529
    assert observation["latitude"] is None
    assert observation["longitude"] is None


def test_import_energydata_endpoint_persists_weather_and_sync_log(client, tmp_path: Path):
    csv_path = tmp_path / "energydata-sample.csv"
    csv_path.write_text(
        "station,date,time,lat,lon,solar radiation,temp,wind speed,pressure\n"
        "Da Nang Hub,2026-04-26,08:30,16.0544,108.2022,645.8,32.1,3.4,1005.2\n",
        encoding="utf-8",
    )

    response = client.post(
        "/imports/energydata",
        json={"file_path": str(csv_path), "limit": 10},
    )
    assert response.status_code == 200
    summary = response.json()
    assert summary["source_name"] == "energydata"
    assert summary["records_processed"] == 1
    assert summary["sync_log_id"] is not None
    assert summary["stations"] == ["Da Nang Hub"]

    weather_resp = client.get("/weather/observations")
    assert weather_resp.status_code == 200
    weather_rows = weather_resp.json()
    assert len(weather_rows) == 1
    assert weather_rows[0]["station_name"] == "Da Nang Hub"
    assert weather_rows[0]["solar_radiation"] == 645.8
    assert weather_rows[0]["temperature"] == 32.1

    sync_logs_resp = client.get("/sources/sync-logs")
    assert sync_logs_resp.status_code == 200
    sync_logs = sync_logs_resp.json()
    assert len(sync_logs) == 1
    assert sync_logs[0]["source_name"] == "energydata"
    assert sync_logs[0]["status"] == "success"


def test_list_source_connectors_returns_stub_capabilities(client):
    response = client.get("/sources/connectors")
    assert response.status_code == 200

    sources = {item["source_name"] for item in response.json()}
    assert {"goodwe-sems", "huawei-fusionsolar", "sungrow-isolarcloud", "sma-sunny-portal"}.issubset(sources)
