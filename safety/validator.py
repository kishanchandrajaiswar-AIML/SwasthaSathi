"""Safety validator and risk merging logic for SwasthaSathi.

NON-NEGOTIABLE SAFETY RULES (from Blueprint):
1. Final risk = max(rules_floor, llm_risk). The LLM can raise risk, never lower it.
2. Low-confidence or invalid LLM output means at least VISIT_PHC.
3. First-aid and warning signs come from vetted JSON libraries by ID only.
4. Output filter blocks diagnosis phrasing and dose patterns.
5. Never diagnoses, never recommends medicines or doses, never claims clinical validation.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

from ai.schemas import (
    Confidence,
    FirstAidId,
    Language,
    LLMAssessment,
    RedFlag,
    RiskLevel,
    RiskSource,
    TriageResult,
    UrgencyLabel,
    WarningSignId,
    max_risk,
)
from safety.rule_engine import RuleEngineResult

FIRST_AID_JSON_PATH = Path(__file__).parent / "first_aid.json"
WARNING_SIGNS_JSON_PATH = Path(__file__).parent / "warning_signs.json"
DISCLAIMERS_JSON_PATH = Path(__file__).parent / "disclaimers.json"

# Regex patterns detecting diagnosis claims
DIAGNOSIS_PATTERNS = [
    re.compile(r"\byou have\b", re.IGNORECASE),
    re.compile(r"\bthis is\s+(a\s+case\s+of\s+)?(pneumonia|malaria|typhoid|dengue|covid|bronchitis|angina|stroke|appendicitis)\b", re.IGNORECASE),
    re.compile(r"\byou are suffering from\b", re.IGNORECASE),
    re.compile(r"\bdiagnosed with\b", re.IGNORECASE),
    re.compile(r"\bdiagnosis is\b", re.IGNORECASE),
    re.compile(r"\b(aapko|apko)\s+([a-zA-Z\u0900-\u097f]+)\s+(hai|ho gaya hai)\b", re.IGNORECASE),
    re.compile(r"\b(tumhala|tula)\s+([a-zA-Z\u0900-\u097f]+)\s+(zala ahe|jhala ahe)\b", re.IGNORECASE),
]

# Regex patterns detecting drug doses / tablet counts / medicine regimens
DOSE_PATTERNS = [
    re.compile(
        r"\b(\d+(\.\d+)?|one|two|three|four|five|half|ek|do|teen|char|aadha|adha|don)\s*(mg|ml|mcg|gm|gram|grams|drops?|tablets?|capsules?|pills?|goli|goliyan|chamach|chammach)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(take|give|consume|le|lo|dijiye|ghya|dya)\s+(\d+|one|two|three|ek|do|teen)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(twice|thrice|\d+\s*times)\s+a\s+day\b", re.IGNORECASE),
    re.compile(
        r"\b(din me|divsat)\s+(\d+|ek|do|teen)\s*(baar|vela)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(goli|tablet|pill)\s+(subah|sham|duphar|roz|daily|din me)\b",
        re.IGNORECASE,
    ),
]

SAFE_MEDICATION_BOUNDARY_TEXT = (
    "Please ask a doctor or pharmacist; SwasthaSathi cannot advise on medicines or doses."
)
SAFE_DIAGNOSIS_BOUNDARY_TEXT = (
    "Please consult a healthcare professional for clinical assessment and diagnosis."
)


class SafetyValidator:
    """Validates outputs, merges risk deterministically, and sanitizes medical text."""

    def __init__(
        self,
        first_aid_path: Path = FIRST_AID_JSON_PATH,
        warning_signs_path: Path = WARNING_SIGNS_JSON_PATH,
    ) -> None:
        self.allowed_first_aid_ids = self._load_ids(first_aid_path)
        self.allowed_warning_sign_ids = self._load_ids(warning_signs_path)

    @staticmethod
    def _load_ids(path: Path) -> set[str]:
        if not path.is_file():
            return set()
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {item["id"] for item in data if isinstance(item, dict) and "id" in item}

    def contains_diagnosis(self, text: str) -> bool:
        """Check if text contains diagnosis assertions."""
        if not text:
            return False
        return any(pattern.search(text) is not None for pattern in DIAGNOSIS_PATTERNS)

    def contains_dose(self, text: str) -> bool:
        """Check if text contains medicine dosage instructions."""
        if not text:
            return False
        return any(pattern.search(text) is not None for pattern in DOSE_PATTERNS)

    def filter_text(self, text: str) -> str:
        """Sanitize text by replacing diagnosis phrasing or dosing instructions."""
        if not text:
            return ""

        filtered = text
        if self.contains_dose(filtered):
            filtered = SAFE_MEDICATION_BOUNDARY_TEXT
        if self.contains_diagnosis(filtered):
            filtered = SAFE_DIAGNOSIS_BOUNDARY_TEXT
        return filtered

    def filter_first_aid_ids(self, ids: list[str]) -> list[FirstAidId]:
        """Keep only vetted first-aid IDs from library."""
        return [fid for fid in ids if fid in self.allowed_first_aid_ids]

    def filter_warning_sign_ids(self, ids: list[str]) -> list[WarningSignId]:
        """Keep only vetted warning sign IDs from library."""
        return [wid for wid in ids if wid in self.allowed_warning_sign_ids]

    def merge_assessment(
        self,
        rule_result: RuleEngineResult,
        llm_assessment: Optional[LLMAssessment] = None,
        input_language: Language = Language.EN,
        output_language: Language = Language.EN,
        session_id: str = "demo-session",
        fallback_used: bool = False,
    ) -> TriageResult:
        """Merge rule engine results with optional LLM assessment.

        Enforces:
        - final = max(rules_floor, llm_risk)
        - LLM cannot lower risk
        - If LLM is missing or low-confidence, floor is at least VISIT_PHC (unless rules say EMERGENCY)
        - ID vetting
        - Text sanitization
        """
        rules_floor = rule_result.risk_floor

        # Case 1: Red flags triggered or Emergency in rules -> Short circuit to emergency
        if rules_floor == RiskLevel.EMERGENCY:
            final_risk = RiskLevel.EMERGENCY
            urgency = None
            risk_source = RiskSource.RULES
            confidence = Confidence.HIGH

            first_aid = self.filter_first_aid_ids(rule_result.first_aid_ids)
            if not first_aid:
                first_aid = ["FA_CALL_112"]

            return TriageResult(
                session_id=session_id,
                input_language=input_language,
                output_language=output_language,
                risk_level=final_risk,
                urgency_label=urgency,
                risk_source=risk_source,
                llm_confidence=confidence,
                emergency=True,
                red_flags=rule_result.red_flags,
                first_aid_ids=first_aid,
                warning_signs_to_return=[],
                recommended_action="Call 112 or 108 immediately or go to the nearest hospital.",
                reasoning_summary="Emergency safety rule triggered by severe symptoms.",
                uncertainty_notes="Critical safety override applied deterministically.",
                disclaimer_id="DISC_EMERGENCY",
            )

        # Case 2: No LLM assessment available or invalid -> Fallback
        if llm_assessment is None:
            # Conservative floor: at least VISIT_PHC if user has symptoms
            final_risk = max_risk(rules_floor, RiskLevel.VISIT_PHC)
            urgency = UrgencyLabel.TODAY
            risk_source = RiskSource.FALLBACK
            confidence = Confidence.LOW

            return TriageResult(
                session_id=session_id,
                input_language=input_language,
                output_language=output_language,
                risk_level=final_risk,
                urgency_label=urgency,
                risk_source=risk_source,
                llm_confidence=confidence,
                emergency=False,
                red_flags=rule_result.red_flags,
                first_aid_ids=self.filter_first_aid_ids(rule_result.first_aid_ids),
                warning_signs_to_return=self.filter_warning_sign_ids(
                    rule_result.warning_sign_ids or ["WS_NOT_DRINKING", "WS_VERY_DROWSY"]
                ),
                recommended_action="Visit the nearest Primary Health Centre (PHC) or doctor for an evaluation.",
                reasoning_summary="Automated fallback applied. Clinician assessment is advised.",
                uncertainty_notes="Assessment could not be verified by LLM; defaulting to conservative clinic referral.",
                disclaimer_id="DISC_UNCERTAINTY",
            )

        # Case 3: LLM assessment provided
        # Rule: Low confidence LLM means at least VISIT_PHC
        if llm_assessment.llm_confidence == Confidence.LOW:
            min_llm_floor = RiskLevel.VISIT_PHC
            effective_llm_risk = max_risk(llm_assessment.risk_level, min_llm_floor)
        else:
            effective_llm_risk = llm_assessment.risk_level

        # Fundamental safety rule: final = max(rules_floor, llm_risk)
        final_risk = max_risk(rules_floor, effective_llm_risk)

        # Determine risk source for auditability
        if fallback_used:
            risk_source = RiskSource.FALLBACK
        elif final_risk.rank > effective_llm_risk.rank:
            risk_source = RiskSource.RULES
        elif final_risk.rank > rules_floor.rank:
            risk_source = RiskSource.LLM
        else:
            risk_source = RiskSource.MERGED

        # Urgency label handling
        if final_risk == RiskLevel.VISIT_PHC:
            urgency = (
                rule_result.urgency
                or llm_assessment.urgency_label
                or UrgencyLabel.TODAY
            )
        else:
            urgency = None

        # Sanitize LLM text fields
        recommended_action = self.filter_text(llm_assessment.recommended_action)
        reasoning_summary = self.filter_text(llm_assessment.reasoning_summary)
        uncertainty_notes = self.filter_text(llm_assessment.uncertainty_notes)

        # Merge and vet IDs (Union of rules IDs + vetted LLM IDs)
        combined_fa = set(rule_result.first_aid_ids) | set(llm_assessment.first_aid_ids)
        combined_ws = set(rule_result.warning_sign_ids) | set(llm_assessment.warning_signs_to_return)

        vetted_fa = self.filter_first_aid_ids(sorted(combined_fa))
        vetted_ws = self.filter_warning_sign_ids(sorted(combined_ws))

        is_emergency = final_risk == RiskLevel.EMERGENCY

        return TriageResult(
            session_id=session_id,
            input_language=input_language,
            output_language=output_language,
            risk_level=final_risk,
            urgency_label=urgency,
            risk_source=risk_source,
            llm_confidence=llm_assessment.llm_confidence,
            emergency=is_emergency,
            red_flags=rule_result.red_flags,
            first_aid_ids=vetted_fa,
            warning_signs_to_return=vetted_ws,
            recommended_action=recommended_action,
            reasoning_summary=reasoning_summary,
            uncertainty_notes=uncertainty_notes,
            disclaimer_id="DISC_EMERGENCY" if is_emergency else "DISC_STANDARD",
        )


# Singleton
_DEFAULT_VALIDATOR: Optional[SafetyValidator] = None


def get_safety_validator() -> SafetyValidator:
    global _DEFAULT_VALIDATOR
    if _DEFAULT_VALIDATOR is None:
        _DEFAULT_VALIDATOR = SafetyValidator()
    return _DEFAULT_VALIDATOR
