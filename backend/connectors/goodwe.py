from __future__ import annotations

from .base import BaseSolarConnector, NormalizedPlant


class GoodWeConnector(BaseSolarConnector):
    source_name = "goodwe-sems"

    def describe_auth_requirements(self) -> dict[str, str]:
        return {
            "portal": "https://www.semsportal.com",
            "required": "SEMS organization/account access or official API credentials",
        }

    def fetch_plants(self, **kwargs) -> list[NormalizedPlant]:
        raise NotImplementedError("GoodWe connector requires SEMS credentials and API integration setup")
