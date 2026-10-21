"""SwasthaSathi Scalable REST API Package."""
from __future__ import annotations

from api.context import APIResponse, RequestContext
from api.router import Router, api_router
from api.routes import init_routes

# Initialize all routes onto the global router
init_routes(api_router)

__all__ = ["api_router", "Router", "RequestContext", "APIResponse", "init_routes"]
