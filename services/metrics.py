"""Anonymous usage and safety metrics tracker for SwasthaSathi.

STRICT PRIVACY POLICY:
- Never records symptom text, personal names, phone numbers, or free text.
- Only counts anonymous totals: sessions, triage risk levels, latencies, fallback usage.
"""
from __future__ import annotations

import threading
from typing import Any

from ai.schemas import RiskLevel, RiskSource

_METRICS_LOCK = threading.Lock()
_METRICS = {
    "total_sessions": 0,
    "emergency_count": 0,
    "visit_phc_count": 0,
    "home_care_count": 0,
    "rules_override_count": 0,
    "fallback_used_count": 0,
    "total_latency_ms": 0,
    "languages": {"en": 0, "hi": 0, "mr": 0},
}


def record_triage_metric(
    risk_level: RiskLevel,
    risk_source: RiskSource,
    fallback_used: bool,
    language_code: str,
    latency_ms: int = 0,
) -> None:
    """Safely increment anonymous triage metrics counters."""
    with _METRICS_LOCK:
        _METRICS["total_sessions"] += 1

        if risk_level == RiskLevel.EMERGENCY:
            _METRICS["emergency_count"] += 1
        elif risk_level == RiskLevel.VISIT_PHC:
            _METRICS["visit_phc_count"] += 1
        else:
            _METRICS["home_care_count"] += 1

        if risk_source == RiskSource.RULES:
            _METRICS["rules_override_count"] += 1

        if fallback_used:
            _METRICS["fallback_used_count"] += 1

        _METRICS["total_latency_ms"] += max(0, latency_ms)

        lang = language_code.lower()
        if lang in _METRICS["languages"]:
            _METRICS["languages"][lang] += 1


def get_metrics_summary() -> dict[str, Any]:
    """Return a read-only snapshot of current session metrics."""
    with _METRICS_LOCK:
        total = _METRICS["total_sessions"]
        avg_latency = int(_METRICS["total_latency_ms"] / total) if total > 0 else 0
        return {
            "total_sessions": total,
            "emergency_count": _METRICS["emergency_count"],
            "visit_phc_count": _METRICS["visit_phc_count"],
            "home_care_count": _METRICS["home_care_count"],
            "rules_override_count": _METRICS["rules_override_count"],
            "fallback_used_count": _METRICS["fallback_used_count"],
            "avg_latency_ms": avg_latency,
            "languages": dict(_METRICS["languages"]),
        }
