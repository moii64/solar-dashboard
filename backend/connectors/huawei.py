from __future__ import annotations

from .base import BaseSolarConnector, NormalizedPlant


class HuaweiFusionSolarConnector(BaseSolarConnector):
    source_name = "huawei-fusionsolar"

    def describe_auth_requirements(self) -> dict[str, str]:
        return {
            "portal": "https://sg5.fusionsolar.huawei.com",
            "required": "FusionSolar Northbound API account, project onboarding, and API permission",
        }

    def fetch_plants(self, **kwargs) -> list[NormalizedPlant]:
        raise NotImplementedError("Huawei FusionSolar connector requires Northbound API credentials")
