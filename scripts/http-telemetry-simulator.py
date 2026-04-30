#!/usr/bin/env python3
"""HTTP telemetry simulator for Solar Dashboard.

Publishes realistic inverter telemetry to backend HTTP endpoint every few seconds.
Use this to demo realtime dashboard without needing MQTT broker.

Usage:
  python scripts/http-telemetry-simulator.py \
    --backend https://solar-dashboard-xs4b.onrender.com \
    --inverter-id 1 \
    --interval 5
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="HTTP telemetry simulator")
    parser.add_argument("--backend", default="https://solar-dashboard-xs4b.onrender.com")
    parser.add_argument("--inverter-id", type=int, default=1)
    parser.add_argument("--interval", type=int, default=5, help="Seconds between readings")
    parser.add_argument("--duration", type=int, help="Stop after N seconds (default: run forever)")
    return parser.parse_args()


def generate_realistic_reading(inverter_id: int, base_power: float = 1000.0) -> dict:
    """Generate realistic solar inverter telemetry."""
    hour = datetime.now().hour
    
    # Solar production curve (peak at noon)
    if 6 <= hour <= 18:
        time_factor = 1.0 - abs(hour - 12) / 6.0  # Peak at 12:00
        power = base_power * time_factor * random.uniform(0.85, 1.0)
    else:
        power = 0.0  # Night time
    
    voltage = 220 + random.uniform(-5, 5) if power > 0 else 0
    current = (power / voltage) if voltage > 0 else 0
    temperature = 25 + (power / 100) + random.uniform(-2, 2)
    
    return {
        "inverter_id": inverter_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage": round(voltage, 1),
        "current": round(current, 2),
        "power": round(power, 1),
        "energy_today": round(power * 0.01, 2),  # Simplified daily accumulation
        "temperature": round(temperature, 1),
        "is_online": power > 0,
    }


def publish_reading(backend: str, reading: dict) -> dict:
    """POST telemetry reading to backend."""
    resp = requests.post(
        f"{backend}/telemetry/readings",
        json=reading,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def main() -> int:
    args = parse_args()
    start_time = time.time()
    count = 0
    
    print(f"[OK] Starting HTTP telemetry simulator")
    print(f"   Backend: {args.backend}")
    print(f"   Inverter ID: {args.inverter_id}")
    print(f"   Interval: {args.interval}s")
    if args.duration:
        print(f"   Duration: {args.duration}s")
    print()
    
    try:
        while True:
            if args.duration and (time.time() - start_time) >= args.duration:
                break
            
            reading = generate_realistic_reading(args.inverter_id)
            result = publish_reading(args.backend, reading)
            count += 1
            
            print(f"[{count:04d}] [OK] Power: {reading['power']:6.1f}W | Temp: {reading['temperature']:4.1f}C | ID: {result['id']}")
            
            time.sleep(args.interval)
    
    except KeyboardInterrupt:
        print(f"\n[STOP] Stopped after {count} readings")
        return 0
    except Exception as exc:
        print(f"\n❌ Error: {exc}", file=sys.stderr)
        return 1
    
    print(f"\n[OK] Completed {count} readings")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
