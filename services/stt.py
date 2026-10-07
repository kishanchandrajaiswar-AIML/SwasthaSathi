"""Speech-to-text service using Groq-hosted Whisper model.

Follows Blueprint Section 13.3 & Section 25.1:
- Uses Groq Whisper for Indian accented audio and multilingual transcription
- Falls back gracefully to manual text typing if audio transcription fails or key is missing
"""
from __future__ import annotations

import io
import logging
import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

WHISPER_MODELS = [
    "whisper-large-v3-turbo",
    "whisper-large-v3",
]


def transcribe_audio_bytes(
    audio_bytes: bytes,
    language_hint: Optional[str] = None,
    filename: str = "audio.wav",
) -> tuple[bool, str, Optional[str]]:
    """Transcribe audio bytes using Groq Whisper API.

    Returns: (success: bool, transcript: str, error: Optional[str])
    """
    if not audio_bytes:
        return False, "", "Empty audio recording received"

    groq_api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not groq_api_key:
        return False, "", "Groq API key not configured for voice transcription. Please type your symptoms."

    try:
        from groq import Groq

        client = Groq(api_key=groq_api_key, timeout=20.0)

        # Create in-memory file tuple
        file_tuple = (filename, io.BytesIO(audio_bytes), "audio/wav")

        lang = language_hint if language_hint in ("hi", "mr", "en") else None

        for model in WHISPER_MODELS:
            try:
                kwargs = {
                    "file": file_tuple,
                    "model": model,
                    "response_format": "text",
                    "temperature": 0.0,
                }
                if lang:
                    kwargs["language"] = lang

                res = client.audio.transcriptions.create(**kwargs)
                transcript = str(res).strip()
                if transcript:
                    return True, transcript, None
            except Exception as e:
                logger.warning(f"Groq Whisper model {model} failed: {e}")
                continue

        return False, "", "Voice transcription service temporarily unavailable. Please type your symptoms."
    except Exception as e:
        logger.error(f"Speech to text failed: {e}")
        return False, "", f"Voice processing error: {str(e)[:80]}. Please type your symptoms."
