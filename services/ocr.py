"""OCR service extracting text from uploaded laboratory report images.

Follows Blueprint Section 13.4 and 25.1:
- Multi-engine approach: Tesseract (local) / Gemini Vision (if configured) / simulated fallback
- Never crashes on missing libraries or unreadable photos
"""
from __future__ import annotations

import io
import logging
import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def extract_text_from_image(image_bytes: bytes) -> tuple[bool, str, Optional[str]]:
    """Extract plain text from lab report image.

    Returns: (success: bool, text: str, error: Optional[str])
    """
    if not image_bytes:
        return False, "", "Empty image provided"

    # Attempt 1: Gemini Vision (if GEMINI_API_KEY available)
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if gemini_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=gemini_key)
            prompt = "Extract all text, lab test names, results, units, and printed reference ranges exactly as shown in this medical report image. Output the raw text only."

            image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            res = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[image_part, prompt],
            )
            text = (res.text or "").strip()
            if text:
                return True, text, None
        except Exception as e:
            logger.warning(f"Gemini Vision OCR failed: {e}")

    # Attempt 2: Local pytesseract (if installed and configured)
    try:
        import pytesseract
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(image)
        if text and len(text.strip()) > 10:
            return True, text.strip(), None
    except Exception as e:
        logger.warning(f"Pytesseract OCR failed or not installed: {e}")

    # Attempt 3: If image cannot be read, return error instructing user to retake photo
    return (
        False,
        "",
        "Unable to read text from this image. Please ensure the report photo is well-lit, sharp, and not blurry.",
    )
