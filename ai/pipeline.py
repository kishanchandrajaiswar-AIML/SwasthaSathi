"""End-to-end triage decision-support pipeline for SwasthaSathi.

NON-NEGOTIABLE SAFETY RULES:
1. Deterministic rule engine runs BEFORE and AFTER the LLM.
2. Any red-flag match returns EMERGENCY immediately with no LLM call.
3. Final risk = max(rules_floor, llm_risk). The LLM can raise risk, never lower it.
4. Invalid, slow or low-confidence LLM output means at least VISIT_PHC.
5. All LLM outputs validated with Pydantic; invalid output discarded.
6. Redact phone numbers before any external API call.
7. Output filter blocks diagnoses and doses.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, Field

from ai.fallback import get_conservative_assessment, get_template_questions
from ai.llm_client import LLMClient, get_llm_client
from ai.schemas import (
    Confidence,
    Language,
    LLMAssessment,
    PatientContext,
    RiskLevel,
    RiskSource,
    Symptom,
    TriageResult,
    UrgencyLabel,
)
from safety.rule_engine import RuleEngine, get_rule_engine
from safety.validator import SafetyValidator, get_safety_validator

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# Basic PII regex for Indian mobile numbers
PHONE_REGEX = re.compile(r"\b(\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}\b")


def redact_pii(text: str) -> str:
    """Redact phone numbers before any external LLM call."""
    if not text:
        return ""
    return PHONE_REGEX.sub("[PHONE_REDACTED]", text)


class SymptomExtractionResult(BaseModel):
    symptoms: list[Symptom] = Field(default_factory=list)
    patient_context: PatientContext = Field(default_factory=PatientContext)


class FollowUpQuestion(BaseModel):
    id: str
    text: str
    type: str = "yes_no"  # "yes_no", "choice", "text"
    options: list[str] = Field(default_factory=list)


class FollowUpResult(BaseModel):
    questions: list[FollowUpQuestion] = Field(default_factory=list)


class TriagePipeline:
    """Triage orchestration pipeline following Section 7.1 master application flow."""

    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        rule_engine: Optional[RuleEngine] = None,
        validator: Optional[SafetyValidator] = None,
    ) -> None:
        self.llm = llm_client or get_llm_client()
        self.rule_engine = rule_engine or get_rule_engine()
        self.validator = validator or get_safety_validator()

        self._load_prompts()

    def _load_prompts(self) -> None:
        self.system_prompt = (PROMPTS_DIR / "triage_system.txt").read_text(encoding="utf-8")
        self.extract_prompt = (PROMPTS_DIR / "extract.txt").read_text(encoding="utf-8")
        self.followup_prompt = (PROMPTS_DIR / "followup.txt").read_text(encoding="utf-8")

    def extract_symptoms(self, text: str) -> SymptomExtractionResult:
        """Extract structured symptoms from user text via LLM with Pydantic validation."""
        clean_text = redact_pii(text)
        res = self.llm.generate_json(
            system_prompt=self.extract_prompt,
            user_prompt=f"User text: {clean_text}",
        )

        if res.success and res.json_data:
            try:
                return SymptomExtractionResult.model_validate(res.json_data)
            except Exception:
                pass

        # Fallback symptom structure
        return SymptomExtractionResult(
            symptoms=[Symptom(name=clean_text[:80] or "unspecified symptoms")],
            patient_context=PatientContext(),
        )

    def generate_follow_up_questions(
        self,
        symptoms: list[Symptom],
        language: Language = Language.EN,
    ) -> list[FollowUpQuestion]:
        """Generate follow-up questions, falling back to vetted templates on failure."""
        symptom_summary = ", ".join(s.name for s in symptoms)
        user_prompt = (
            f"Language: {language.value}\n"
            f"Extracted symptoms: {symptom_summary}\n"
            "Generate at most 4 concise follow-up questions."
        )

        res = self.llm.generate_json(
            system_prompt=self.followup_prompt.replace("{output_language}", language.value),
            user_prompt=user_prompt,
        )

        if res.success and res.json_data:
            try:
                parsed = FollowUpResult.model_validate(res.json_data)
                if parsed.questions:
                    return parsed.questions[:5]
            except Exception:
                pass

        # Use vetted template questions on failure / timeout
        templates = get_template_questions(language)
        return [FollowUpQuestion.model_validate(t) for t in templates]

    def assess_risk(
        self,
        user_text: str,
        symptoms: list[Symptom],
        follow_up_answers: list[dict[str, str]],
        rule_result: Any,
        language: Language = Language.EN,
    ) -> tuple[Optional[LLMAssessment], bool]:
        """Call LLM for structured risk assessment (Prompt 3), validated with Pydantic.

        Returns (assessment, fallback_used).
        """
        answers_str = "; ".join(f"{a.get('question', '')}: {a.get('answer', '')}" for a in follow_up_answers)
        symptoms_str = json.dumps([s.model_dump() for s in symptoms])

        user_prompt = (
            f"output_language: {language.value}\n"
            f"extracted_symptoms: {symptoms_str}\n"
            f"follow_up_answers: {answers_str}\n"
            f"rules_floor: {rule_result.risk_floor.value}\n"
            f"red_flags: {[rf.rule_id for rf in rule_result.red_flags]}\n"
            f"allowed_first_aid_ids: {sorted(list(self.validator.allowed_first_aid_ids))}\n"
            f"allowed_warning_sign_ids: {sorted(list(self.validator.allowed_warning_sign_ids))}\n"
        )

        res = self.llm.generate_json(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
        )

        if res.success and res.json_data:
            try:
                assessment = LLMAssessment.model_validate(res.json_data)
                return assessment, res.fallback_used
            except Exception:
                # Pydantic schema validation failed: discard output
                pass

        # Fallback conservative assessment
        return get_conservative_assessment(language), True

    def process_triage(
        self,
        user_text: str,
        follow_up_answers: Optional[list[dict[str, str]]] = None,
        language: Language = Language.EN,
        session_id: str = "demo-session",
    ) -> TriageResult:
        """Execute full triage pipeline according to Blueprint specifications."""
        # Step 1: Redact PII from user text
        clean_text = redact_pii(user_text)

        # Step 2: Red-Flag Rule Engine runs FIRST (Deterministic, offline)
        # Combine initial text with any follow-up answers for comprehensive rule coverage
        combined_text = clean_text
        if follow_up_answers:
            answers_text = " ".join(a.get("answer", "") for a in follow_up_answers)
            combined_text = f"{clean_text} {answers_text}"

        rule_result = self.rule_engine.evaluate(combined_text)

        # Step 3: Any red-flag match returns EMERGENCY immediately with no LLM call
        if rule_result.emergency:
            return self.validator.merge_assessment(
                rule_result=rule_result,
                llm_assessment=None,
                input_language=language,
                output_language=language,
                session_id=session_id,
            )

        # Step 4: Extract symptoms
        extraction = self.extract_symptoms(clean_text)

        # Step 5: Assess risk via LLM (or fallback)
        llm_assessment, fallback_used = self.assess_risk(
            user_text=clean_text,
            symptoms=extraction.symptoms,
            follow_up_answers=follow_up_answers or [],
            rule_result=rule_result,
            language=language,
        )

        # Step 6: Safety Validator merges: final = max(rules_floor, llm_risk)
        final_result = self.validator.merge_assessment(
            rule_result=rule_result,
            llm_assessment=llm_assessment,
            input_language=language,
            output_language=language,
            session_id=session_id,
            fallback_used=fallback_used,
        )

        final_result.symptoms = extraction.symptoms
        final_result.patient_context = extraction.patient_context
        final_result.meta.fallback_used = fallback_used
        final_result.meta.rules_version = self.rule_engine.rules_file.rules_version

        return final_result


_DEFAULT_PIPELINE: Optional[TriagePipeline] = None


def get_pipeline() -> TriagePipeline:
    global _DEFAULT_PIPELINE
    if _DEFAULT_PIPELINE is None:
        _DEFAULT_PIPELINE = TriagePipeline()
    return _DEFAULT_PIPELINE
