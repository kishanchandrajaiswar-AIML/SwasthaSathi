"""Tests for Scalable API Router, Middleware, and Core Configuration."""
from __future__ import annotations

import pytest
from api.context import APIResponse, RequestContext
from api.router import Router, api_router
from core.config import settings
from core.errors import BadRequestError, NotFoundError


def test_core_settings_loaded() -> None:
    """Verify settings singleton loads properly and exports expected keys."""
    assert settings.port >= 1000
    assert settings.rules_version == "2026.1-safety-v1"
    pub_cfg = settings.get_public_config()
    assert "supabase_url" in pub_cfg
    assert "rules_version" in pub_cfg
    sys_status = settings.get_system_status()
    assert sys_status["status"] == "online"


def test_router_handles_system_status() -> None:
    """Verify api_router dispatches /api/status properly."""
    ctx = RequestContext(method="GET", path="/api/status")
    res = api_router.dispatch(ctx)
    assert res.status_code == 200
    assert res.data["status"] == "online"
    assert "rules_version" in res.data


def test_router_handles_cors_preflight() -> None:
    """Verify OPTIONS preflight requests return 204 with CORS headers."""
    ctx = RequestContext(method="OPTIONS", path="/api/triage")
    res = api_router.dispatch(ctx)
    assert res.status_code == 204
    assert res.headers["Access-Control-Allow-Origin"] == "*"
    assert "POST" in res.headers["Access-Control-Allow-Methods"]


def test_router_handles_404_not_found() -> None:
    """Verify router returns standardized 404 for unknown endpoints."""
    ctx = RequestContext(method="GET", path="/api/unknown-nonexistent-route")
    res = api_router.dispatch(ctx)
    assert res.status_code == 404
    assert res.data["success"] is False
    assert res.data["error"]["code"] == "NOT_FOUND"


def test_router_handles_bad_request_validation() -> None:
    """Verify router catches BadRequestError and returns 400."""
    test_router = Router()

    @test_router.post("/api/test-bad")
    def bad_handler(ctx: RequestContext):
        raise BadRequestError("Custom validation error message")

    ctx = RequestContext(method="POST", path="/api/test-bad")
    res = test_router.dispatch(ctx)
    assert res.status_code == 400
    assert res.data["success"] is False
    assert res.data["error"]["code"] == "BAD_REQUEST"
    assert "Custom validation error message" in res.data["error"]["message"]


def test_router_vitals_endpoints() -> None:
    """Verify /api/vitals GET and POST endpoints."""
    # Test POST vitals
    post_ctx = RequestContext(
        method="POST",
        path="/api/vitals",
        body={"temperature": "98.6 F", "blood_pressure": "120/80"},
    )
    res_post = api_router.dispatch(post_ctx)
    assert res_post.status_code == 200
    assert res_post.data["success"] is True

    # Test GET vitals
    get_ctx = RequestContext(method="GET", path="/api/vitals")
    res_get = api_router.dispatch(get_ctx)
    assert res_get.status_code == 200
    assert res_get.data["temperature"] == "98.6 F"
    assert res_get.data["blood_pressure"] == "120/80"
