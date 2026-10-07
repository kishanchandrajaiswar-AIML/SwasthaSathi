"""Unit tests for safety validator and merge logic (safety/validator.py).

Verifies non-negotiable safety rules:
1. Final risk = max(rules_floor, llm_risk). The LLM can raise risk, never lower it.
2. Low-confidence or invalid LLM output defaults to at least VISIT_PHC.
3. Dose pattern filter blocks drug names, milligram dosages, tablet counts.
4. Diagnosis pattern filter blocks clinical diagnosis claims ('you have X').
5. Unknown/unvetted first-aid or warning sign IDs are strictly discarded.
6. Schema consistency is preserved under all conditions.
"""
import pytest
from ai.schemas import (
    Confidence,
    Language,
    LLMAssessment,
    RiskLevel,
    RiskSource,
    UrgencyLabel,
)
from safety.rule_engine import RuleEngineResult
from safety.validator import SafetyValidator, get_safety_validator


@pytest.fixture(scope="module")
def validator() -> SafetyValidator:
    return get_safety_validator()


def test_llm_cannot_lower_emergency_rules_floor(validator: SafetyValidator) -> None:
    """Rules floor EMERGENCY + LLM proposing HOME_CARE -> Final MUST be EMERGENCY."""
    rule_res = RuleEngineResult(
        risk_floor=RiskLevel.EMERGENCY,
        emergency=True,
        first_aid_ids=["FA_CALL_112"],
    )
    llm_assessment = LLMAssessment(
        risk_level=RiskLevel.HOME_CARE,
        llm_confidence=Confidence.HIGH,
        recommended_action="Rest at home and drink fluids.",
    )

    merged = validator.merge_assessment(rule_res, llm_assessment)

    assert merged.risk_level == RiskLevel.EMERGENCY
    assert merged.emergency is True
    assert merged.risk_source in (RiskSource.RULES, RiskSource.MERGED)
    assert "FA_CALL_112" in merged.first_aid_ids


def test_llm_cannot_lower_visit_phc_rules_floor(validator: SafetyValidator) -> None:
    """Rules floor VISIT_PHC + LLM proposing HOME_CARE -> Final MUST be VISIT_PHC."""
    rule_res = RuleEngineResult(
        risk_floor=RiskLevel.VISIT_PHC,
        urgency=UrgencyLabel.TODAY,
        emergency=False,
        warning_sign_ids=["WS_NOT_DRINKING"],
    )
    llm_assessment = LLMAssessment(
        risk_level=RiskLevel.HOME_CARE,
        llm_confidence=Confidence.HIGH,
        recommended_action="Take rest.",
    )

    merged = validator.merge_assessment(rule_res, llm_assessment)

    assert merged.risk_level == RiskLevel.VISIT_PHC
    assert merged.urgency_label == UrgencyLabel.TODAY
    assert merged.emergency is False
    assert merged.risk_source == RiskSource.RULES


def test_llm_can_raise_risk_above_rules(validator: SafetyValidator) -> None:
    """Rules floor HOME_CARE + LLM escalates to EMERGENCY -> Final is EMERGENCY."""
    rule_res = RuleEngineResult(
        risk_floor=RiskLevel.HOME_CARE,
        emergency=False,
    )
    llm_assessment = LLMAssessment(
        risk_level=RiskLevel.EMERGENCY,
        llm_confidence=Confidence.HIGH,
        recommended_action="Seek emergency care immediately.",
        first_aid_ids=["FA_CALL_112"],
    )

    merged = validator.merge_assessment(rule_res, llm_assessment)

    assert merged.risk_level == RiskLevel.EMERGENCY
    assert merged.emergency is True
    assert merged.risk_source == RiskSource.LLM


def test_low_confidence_llm_raises_floor_to_visit_phc(validator: SafetyValidator) -> None:
    """Low confidence LLM output must not produce HOME_CARE; floor is raised to at least VISIT_PHC."""
    rule_res = RuleEngineResult(
        risk_floor=RiskLevel.HOME_CARE,
        emergency=False,
    )
    llm_assessment = LLMAssessment(
        risk_level=RiskLevel.HOME_CARE,
        llm_confidence=Confidence.LOW,
        recommended_action="Unsure, probably mild cold.",
    )

    merged = validator.merge_assessment(rule_res, llm_assessment)

    assert merged.risk_level == RiskLevel.VISIT_PHC
    assert merged.urgency_label is not None
    assert merged.emergency is False


def test_fallback_when_no_llm_assessment(validator: SafetyValidator) -> None:
    """When LLM is unavailable (None), safe conservative fallback is applied."""
    rule_res = RuleEngineResult(
        risk_floor=RiskLevel.HOME_CARE,
        emergency=False,
    )

    merged = validator.merge_assessment(rule_res, None)

    assert merged.risk_level == RiskLevel.VISIT_PHC
    assert merged.urgency_label == UrgencyLabel.TODAY
    assert merged.risk_source == RiskSource.FALLBACK
    assert merged.emergency is False


def test_dose_filter_blocks_prescription_dosages(validator: SafetyValidator) -> None:
    """Any output containing medication dosages (e.g. 500 mg, 2 tablets) is sanitized."""
    assert validator.contains_dose("Take 500 mg of paracetamol twice a day")
    assert validator.contains_dose("Give 2 tablets of ibuprofen")
    assert validator.contains_dose("ek goli subah aur do goli sham ko le")
    assert not validator.contains_dose("Drink plenty of boiled water and rest")

    filtered = validator.filter_text("Take 500 mg of paracetamol every 6 hours.")
    assert "500 mg" not in filtered
    assert "cannot advise on medicines or doses" in filtered


def test_diagnosis_filter_blocks_disease_assertions(validator: SafetyValidator) -> None:
    """Any output containing explicit diagnostic assertions ('you have X') is sanitized."""
    assert validator.contains_diagnosis("You have acute pneumonia and need antibiotics")
    assert validator.contains_diagnosis("This is a case of malaria")
    assert validator.contains_diagnosis("Aapko typhoid hai")
    assert not validator.contains_diagnosis("Your symptoms indicate fever and fatigue")

    filtered = validator.filter_text("You have pneumonia. Go to the hospital.")
    assert "You have pneumonia" not in filtered
    assert "clinical assessment and diagnosis" in filtered


def test_unvetted_ids_are_strictly_filtered(validator: SafetyValidator) -> None:
    """Only IDs present in vetted JSON libraries survive."""
    rule_res = RuleEngineResult(
        risk_floor=RiskLevel.HOME_CARE,
        emergency=False,
    )
    llm_assessment = LLMAssessment(
        risk_level=RiskLevel.VISIT_PHC,
        urgency_label=UrgencyLabel.TODAY,
        llm_confidence=Confidence.HIGH,
        first_aid_ids=["FA_CALL_112", "FA_INVENTED_MAGIC_HERB"],
        warning_signs_to_return=["WS_NOT_DRINKING", "WS_HALLUCINATED_FLAG"],
    )

    merged = validator.merge_assessment(rule_res, llm_assessment)

    # Vetted IDs kept
    assert "FA_CALL_112" in merged.first_aid_ids
    assert "WS_NOT_DRINKING" in merged.warning_signs_to_return

    # Unvetted IDs purged
    assert "FA_INVENTED_MAGIC_HERB" not in merged.first_aid_ids
    assert "WS_HALLUCINATED_FLAG" not in merged.warning_signs_to_return
