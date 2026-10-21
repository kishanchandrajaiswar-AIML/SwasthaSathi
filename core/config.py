"""Centralized Application Configuration.

Manages all environment variables, file paths, and service configurations
in a single location to ensure environment settings are separated from code.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv

# Resolve project root directory
ROOT_DIR = Path(__file__).resolve().parent.parent

# Load environment configuration from .env file
load_dotenv(ROOT_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    """Application runtime settings and environment configurations."""

    # Project Directories
    root_dir: Path = ROOT_DIR
    web_dir: Path = ROOT_DIR / "web"
    data_dir: Path = ROOT_DIR / "data"
    safety_dir: Path = ROOT_DIR / "safety"

    # Server Configuration
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8080"))
    debug: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # AI & Cloud API Keys
    groq_api_key: str = os.getenv("GROQ_API_KEY", "").strip()
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
    supabase_url: str = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "").strip()
    supabase_anon_key: str = (os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY") or "").strip()

    # Clinical Safety & Rules Version
    rules_version: str = "2026.1-safety-v1"

    @property
    def is_groq_configured(self) -> bool:
        """Return True if a valid Groq API key is present."""
        return bool(self.groq_api_key and not self.groq_api_key.startswith("gsk_your"))

    @property
    def is_gemini_configured(self) -> bool:
        """Return True if a valid Gemini API key is present."""
        return bool(self.gemini_api_key)

    @property
    def is_supabase_configured(self) -> bool:
        """Return True if both Supabase URL and Anon key are present."""
        return bool(self.supabase_url and self.supabase_anon_key and "your-project" not in self.supabase_url)

    def get_public_config(self) -> Dict[str, Any]:
        """Return safe client-facing configuration without exposing private server secrets."""
        return {
            "supabase_url": self.supabase_url,
            "supabase_anon_key": self.supabase_anon_key,
            "supabase_configured": self.is_supabase_configured,
            "rules_version": self.rules_version,
            "offline_mode": not self.is_groq_configured,
        }

    def get_system_status(self) -> Dict[str, Any]:
        """Return diagnostic system status dictionary for /api/status."""
        return {
            "status": "online",
            "groq_configured": self.is_groq_configured,
            "gemini_configured": self.is_gemini_configured,
            "supabase_configured": self.is_supabase_configured,
            "offline_rules_active": True,
            "rules_version": self.rules_version,
        }


# Global settings singleton instance
settings = Settings()
