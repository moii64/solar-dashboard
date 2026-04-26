from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.request import urlopen


COLUMN_ALIASES = {
    "station_id": ["stationid", "stationcode", "siteid", "id"],
    "station_name": ["stationname", "station", "sitename", "locationname", "name"],
    "observed_at": ["datetime", "timestamp", "observationtime", "measuredat", "time", "date_time", "juliantime"],
    "observed_date": ["date", "measurementdate", "observeddate"],
    "observed_time": ["clocktime", "measurementtime", "observedtime"],
    "latitude": ["latitude", "lat"],
    "longitude": ["longitude", "lon", "lng", "long"],
    "solar_radiation": ["ghithpyra1wm2avg", "ghirsi1wm2avg", "solarradiation", "globalradiation", "ghi", "irradiance", "radiation", "solarirradiance"],
    "temperature": ["tempthhyg1degcavg", "temperature", "temp", "airtemperature", "ambienttemperature"],
    "wind_speed": ["windspeedanemo1msavg", "windspeed", "windvelocity", "wind", "windspeedms"],
    "pressure": ["preslogger1hpaavg", "pressure", "airpressure", "barometricpressure", "atmosphericpressure", "pres"],
}


STATION_NAME_HINTS = {
    "centralhighlands": "VNCEH (Central Highlands)",
    "danang": "VNDAN (Da Nang)",
    "hanoi": "VNHAN (Hanoi)",
    "bacninh": "VNHAN (Hanoi)",
    "songbinh": "VNSOB (Song Binh)",
    "trian": "VNTRA (Tri-An)",
}


STATION_ID_HINTS = {
    "centralhighlands": "VNCEH",
    "danang": "VNDAN",
    "hanoi": "VNHAN",
    "bacninh": "VNHAN",
    "songbinh": "VNSOB",
    "trian": "VNTRA",
}


@dataclass
class EnergyDataImportResult:
    source_name: str
    loaded_from: str
    records_processed: int
    stations: list[str]
    matched_columns: dict[str, str]
    observations: list[dict[str, Any]]


def normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").strip().lower())


def find_matching_column(headers: dict[str, str], field_name: str) -> Optional[str]:
    aliases = COLUMN_ALIASES[field_name]
    for alias in aliases:
        if alias in headers:
            return headers[alias]

    for normalized, original in headers.items():
        if any(alias in normalized for alias in aliases):
            return original
    return None


def parse_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)

    cleaned = str(value).strip()
    cleaned = cleaned.replace("\u00a0", " ")
    cleaned = re.sub(r"[^0-9,\.\-]+", "", cleaned)
    if cleaned.count(",") == 1 and cleaned.count(".") == 0:
        cleaned = cleaned.replace(",", ".")
    elif cleaned.count(",") > 0 and cleaned.count(".") > 0:
        cleaned = cleaned.replace(",", "")

    if cleaned in ("", "-", "."):
        return None

    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_timestamp(value: Any) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        candidates = [
            text,
            text.replace("Z", "+00:00"),
            text.replace("/", "-"),
        ]
        parsed = None
        for candidate in candidates:
            try:
                parsed = datetime.fromisoformat(candidate)
                break
            except ValueError:
                continue
        if parsed is None:
            for fmt in (
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%d-%m-%Y %H:%M:%S",
                "%d-%m-%Y %H:%M",
                "%m-%d-%Y %H:%M:%S",
                "%m-%d-%Y %H:%M",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d %H:%M",
                "%d/%m/%Y %H:%M:%S",
                "%d/%m/%Y %H:%M",
                "%m/%d/%Y %H:%M:%S",
                "%m/%d/%Y %H:%M",
                "%Y-%m-%d",
                "%d-%m-%Y",
                "%d/%m/%Y",
            ):
                try:
                    parsed = datetime.strptime(text, fmt)
                    break
                except ValueError:
                    continue
        if parsed is None:
            return None

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def infer_station_details(loaded_from: str) -> tuple[Optional[str], Optional[str]]:
    normalized_source = normalize_header(loaded_from)
    station_id = next((value for key, value in STATION_ID_HINTS.items() if key in normalized_source), None)
    station_name = next((value for key, value in STATION_NAME_HINTS.items() if key in normalized_source), None)
    return station_id, station_name


