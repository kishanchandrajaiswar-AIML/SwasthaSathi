"""Controlled healthcare facilities service for SwasthaSathi.

Loads static facilities from data/facilities.json with distance sorting,
GPS proximity calculation (Haversine formula), and zero external live map/geocoding
API dependencies for reliability during hackathon demos.
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

FACILITIES_JSON_PATH = Path(__file__).parent.parent / "data" / "facilities.json"

DEFAULT_HELPLINES = [
    {"name": "National Emergency Number", "phone": "112", "type": "EMERGENCY_HELPLINE"},
    {"name": "Medical Ambulance Service", "phone": "108", "type": "AMBULANCE"},
    {"name": "State Health Advisory Helpline", "phone": "104", "type": "HEALTH_ADVICE"},
    {"name": "Tele-MANAS Mental Health Support", "phone": "14416", "type": "MENTAL_HEALTH"},
]


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in kilometers using Haversine formula."""
    r = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(r * c, 1)


def load_facilities() -> list[dict[str, Any]]:
    """Load curated facilities from local JSON file."""
    if not FACILITIES_JSON_PATH.is_file():
        logger.warning(f"Facilities database not found at {FACILITIES_JSON_PATH}")
        return []
    try:
        with open(FACILITIES_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
    except Exception as err:
        logger.error(f"Error reading facilities JSON: {err}")
    return []


def get_nearby_facilities(
    district: Optional[str] = None,
    facility_type: Optional[str] = None,
    emergency_only: bool = False,
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
    block: Optional[str] = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Return top nearby facilities matching criteria, sorted by distance."""
    all_facilities = load_facilities()
    if not all_facilities:
        return []

    # Calculate real distances if coordinates supplied
    processed = []
    for fac in all_facilities:
        fac_copy = dict(fac)
        if user_lat is not None and user_lng is not None and "lat" in fac and "lng" in fac:
            dist = calculate_distance_km(user_lat, user_lng, fac["lat"], fac["lng"])
            fac_copy["distance_km"] = dist
        processed.append(fac_copy)

    filtered = []
    for fac in processed:
        if emergency_only and not fac.get("emergency_available", False):
            continue
        if district and fac.get("district", "").lower() != district.lower():
            continue
        if block and fac.get("block", "").lower() != block.lower():
            # If filtering by block, skip non-matching
            continue
        if facility_type and facility_type.upper() != "ALL":
            if fac.get("type", "").upper() != facility_type.upper():
                continue
        filtered.append(fac)

    # If strict filter resulted in 0 items, relax to all processed
    if not filtered:
        filtered = processed

    filtered.sort(key=lambda x: float(x.get("distance_km", 999.0)))
    return filtered[:limit]


def get_default_helplines() -> list[dict[str, str]]:
    """Return 24x7 government toll-free emergency helplines."""
    return DEFAULT_HELPLINES
