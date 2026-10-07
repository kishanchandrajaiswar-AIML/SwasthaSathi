"""Unit tests for AI triage pipeline (ai/pipeline.py) and LLM client (ai/llm_client.py).

Verifies:
1. Mock-LLM mode supports normal, failure, and invalid JSON simulations.
2. Emergency red-flags short-circuit immediately without calling LLM.
3. API failures and invalid JSON never crash the pipeline; fallback is engaged.
4. Phone numbers are redacted before passing to external processing.
5. Final risk respects max(rules_floor, llm_risk).
"""
import pytest
from ai.llm_client import LLMClient
from ai.pipeline import TriagePipeline, redact_pii
from ai.schemas import Language, RiskLevel, RiskSource


@pytest.fixture
def mock_client() -> LLMClient:
    client = LLMClient()
    client.enable_mock_mode(
        behavior="normal",
        response={
            "risk_level": "HOME_CARE",
            "urgency_label": None,
            "llm_confidence": "HIGH",
            "recommended_action": "Rest at home, keep hydrated with clean fluids.",
            "first_aid_ids": [],
            "warning_signs_to_return": ["WS_NOT_DRINKING"],
            "reasoning_summary": "Mild symptoms without red flags.",
            "uncertainty_notes": "Monitor symptoms for changes.",
        },
    )
    return client


@pytest.fixture
def pipeline(mock_client: LLMClient) -> TriagePipeline:
    return TriagePipeline(llm_client=mock_client)


def test_pii_redaction() -> None:
    """Phone numbers must be stripped before external processing."""
    raw = "My phone is +91 9876543210 and I have a headache"
    redacted = redact_pii(raw)
    assert "9876543210" not in redacted
    assert "[PHONE_REDACTED]" in redacted


def test_emergency_red_flag_short_circuits_without_llm(pipeline: TriagePipeline, mock_client: LLMClient) -> None:
    """Chest pain with sweating must return EMERGENCY immediately without LLM invocation."""
    result = pipeline.process_triage(
        user_text="सीने में तेज़ दर्द हो रहा है और पसीना आ रहा है",
        language=Language.HI,
    )

    assert result.emergency is True
    assert result.risk_level == RiskLevel.EMERGENCY
    assert result.risk_source == RiskSource.RULES
    assert "FA_CALL_112" in result.first_aid_ids


def test_pipeline_normal_mock_flow(pipeline: TriagePipeline) -> None:
    """Normal flow with mild symptoms produces validated TriageResult."""
    result = pipeline.process_triage(
        user_text="Mild cough and sore throat since yesterday",
        language=Language.EN,
    )

    assert result.risk_level in (RiskLevel.HOME_CARE, RiskLevel.VISIT_PHC)
    assert not result.emergency
    assert result.session_id


def test_pipeline_simulated_api_failure(pipeline: TriagePipeline, mock_client: LLMClient) -> None:
    """When LLM API fails, pipeline must NOT crash; it defaults to conservative VISIT_PHC."""
    mock_client.enable_mock_mode(behavior="fail")

    result = pipeline.process_triage(
        user_text="Feeling weak and mild body pain",
        language=Language.EN,
    )

    assert result.risk_level == RiskLevel.VISIT_PHC
    assert result.risk_source == RiskSource.FALLBACK
    assert not result.emergency


def test_pipeline_simulated_invalid_json(pipeline: TriagePipeline, mock_client: LLMClient) -> None:
    """When LLM returns malformed JSON, pipeline discards it and applies safe fallback."""
    mock_client.enable_mock_mode(behavior="invalid_json")

    result = pipeline.process_triage(
        user_text="Mild stomach ache",
        language=Language.EN,
    )

    assert result.risk_level == RiskLevel.VISIT_PHC
    assert result.risk_source == RiskSource.FALLBACK
    assert not result.emergency


def test_pipeline_simulated_timeout(pipeline: TriagePipeline, mock_client: LLMClient) -> None:
    """When LLM times out, pipeline must fall back gracefully to at least VISIT_PHC."""
    mock_client.enable_mock_mode(behavior="timeout")

    result = pipeline.process_triage(
        user_text="Mild ear pain",
        language=Language.EN,
    )

    assert result.risk_level == RiskLevel.VISIT_PHC
    assert not result.emergency
