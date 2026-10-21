"""Triage and Clinical Decision Support API Endpoints."""
from __future__ import annotations

from typing import Any, Dict

from ai.pipeline import get_pipeline
from ai.schemas import Language
from api.context import RequestContext
from api.router import Router
from core.errors import BadRequestError
from services.summary import generate_asha_summary


def register_triage_routes(router: Router) -> None:
    """Register symptom assessment and ASHA summary memo routes."""

    @router.post("/api/triage")
    def post_triage(ctx: RequestContext) -> Dict[str, Any]:
        """Process symptom narrative, execute safety rules and Groq AI triage."""
        text = ctx.body.get("text", "").strip()
        if not text:
            raise BadRequestError("Symptom text is required")

        lang_str = ctx.body.get("language", "en").lower()
        try:
            language = Language(lang_str)
        except Exception:
            language = Language.EN

        follow_ups = ctx.body.get("follow_ups", [])
        session_id = ctx.body.get("session_id", "web-session")

        pipeline = get_pipeline()
        result = pipeline.process_triage(
            user_text=text,
            follow_up_answers=follow_ups,
            language=language,
            session_id=session_id,
        )

        # Generate clinician/ASHA summary memo
        summary_memo = generate_asha_summary(
            result=result,
            raw_symptom_text=text,
            follow_up_answers=follow_ups,
            language=language,
        )

        return {
            "success": True,
            "triage_result": result.model_dump(),
            "summary_text": summary_memo,
        }
