"""Laboratory Report Analysis API Endpoints."""
from __future__ import annotations

from typing import Any, Dict

from api.context import RequestContext
from api.router import Router
from core.errors import BadRequestError
from services.report import analyze_report_text


def register_reports_routes(router: Router) -> None:
    """Register laboratory report parsing and reference range evaluation routes."""

    @router.post("/api/report")
    def post_report(ctx: RequestContext) -> Dict[str, Any]:
        """Analyze laboratory values strictly against printed ranges."""
        report_text = ctx.body.get("text", "").strip()
        if not report_text:
            raise BadRequestError("Report text is required")

        analysis = analyze_report_text(report_text)
        return {
            "success": True,
            "analysis": analysis.model_dump(),
        }