def prepare_csv_content(content: str) -> str:
    lines = content.splitlines()
    if not lines:
        return content

    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        candidate = stripped.lstrip("#").strip()
        if candidate.count(",") < 1 and candidate.count(";") < 1 and candidate.count("\t") < 1:
            continue

        normalized = normalize_header(candidate)
        if any(token in normalized for token in ("juliantime", "timestamp", "datetime", "date,time", "time,date", "ghi", "solarradiation")):
            lines[index] = candidate
            return "\n".join(lines[index:])

    return content


def load_dataset_text(*, source_url: Optional[str] = None, file_path: Optional[str] = None) -> tuple[str, str]:
    if bool(source_url) == bool(file_path):
        raise ValueError("Provide exactly one of source_url or file_path")

    if source_url:
        with urlopen(source_url) as response:  # noqa: S310 - caller controls the URL
            content = response.read().decode("utf-8-sig", errors="replace")
        return content, source_url

    path = Path(file_path).expanduser().resolve()
    return path.read_text(encoding="utf-8-sig"), str(path)


def parse_energydata_csv(content: str, *, loaded_from: str, limit: Optional[int] = None) -> EnergyDataImportResult:
    prepared_content = prepare_csv_content(content)
    sample = prepared_content[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(prepared_content), dialect=dialect)
    if not reader.fieldnames:
        raise ValueError("CSV has no header row")

    headers = {normalize_header(name.lstrip("#").strip()): name.lstrip("#").strip() for name in reader.fieldnames if name}
    matched_columns = {
        field_name: column
        for field_name in COLUMN_ALIASES
        if (column := find_matching_column(headers, field_name))
    }

    if "observed_at" not in matched_columns and "observed_date" not in matched_columns:
        raise ValueError("Could not identify a timestamp/date column in the CSV")

    observations: list[dict[str, Any]] = []
    station_names: set[str] = set()
    fallback_station_id, fallback_station_name = infer_station_details(loaded_from)

    for row in reader:
        if not row or not any(value not in (None, "") for value in row.values()):
            continue

        observed_at = None
        if matched_columns.get("observed_at"):
            observed_at = parse_timestamp(row.get(matched_columns["observed_at"]))
        if observed_at is None and matched_columns.get("observed_date"):
            date_value = row.get(matched_columns["observed_date"])
            time_value = row.get(matched_columns.get("observed_time", ""), "") if matched_columns.get("observed_time") else ""
            observed_at = parse_timestamp(f"{date_value} {time_value}".strip())
        if observed_at is None:
            continue

        station_name = row.get(matched_columns.get("station_name", ""), "") if matched_columns.get("station_name") else ""
        station_id = row.get(matched_columns.get("station_id", ""), "") if matched_columns.get("station_id") else ""
        station_name_value = str(station_name).strip() or fallback_station_name
        station_id_value = str(station_id).strip() or fallback_station_id
        observation = {
            "source_name": "energydata",
            "station_id": station_id_value,
            "station_name": station_name_value,
            "observed_at": observed_at,
            "latitude": parse_float(row.get(matched_columns.get("latitude", ""))) if matched_columns.get("latitude") else None,
            "longitude": parse_float(row.get(matched_columns.get("longitude", ""))) if matched_columns.get("longitude") else None,
            "solar_radiation": parse_float(row.get(matched_columns.get("solar_radiation", ""))) if matched_columns.get("solar_radiation") else None,
            "temperature": parse_float(row.get(matched_columns.get("temperature", ""))) if matched_columns.get("temperature") else None,
            "wind_speed": parse_float(row.get(matched_columns.get("wind_speed", ""))) if matched_columns.get("wind_speed") else None,
            "pressure": parse_float(row.get(matched_columns.get("pressure", ""))) if matched_columns.get("pressure") else None,
            "raw_payload": dict(row),
        }
        observations.append(observation)
        if observation["station_name"]:
            station_names.add(observation["station_name"])
        if limit is not None and len(observations) >= limit:
            break

    return EnergyDataImportResult(
        source_name="energydata",
        loaded_from=loaded_from,
        records_processed=len(observations),
        stations=sorted(station_names),
        matched_columns=matched_columns,
        observations=observations,
    )


def import_energydata_dataset(*, source_url: Optional[str] = None, file_path: Optional[str] = None, limit: Optional[int] = None) -> EnergyDataImportResult:
    content, loaded_from = load_dataset_text(source_url=source_url, file_path=file_path)
    return parse_energydata_csv(content, loaded_from=loaded_from, limit=limit)
