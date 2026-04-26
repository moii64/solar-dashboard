#!/usr/bin/env python3
"""
MQTT test publisher - gửi payload mẫu để smoke test MQTT consumer
"""
import json
import time
import random
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

BROKER = "localhost"
PORT = 1883
TOPIC = "solar/inverters/test-001"

def generate_payload():
    """Tạo payload mẫu giống format thật"""
    return {
        "inverter": {
            "name": "Test Inverter MQTT-001",
            "ip_address": "192.168.1.100",
            "location": "Test Site A"
        },
        "telemetry": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "power_w": round(random.uniform(3000, 5000), 2),
            "voltage_v": round(random.uniform(220, 240), 2),
            "current_a": round(random.uniform(13, 23), 2),
            "energy_kwh": round(random.uniform(100, 200), 2),
            "temperature_c": round(random.uniform(35, 45), 2),
            "status": random.choice(["online", "warning"])
        }
    }

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to MQTT broker at {BROKER}:{PORT}")
    else:
        print(f"❌ Connection failed with code {rc}")

def main():
    client = mqtt.Client(client_id="solar-test-publisher")
    client.on_connect = on_connect
    
    print(f"🔌 Connecting to {BROKER}:{PORT}...")
    client.connect(BROKER, PORT, 60)
    client.loop_start()
    
    try:
        count = 0
        while True:
            payload = generate_payload()
            payload_json = json.dumps(payload, indent=2)
            
            result = client.publish(TOPIC, payload_json, qos=1)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                count += 1
                print(f"\n📤 [{count}] Published to {TOPIC}")
                print(f"   Power: {payload['telemetry']['power_w']}W")
                print(f"   Status: {payload['telemetry']['status']}")
            else:
                print(f"❌ Publish failed: {result.rc}")
            
            time.sleep(5)
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping publisher...")
    finally:
        client.loop_stop()
        client.disconnect()
        print("👋 Disconnected")

if __name__ == "__main__":
    main()
