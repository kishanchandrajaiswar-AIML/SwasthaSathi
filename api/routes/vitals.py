"""Patient Vitals API Endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from api.context import RequestContext
from api.router import Router

# In-memory vitals store
PATIENT_VITALS: Dict[str, Any] = {
    "temperature": None,
    "blood_pressure": None,
    "blood_glucose": None,
    "heart_rate": None,
    "updated_at": None,
}


def register_vitals_routes(router: Router) -> None:
    """Register patient vital signs read and update routes."""

    @router.get("/api/vitals")
    def get_vitals(ctx: RequestContext) -> Dict[str, Any]:
        """Return current patient vitals."""
        return PATIENT_VITALS

    @router.post("/api/vitals")
    def post_vitals(ctx: RequestContext) -> Dict[str, Any]:
        """Update user vitals."""
        for field in ("temperature", "blood_pressure", "blood_glucose", "heart_rate"):
            if field in ctx.body:
                PATIENT_VITALS[field] = ctx.body[field]

        PATIENT_VITALS["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        return {"success": True, "vitals": PATIENT_VITALS}
