"""System and Configuration API Endpoints."""
from __future__ import annotations

import json
from typing import Any, Dict

from api.context import RequestContext
from api.router import Router
from core.config import settings


def register_system_routes(router: Router) -> None:
    """Register system, status, configuration, and static guidelines routes."""

    @router.get("/api/status")
    def get_status(ctx: RequestContext) -> Dict[str, Any]:
        """Return system health and external service availability."""
        return settings.get_system_status()

    @router.get("/api/config")
    def get_config(ctx: RequestContext) -> Dict[str, Any]:
        """Return public frontend configuration and Supabase connection parameters."""
        return settings.get_public_config()

    @router.get("/api/scenarios")
    def get_scenarios(ctx: RequestContext) -> list[Dict[str, Any]]:
        """Return hero demo scenarios from data/demo_scenarios.json."""
        scenarios_file = settings.data_dir / "demo_scenarios.json"
        if scenarios_file.is_file():
            with open(scenarios_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    @router.get("/api/guidelines")
    def get_guidelines(ctx: RequestContext) -> Dict[str, Any]:
        """Return authenticated clinical guidelines and governance metadata."""
        guidelines_file = settings.data_dir / "clinical_guidelines.json"
        if guidelines_file.is_file():
            with open(guidelines_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"sources": [], "specialties": []}
