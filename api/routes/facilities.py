"""Healthcare Facilities and Geolocation API Endpoints."""
from __future__ import annotations

from typing import Any, Dict, List

from api.context import RequestContext
from api.router import Router
from core.errors import BadRequestError
from services.facilities import get_nearby_facilities, reverse_geocode, search_location


def register_facilities_routes(router: Router) -> None:
    """Register geolocation, reverse-lookup, and facility search routes."""

    @router.get("/api/location/reverse")
    def get_reverse_location(ctx: RequestContext) -> Dict[str, Any]:
        """Perform reverse geocoding on coordinates."""
        lat = ctx.get_query_float("lat")
        lng = ctx.get_query_float("lng")
        if lat is None or lng is None:
            raise BadRequestError("Both 'lat' and 'lng' query parameters are required")

        return reverse_geocode(lat, lng)

    @router.get("/api/location/search")
    def get_location_search(ctx: RequestContext) -> Dict[str, Any]:
        """Search location suggestions by query string."""
        q = ctx.get_query("q") or ctx.get_query("query") or ""
        if not q.strip():
            return {"success": False, "results": []}

        results = search_location(q.strip())
        return {"success": True, "results": results}

    @router.get("/api/facilities")
    def get_facilities(ctx: RequestContext) -> List[Dict[str, Any]]:
        """Return verified clinics, PHCs, CHCs, and hospitals with GPS distance calculation."""
        user_lat = ctx.get_query_float("lat")
        user_lng = ctx.get_query_float("lng")

        search_q = ctx.get_query("q") or ctx.get_query("query")
        if search_q and (user_lat is None or user_lng is None):
            geocoded = search_location(search_q)
            if geocoded:
                user_lat = geocoded[0].get("lat")
                user_lng = geocoded[0].get("lng")

        fac_type = ctx.get_query("type")
        block = ctx.get_query("block")
        emergency = ctx.get_query_bool("emergency", default=False)
        district = ctx.get_query("district")
        limit = ctx.get_query_int("limit", default=15) or 15

        return get_nearby_facilities(
            district=district,
            facility_type=fac_type,
            emergency_only=emergency,
            user_lat=user_lat,
            user_lng=user_lng,
            block=block,
            limit=limit,
        )
