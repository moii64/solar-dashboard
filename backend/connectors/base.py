from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass
class NormalizedTelemetryReading:
    observed_at: datetime
    power: Optional[float] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    energy_today: Optional[float] = None
    temperature: Optional[float] = None
    is_online: Optional[bool] = None
    error_code: Optional[str] = None
    raw_payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedDevice:
    external_id: str
    name: str
    device_type: str
    status: Optional[str] = None
    serial_number: Optional[str] = None
    ip_address: Optional[str] = None
    telemetry: list[NormalizedTelemetryReading] = field(default_factory=list)
    raw_payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedPlant:
    external_id: str
    name: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    devices: list[NormalizedDevice] = field(default_factory=list)
    raw_payload: dict[str, Any] = field(default_factory=dict)


class BaseSolarConnector(ABC):
    source_name: str = "base"

    @abstractmethod
    def describe_auth_requirements(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def fetch_plants(self, **kwargs) -> list[NormalizedPlant]:
        raise NotImplementedError
