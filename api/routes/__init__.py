"""Routes Registry.

Collects and registers all route modules onto the central router.
"""
from __future__ import annotations

from api.router import Router
from api.routes.doctors import register_doctors_routes
from api.routes.facilities import register_facilities_routes
from api.routes.reports import register_reports_routes
from api.routes.system import register_system_routes
from api.routes.triage import register_triage_routes
from api.routes.vitals import register_vitals_routes
from api.routes.voice import register_voice_routes


def init_routes(router: Router) -> Router:
    """Register all application route endpoints onto the given router."""
    register_system_routes(router)
    register_triage_routes(router)
    register_facilities_routes(router)
    register_doctors_routes(router)
    register_reports_routes(router)
    register_vitals_routes(router)
    register_voice_routes(router)
    return router
