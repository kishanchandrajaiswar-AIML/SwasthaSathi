"""LLM client for SwasthaSathi with Gemini primary, Groq fallback, retries, and mock mode.

NON-NEGOTIABLE SAFETY RULES:
1. Never crashes under any network, quota, rate-limit, or syntax errors.
2. Structured JSON mode only.
3. API keys loaded from environment variables, never in code.
4. Fallback chain: Gemini (if configured) -> Groq -> Mock/Fallback.
5. Latency and fallback status recorded in meta.
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Preferred Groq models (in order of priority)
GROQ_MODELS = [
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]

# Preferred Gemini models
GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
]

DEFAULT_TIMEOUT_SEC = 12.0


@dataclass
class LLMResult:
    success: bool
    raw_text: str = ""
    json_data: Optional[dict[str, Any]] = None
    provider_used: str = "none"  # 'gemini', 'groq', 'mock'
    model_used: str = "none"
    fallback_used: bool = False
    latency_ms: int = 0
    error: Optional[str] = None


class LLMClient:
    """Resilient LLM client supporting Gemini primary, Groq fallback, and test mocking."""

    def __init__(
        self,
        gemini_api_key: Optional[str] = None,
        groq_api_key: Optional[str] = None,
        timeout_sec: float = DEFAULT_TIMEOUT_SEC,
    ) -> None:
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY", "").strip() if gemini_api_key is None else gemini_api_key.strip()
        self.groq_api_key = os.environ.get("GROQ_API_KEY", "").strip() if groq_api_key is None else groq_api_key.strip()
        self.timeout_sec = timeout_sec

        # Mock mode configuration
        self.mock_mode = False
        self.mock_behavior = "normal"  # 'normal', 'fail', 'invalid_json', 'timeout'
        self.mock_response: Optional[dict[str, Any]] = None

        # Lazy client singletons
        self._groq_client = None
        self._gemini_client = None

    def enable_mock_mode(
        self,
        behavior: str = "normal",
        response: Optional[dict[str, Any]] = None,
    ) -> None:
        """Enable offline mock mode for deterministic tests."""
        self.mock_mode = True
        self.mock_behavior = behavior
        self.mock_response = response

    def disable_mock_mode(self) -> None:
        """Disable mock mode and restore live API calls."""
        self.mock_mode = False
        self.mock_behavior = "normal"
        self.mock_response = None

    def _get_groq_client(self):
        if self._groq_client is None and self.groq_api_key:
            try:
                from groq import Groq

                self._groq_client = Groq(api_key=self.groq_api_key, timeout=self.timeout_sec)
            except Exception as e:
                logger.warning(f"Could not initialize Groq client: {e}")
        return self._groq_client

    def _get_gemini_client(self):
        if self._gemini_client is None and self.gemini_api_key:
            try:
                from google import genai

                self._gemini_client = genai.Client(api_key=self.gemini_api_key)
            except Exception as e:
                logger.warning(f"Could not initialize Gemini client: {e}")
        return self._gemini_client

    def _call_gemini(
        self, system_prompt: str, user_prompt: str
    ) -> tuple[bool, str, Optional[dict[str, Any]], str, Optional[str]]:
        client = self._get_gemini_client()
        if not client:
            return False, "", None, "none", "Gemini client or API key not available"

        last_err = None
        for model in GEMINI_MODELS:
            try:
                from google.genai import types

                config = types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=0.1,
                )
                response = client.models.generate_content(
                    model=model,
                    contents=user_prompt,
                    config=config,
                )
                raw_text = response.text or ""
                parsed = json.loads(raw_text)
                return True, raw_text, parsed, model, None
            except Exception as err:
                last_err = str(err)
                continue

        return False, "", None, "gemini", last_err

    def _call_groq(
        self, system_prompt: str, user_prompt: str
    ) -> tuple[bool, str, Optional[dict[str, Any]], str, Optional[str]]:
        client = self._get_groq_client()
        if not client:
            return False, "", None, "none", "Groq client or API key not available"

        last_err = None
        for model in GROQ_MODELS:
            try:
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.1,
                )
                raw_text = response.choices[0].message.content or ""
                parsed = json.loads(raw_text)
                return True, raw_text, parsed, model, None
            except Exception as err:
                last_err = str(err)
                continue

        return False, "", None, "groq", last_err

    def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        retries: int = 1,
    ) -> LLMResult:
        """Call LLM returning structured JSON, never crashing."""
        start_time = time.perf_counter()

        # Handle Mock Mode first
        if self.mock_mode:
            latency = int((time.perf_counter() - start_time) * 1000)
            if self.mock_behavior == "fail":
                return LLMResult(
                    success=False,
                    provider_used="mock",
                    latency_ms=latency,
                    error="Simulated API failure (Mock Mode)",
                )
            if self.mock_behavior == "invalid_json":
                return LLMResult(
                    success=False,
                    raw_text="INVALID_JSON{{not-a-valid-structure",
                    provider_used="mock",
                    latency_ms=latency,
                    error="Simulated invalid JSON (Mock Mode)",
                )
            if self.mock_behavior == "timeout":
                return LLMResult(
                    success=False,
                    provider_used="mock",
                    latency_ms=int(self.timeout_sec * 1000),
                    error="Simulated API timeout (Mock Mode)",
                )
            # Normal mock response
            data = self.mock_response or {}
            return LLMResult(
                success=True,
                raw_text=json.dumps(data),
                json_data=data,
                provider_used="mock",
                model_used="mock-model",
                latency_ms=latency,
            )

        # 1. Attempt Primary: Gemini (if configured)
        if self.gemini_api_key:
            for attempt in range(retries + 1):
                success, raw, parsed, model, err = self._call_gemini(system_prompt, user_prompt)
                if success:
                    latency = int((time.perf_counter() - start_time) * 1000)
                    return LLMResult(
                        success=True,
                        raw_text=raw,
                        json_data=parsed,
                        provider_used="gemini",
                        model_used=model,
                        fallback_used=False,
                        latency_ms=latency,
                    )
                if attempt < retries:
                    time.sleep(0.5)

        # 2. Attempt Fallback / Primary Workhorse: Groq
        if self.groq_api_key:
            for attempt in range(retries + 1):
                success, raw, parsed, model, err = self._call_groq(system_prompt, user_prompt)
                if success:
                    latency = int((time.perf_counter() - start_time) * 1000)
                    # fallback_used is True if Gemini was attempted first
                    fallback_used = bool(self.gemini_api_key)
                    return LLMResult(
                        success=True,
                        raw_text=raw,
                        json_data=parsed,
                        provider_used="groq",
                        model_used=model,
                        fallback_used=fallback_used,
                        latency_ms=latency,
                    )
                if attempt < retries:
                    time.sleep(0.5)

        # 3. All providers failed or not configured: return graceful failure without crashing
        latency = int((time.perf_counter() - start_time) * 1000)
        return LLMResult(
            success=False,
            provider_used="none",
            model_used="none",
            fallback_used=True,
            latency_ms=latency,
            error="All LLM providers unavailable or failed. Fallback path engaged.",
        )


_DEFAULT_CLIENT: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    global _DEFAULT_CLIENT
    if _DEFAULT_CLIENT is None:
        _DEFAULT_CLIENT = LLMClient()
    return _DEFAULT_CLIENT
