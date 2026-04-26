from __future__ import annotations

from .base import BaseSolarConnector, NormalizedPlant


class SMAConnector(BaseSolarConnector):
    source_name = "sma-sunny-portal"

    def describe_auth_requirements(self) -> dict[str, str]:
        return {
            "portal": "https://developer.sma.de/sma-apis",
            "required": "SMA API subscription/application plus plant-level authorization",
        }

    def fetch_plants(self, **kwargs) -> list[NormalizedPlant]:
        raise NotImplementedError("SMA connector requires Sunny Portal / SMA API credentials")
