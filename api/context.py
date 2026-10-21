"""API Request and Response Context Structures."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class RequestContext:
    """Encapsulates parsed HTTP request data."""

    method: str
    path: str
    query_params: Dict[str, list[str]] = field(default_factory=dict)
    body: Dict[str, Any] = field(default_factory=dict)
    raw_body: bytes = b""
    headers: Dict[str, str] = field(default_factory=dict)

    def get_query(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Get first query parameter value or default."""
        vals = self.query_params.get(key, [])
        return vals[0] if vals else default

    def get_query_float(self, key: str, default: Optional[float] = None) -> Optional[float]:
        """Parse float query parameter safely."""
        val = self.get_query(key)
        if val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    def get_query_int(self, key: str, default: Optional[int] = None) -> Optional[int]:
        """Parse int query parameter safely."""
        val = self.get_query(key)
        if val is None:
            return default
        try:
            return int(val)
        except (ValueError, TypeError):
            return default

    def get_query_bool(self, key: str, default: bool = False) -> bool:
        """Parse boolean query parameter safely."""
        val = self.get_query(key)
        if val is None:
            return default
        return val.lower() in ("true", "1", "yes")


@dataclass
class APIResponse:
    """Encapsulates API response data and status code."""

    data: Any
    status_code: int = 200
    headers: Dict[str, str] = field(default_factory=dict)
