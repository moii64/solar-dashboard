import asyncio
import logging
import math
import os
import random
from datetime import datetime

import httpx
from dotenv import load_dotenv
from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext
from pymodbus.server import StartAsyncTcpServer

try:
    from pymodbus.datastore import ModbusSlaveContext
except ImportError:  # pymodbus >= 3.10
    from pymodbus.datastore import ModbusDeviceContext as ModbusSlaveContext

load_dotenv()

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("solar-simulator")

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
SIMULATOR_INTERVAL_SECONDS = float(os.getenv("SIMULATOR_INTERVAL_SECONDS", "5"))
SIMULATOR_MODBUS_HOST = os.getenv("SIMULATOR_MODBUS_HOST", "127.0.0.1")
SIMULATOR_MODBUS_PORT = int(os.getenv("SIMULATOR_MODBUS_PORT", "5020"))
SIMULATOR_INVERTER_ID = os.getenv("SIMULATOR_INVERTER_ID")
SIMULATOR_INVERTER_NAME = os.getenv("SIMULATOR_INVERTER_NAME", "Simulator Demo 01")
SIMULATOR_INVERTER_LOCATION = os.getenv("SIMULATOR_INVERTER_LOCATION", "Solar Việt Nam - Modbus Lab")
SIMULATOR_DEVICE_TYPE = os.getenv("SIMULATOR_DEVICE_TYPE", "sungrow")
SIMULATOR_IP_ADDRESS = os.getenv("SIMULATOR_IP_ADDRESS", "127.0.0.1")


class InverterSimulator:
    def __init__(self):
        self.base_power = 5000  # 5kW Inverter
        self.time_offset = random.randint(0, 24 * 3600)  # Bắt đầu ngẫu nhiên trong ngày

    def sample(self) -> dict:
        """Sinh 1 mẫu telemetry nhất quán cho cùng một thời điểm."""
        current_hour = (datetime.now().hour * 3600 + self.time_offset) % 86400 / 3600
        daylight_factor = 0.0
        if 6 <= current_hour < 18:
            daylight_factor = max(0.0, math.sin(math.pi * (current_hour - 6) / 12))

        if daylight_factor > 0:
            power = max(0.0, self.base_power * daylight_factor + random.randint(-50, 50))
        else:
            power = 0.0

        voltage = round(220 + random.uniform(-5, 5), 2)
        current = round(power / voltage, 2) if voltage > 0 else 0.0
        energy_today = round(max(0.0, (current_hour - 6)) * random.uniform(1.5, 2.5), 2) if daylight_factor > 0 else 0.0
        temperature = round(45 + random.uniform(-5, 10), 2)

        return {
            "voltage": round(voltage, 2),
            "current": round(current, 2),
            "power": round(power, 2),
            "energy_today": energy_today,
            "temperature": temperature,
            "is_online": True,
        }


async def ensure_target_inverter(client: httpx.AsyncClient) -> int:
    if SIMULATOR_INVERTER_ID:
        response = await client.get(f"{API_BASE_URL}/inverters/{SIMULATOR_INVERTER_ID}", timeout=5.0)
        if response.status_code == 200:
            inverter = response.json()
            log.info("Using configured inverter id=%s (%s)", inverter["id"], inverter["name"])
            return int(inverter["id"])
        raise RuntimeError(
            f"SIMULATOR_INVERTER_ID={SIMULATOR_INVERTER_ID} không tồn tại trên backend ({response.status_code})."
        )

    response = await client.get(f"{API_BASE_URL}/inverters", timeout=5.0)
    response.raise_for_status()
    inverters = response.json()

    for inverter in inverters:
        if SIMULATOR_IP_ADDRESS and inverter.get("ip_address") == SIMULATOR_IP_ADDRESS:
            log.info("Matched existing inverter by ip_address=%s -> id=%s", SIMULATOR_IP_ADDRESS, inverter["id"])
            return int(inverter["id"])
        if inverter.get("name") == SIMULATOR_INVERTER_NAME:
            log.info("Matched existing inverter by name=%s -> id=%s", SIMULATOR_INVERTER_NAME, inverter["id"])
            return int(inverter["id"])

    payload = {
        "name": SIMULATOR_INVERTER_NAME,
        "location": SIMULATOR_INVERTER_LOCATION,
        "ip_address": SIMULATOR_IP_ADDRESS,
        "device_type": SIMULATOR_DEVICE_TYPE,
    }
    create_response = await client.post(f"{API_BASE_URL}/inverters", json=payload, timeout=5.0)
    create_response.raise_for_status()
    inverter = create_response.json()
    log.info("Created simulator inverter id=%s name=%s", inverter["id"], inverter["name"])
    return int(inverter["id"])


