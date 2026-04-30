#!/usr/bin/env python3
"""MQTT production smoke test.

Publishes one telemetry payload to an MQTT broker and verifies backend persistence via
GET /inverters/{id}/latest.

Usage:
  python scripts/mqtt-prod-smoke-test.py \
    --broker localhost --port 1883 \
    --username solar_ingest --password 'secret' \
    --backend https://solar-dashboard-xs4b.onrender.com \
    --topic solar/inverters/smoke-test
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone

import requests
import paho.mqtt.client as mqtt


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publish MQTT telemetry and verify backend latest reading")
    parser.add_argument("--broker", required=True)
    parser.add_argument("--port", type=int, default=1883)
    parser.add_argument("--tls", action="store_true", help="Enable TLS for MQTT connection")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--backend", default="https://solar-dashboard-xs4b.onrender.com")
    parser.add_argument("--topic", default="solar/inverters/smoke-test")
    parser.add_argument("--inverter-name", default="MQTT Smoke Test Inverter")
    parser.add_argument("--timeout", type=int, default=20)
    return parser.parse_args()


def find_or_create_inverter(backend: str, name: str) -> int:
    inverters = requests.get(f"{backend}/inverters", timeout=15).json()
    for inverter in inverters:
        if inverter.get("name") == name:
            return int(inverter["id"])

    created = requests.post(
        f"{backend}/inverters",
        json={
            "name": name,
            "location": "MQTT smoke test",
            "device_type": "mqtt-test",
        },
        timeout=15,
    )
    created.raise_for_status()
    return int(created.json()["id"])


def publish_payload(args: argparse.Namespace, inverter_id: int) -> None:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="solar-dashboard-smoke-test")
    client.username_pw_set(args.username, args.password)
    if args.tls:
        client.tls_set()
    client.connect(args.broker, args.port, keepalive=30)

    payload = {
        "inverter_id": inverter_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage": 221.5,
        "current": 3.2,
        "power": 708.8,
        "energy_today": 4.2,
        "temperature": 31.4,
        "is_online": True,
        "source": "mqtt-prod-smoke-test",
    }

    result = client.publish(args.topic, json.dumps(payload), qos=1)
    result.wait_for_publish(timeout=10)
    if result.rc != mqtt.MQTT_ERR_SUCCESS:
        raise RuntimeError(f"MQTT publish failed rc={result.rc}")

    client.disconnect()


def wait_for_latest(args: argparse.Namespace, inverter_id: int) -> dict:
    deadline = time.time() + args.timeout
    while time.time() < deadline:
        resp = requests.get(f"{args.backend}/inverters/{inverter_id}/latest", timeout=10)
        if resp.status_code == 200:
            latest = resp.json()
            if latest.get("power") == 708.8:
                return latest
        time.sleep(1)
    raise TimeoutError("Timed out waiting for MQTT reading to appear in backend latest endpoint")


def main() -> int:
    args = parse_args()
    inverter_id = find_or_create_inverter(args.backend, args.inverter_name)
    publish_payload(args, inverter_id)
    latest = wait_for_latest(args, inverter_id)
    print(json.dumps({"ok": True, "inverter_id": inverter_id, "latest": latest}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2), file=sys.stderr)
        raise SystemExit(1)
