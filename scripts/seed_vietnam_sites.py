"""
Seed các site SolarVN trải dài toàn quốc bằng tọa độ thật các tỉnh/thành.
Dùng để kiểm thử hiển thị fleet dashboard trước khi nối gateway/MQTT thật.

Chạy local:
  python scripts/seed_vietnam_sites.py

Chạy production:
  API_BASE=https://solar-dashboard-xs4b.onrender.com python scripts/seed_vietnam_sites.py
"""
from __future__ import annotations

import math
import os
import random
from datetime import datetime, timezone

import requests

API_BASE = os.getenv("API_BASE", "http://localhost:8000").rstrip("/")

SITES = [
    {"name": "SolarVN Hà Nội", "location": "Hà Nội", "latitude": 21.0285, "longitude": 105.8542, "device_type": "huawei"},
    {"name": "SolarVN Hải Phòng", "location": "Hải Phòng", "latitude": 20.8449, "longitude": 106.6881, "device_type": "sungrow"},
    {"name": "SolarVN Nghệ An", "location": "Nghệ An", "latitude": 18.6796, "longitude": 105.6813, "device_type": "goodwe"},
    {"name": "SolarVN Đà Nẵng", "location": "Đà Nẵng", "latitude": 16.0544, "longitude": 108.2022, "device_type": "sma"},
    {"name": "SolarVN Bình Định", "location": "Bình Định", "latitude": 13.7820, "longitude": 109.2197, "device_type": "sungrow"},
    {"name": "SolarVN Khánh Hòa", "location": "Khánh Hòa", "latitude": 12.2388, "longitude": 109.1967, "device_type": "huawei"},
    {"name": "SolarVN Ninh Thuận", "location": "Ninh Thuận", "latitude": 11.6739, "longitude": 108.8629, "device_type": "sungrow"},
    {"name": "SolarVN Bình Thuận", "location": "Bình Thuận", "latitude": 10.9805, "longitude": 108.2615, "device_type": "goodwe"},
    {"name": "SolarVN TP.HCM", "location": "TP. Hồ Chí Minh", "latitude": 10.8231, "longitude": 106.6297, "device_type": "huawei"},
    {"name": "SolarVN Cần Thơ", "location": "Cần Thơ", "latitude": 10.0452, "longitude": 105.7469, "device_type": "sma"},
]


def daytime_factor() -> float:
    now = datetime.now().astimezone()
    hour = now.hour + now.minute / 60
    if hour < 6 or hour > 18:
        return 0.0
    return max(0.0, math.sin(math.pi * (hour - 6) / 12))


def create_or_match(site: dict) -> int:
    existing = requests.get(f"{API_BASE}/inverters", timeout=15).json()
    for inverter in existing:
        if inverter.get("name") == site["name"]:
            return int(inverter["id"])

    payload = {
        **site,
        "ip_address": f"10.64.{random.randint(1, 254)}.{random.randint(1, 254)}",
    }
    response = requests.post(f"{API_BASE}/inverters", json=payload, timeout=15)
    response.raise_for_status()
    return int(response.json()["id"])


def push_telemetry(inverter_id: int, site: dict) -> None:
    base_kw = random.uniform(35, 180)
    regional_boost = 1.25 if site["latitude"] < 13 else 1.0
    power_w = base_kw * 1000 * daytime_factor() * regional_boost * random.uniform(0.82, 1.08)
    voltage = random.uniform(219, 232)
    payload = {
        "inverter_id": inverter_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage": round(voltage, 2),
        "current": round(power_w / voltage, 2) if voltage else 0,
        "power": round(power_w, 2),
        "energy_today": round(max(power_w / 1000 * random.uniform(2.2, 5.8), 0), 2),
        "temperature": round(random.uniform(34, 52), 2),
        "error_code": None,
        "is_online": True,
    }
    response = requests.post(f"{API_BASE}/telemetry/readings", json=payload, timeout=15)
    response.raise_for_status()


def main() -> None:
    print(f"Seeding Vietnam sites -> {API_BASE}")
    for site in SITES:
        inverter_id = create_or_match(site)
        push_telemetry(inverter_id, site)
        print(f"OK {site['name']} id={inverter_id}")


if __name__ == "__main__":
    main()
