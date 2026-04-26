from __future__ import annotations

from .base import BaseSolarConnector, NormalizedPlant


class SungrowICloudConnector(BaseSolarConnector):
    source_name = "sungrow-isolarcloud"

    def describe_auth_requirements(self) -> dict[str, str]:
        return {
            "portal": "https://developer-api.isolarcloud.com",
            "required": "iSolarCloud developer account, API key/app credentials, and site authorization",
        }

    def fetch_plants(self, **kwargs) -> list[NormalizedPlant]:
        raise NotImplementedError("Sungrow iSolarCloud connector requires developer portal credentials")
