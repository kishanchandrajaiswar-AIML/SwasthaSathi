"""Voice and Speech-to-Text API Endpoints."""
from __future__ import annotations

import base64
from typing import Any, Dict

from api.context import RequestContext
from api.router import Router
from core.errors import BadRequestError
from services.stt import transcribe_audio_bytes


def register_voice_routes(router: Router) -> None:
    """Register voice input and speech-to-text transcription routes."""

    @router.post("/api/transcribe")
    def post_transcribe(ctx: RequestContext) -> Dict[str, Any]:
        """Transcribe base64 encoded audio bytes using Groq Whisper."""
        audio_b64 = ctx.body.get("audio_base64", "")
        lang_hint = ctx.body.get("language", "hi")

        if not audio_b64:
            raise BadRequestError("No audio data provided")

        ext = "webm"
        if "data:audio/" in audio_b64:
            prefix = audio_b64.split(";")[0]
            mime_part = prefix.replace("data:", "").lower()
            if "wav" in mime_part:
                ext = "wav"
            elif "mp4" in mime_part or "m4a" in mime_part:
                ext = "m4a"
            elif "ogg" in mime_part:
                ext = "ogg"
            elif "mp3" in mime_part:
                ext = "mp3"

        if "," in audio_b64:
            audio_b64 = audio_b64.split(",", 1)[1]

        try:
            audio_bytes = base64.b64decode(audio_b64)
        except Exception:
            raise BadRequestError("Invalid base64 audio data")

        ok, transcript, err = transcribe_audio_bytes(
            audio_bytes,
            language_hint=lang_hint,
            filename=f"recording.{ext}",
        )

        return {
            "success": ok,
            "transcript": transcript,
            "error": err,
        }