async def push_reading(client: httpx.AsyncClient, inverter_id: int, sample: dict) -> int:
    payload = {"inverter_id": inverter_id, **sample}
    response = await client.post(f"{API_BASE_URL}/telemetry/readings", json=payload, timeout=5.0)

    if response.status_code == 404:
        log.warning("Inverter id=%s không còn tồn tại trên backend, đang tạo/match lại...", inverter_id)
        inverter_id = await ensure_target_inverter(client)
        payload["inverter_id"] = inverter_id
        response = await client.post(f"{API_BASE_URL}/telemetry/readings", json=payload, timeout=5.0)

    response.raise_for_status()
    log.info(
        "Telemetry pushed | inverter=%s | power=%sW | voltage=%sV | online=%s",
        payload["inverter_id"],
        sample["power"],
        sample["voltage"],
        sample["is_online"],
    )
    return int(payload["inverter_id"])


def update_registers(store, sample: dict):
    register_values = [
        int(sample["power"]),
        int(sample["voltage"] * 10),
        int(sample["current"] * 100),
        int(sample["energy_today"] * 100),
        int(sample["temperature"] * 10),
    ]

    if hasattr(store, "setValues"):
        for offset, value in enumerate(register_values, start=1):
            store.setValues(3, offset, [value])
        return

    simdevice = getattr(store, "simdevice", None)
    holding_registers = None
    if simdevice and getattr(simdevice, "simdata", None):
        holding_registers = simdevice.simdata[3][0].values

    if isinstance(holding_registers, list) and len(holding_registers) >= len(register_values):
        for index, value in enumerate(register_values):
            holding_registers[index] = value
        return

    raise RuntimeError("Unsupported pymodbus datastore shape for simulator register updates")


async def run_simulator():
    simulator = InverterSimulator()

    # Định nghĩa các thanh ghi (Registers) giả lập cho Inverter
    # 40001: AC Power (W)
    # 40002: AC Voltage (V * 10)
    # 40003: AC Current (A * 100)
    # 40004: Daily Energy (kWh * 100)
    # 40005: Temperature (°C * 10)
    store = ModbusSlaveContext(hr=ModbusSequentialDataBlock(1, [0] * 100))
    context = ModbusServerContext(devices=store, single=True)

    async def update_data():
        async with httpx.AsyncClient() as client:
            inverter_id = await ensure_target_inverter(client)

            while True:
                sample = simulator.sample()

                update_registers(store, sample)

                try:
                    inverter_id = await push_reading(client, inverter_id, sample)
                except Exception as exc:
                    log.error("Failed to send telemetry to %s: %s", API_BASE_URL, exc)

                await asyncio.sleep(SIMULATOR_INTERVAL_SECONDS)

    log.info(
        "Starting Modbus simulator on %s:%s -> %s",
        SIMULATOR_MODBUS_HOST,
        SIMULATOR_MODBUS_PORT,
        API_BASE_URL,
    )

    await asyncio.gather(
        StartAsyncTcpServer(context=context, address=(SIMULATOR_MODBUS_HOST, SIMULATOR_MODBUS_PORT)),
        update_data(),
    )


if __name__ == "__main__":
    asyncio.run(run_simulator())
