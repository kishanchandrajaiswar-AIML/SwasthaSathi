"""Pydantic models for every JSON structure in SwasthaSathi (blueprint Section 9.2).

These are the contracts the rest of the code relies on. Invalid LLM output fails here and
is discarded; nothing downstream ever sees unvalidated model output.
"""
from __future__ import annotations

import re
import secrets
from enum import Enum
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

SCHEMA_VERSION = "1.0"

FirstAidId = Annotated[str, StringConstraints(pattern=r"^FA_[A-Z0-9_]+$")]
WarningSignId = Annotated[str, StringConstraints(pattern=r"^WS_[A-Z0-9_]+$")]
_LIBRARY_ID = re.compile(r"^(FA|WS|DISC)_[A-Z0-9_]+$")


# --------------------------------------------------------------------------- enums
class Language(str, Enum):
    EN = "en"
    HI = "hi"
    MR = "mr"


class RiskLevel(str, Enum):
    HOME_CARE = "HOME_CARE"
    VISIT_PHC = "VISIT_PHC"
    EMERGENCY = "EMERGENCY"

    @property
    def rank(self) -> int:
        return _RISK_RANK[self]


_RISK_RANK = {RiskLevel.HOME_CARE: 0, RiskLevel.VISIT_PHC: 1, RiskLevel.EMERGENCY: 2}


def max_risk(*levels: RiskLevel) -> RiskLevel:
    """Return the most serious level. Risk may only ever be raised, never averaged or lowered."""
    return max(levels, key=lambda level: level.rank)


class UrgencyLabel(str, Enum):
    TODAY = "TODAY"
    WITHIN_DAYS = "WITHIN_DAYS"


class RiskSource(str, Enum):
    RULES = "RULES"
    LLM = "LLM"
    MERGED = "MERGED"
    FALLBACK = "FALLBACK"


class Confidence(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RuleTier(str, Enum):
    RF = "RF"  # red flag -> EMERGENCY
    HR = "HR"  # high risk -> VISIT_PHC today
    SPECIAL = "SPECIAL"  # self-harm / medication question paths


class SpecialPath(str, Enum):
    SELF_HARM = "SELF_HARM"
    MEDICATION_QUESTION = "MEDICATION_QUESTION"


# --------------------------------------------------------------------------- base
class StrictModel(BaseModel):
    """Unknown fields are rejected so a model cannot smuggle extra content through."""

    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------------------- Section 9.2
class Symptom(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    onset: str = Field(default="", max_length=100)
    severity_reported: str = Field(default="", max_length=50)
    notes: str = Field(default="", max_length=300)


class PatientContext(StrictModel):
    age_group: Optional[str] = Field(default=None, max_length=30)
    pregnant: Optional[bool] = None
    known_conditions_mentioned: list[str] = Field(default_factory=list, max_length=10)


class RedFlag(StrictModel):
    rule_id: str = Field(min_length=1, max_length=64)
    source: Literal["rules"] = "rules"
    # The matched RULE phrase from rules.json, never the user's own words.
    matched_text: str = Field(default="", max_length=100)


class FollowUp(StrictModel):
    questions_asked: list[str] = Field(default_factory=list, max_length=5)
    answers: list[str] = Field(default_factory=list, max_length=5)


class Meta(StrictModel):
    model: str = "primary"
    fallback_used: bool = False
    latency_ms: int = Field(default=0, ge=0)
    rules_version: str = ""


class TriageResult(StrictModel):
    schema_version: Literal["1.0"] = SCHEMA_VERSION
    session_id: str = Field(default_factory=lambda: secrets.token_hex(6), min_length=1, max_length=64)
    input_language: Language
    output_language: Language
    symptoms: list[Symptom] = Field(default_factory=list, max_length=10)
    patient_context: PatientContext = Field(default_factory=PatientContext)
    red_flags: list[RedFlag] = Field(default_factory=list)
    follow_up: FollowUp = Field(default_factory=FollowUp)
    risk_level: RiskLevel
    urgency_label: Optional[UrgencyLabel] = None
    risk_source: RiskSource
    llm_confidence: Optional[Confidence] = None
    recommended_action: str = Field(default="", max_length=500)
    first_aid_ids: list[FirstAidId] = Field(default_factory=list)
    warning_signs_to_return: list[WarningSignId] = Field(default_factory=list)
    reasoning_summary: str = Field(default="", max_length=500)
    uncertainty_notes: str = Field(default="", max_length=300)
    disclaimer_id: str = "DISC_STANDARD"
    emergency: bool = False
    facility_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    meta: Meta = Field(default_factory=Meta)

    @model_validator(mode="after")
    def _check_consistency(self) -> "TriageResult":
        if self.emergency != (self.risk_level == RiskLevel.EMERGENCY):
            raise ValueError("emergency must be true exactly when risk_level is EMERGENCY")
        if (self.risk_level == RiskLevel.VISIT_PHC) != (self.urgency_label is not None):
            raise ValueError("urgency_label is required for VISIT_PHC and forbidden otherwise")
        return self


class LLMAssessment(StrictModel):
    """What the LLM is allowed to return (Prompt 3). Everything else is decided by code.

    ID lists are plain strings here on purpose: an unknown ID is dropped by the validator
    instead of throwing away an otherwise usable assessment.
    """

    risk_level: RiskLevel
    urgency_label: Optional[UrgencyLabel] = None
    llm_confidence: Confidence
    recommended_action: str = Field(default="", max_length=300)
    first_aid_ids: list[str] = Field(default_factory=list, max_length=10)
    warning_signs_to_return: list[str] = Field(default_factory=list, max_length=10)
    reasoning_summary: str = Field(default="", max_length=500)
    uncertainty_notes: str = Field(default="", max_length=300)

    @field_validator("urgency_label", mode="before")
    @classmethod
    def _normalize_urgency(cls, v: Any) -> Optional[UrgencyLabel]:
        if not v or v in (None, "None", "none", "null", "N/A", "LOW", "Low", "low", "MEDIUM", "HIGH"):
            return None
        if isinstance(v, str):
            v_upper = v.strip().upper()
            if "TODAY" in v_upper:
                return UrgencyLabel.TODAY
            if "DAY" in v_upper:
                return UrgencyLabel.WITHIN_DAYS
        return v


# --------------------------------------------------------------------------- data files
class LibraryItem(StrictModel):
    """One vetted entry in first_aid.json, warning_signs.json or disclaimers.json."""

    id: str
    text: dict[str, str]
    verify: str

    @field_validator("id")
    @classmethod
    def _id_shape(cls, value: str) -> str:
        if not _LIBRARY_ID.match(value):
            raise ValueError(f"bad library id: {value!r}")
        return value

    @field_validator("text")
    @classmethod
    def _needs_english(cls, value: dict[str, str]) -> dict[str, str]:
        if not value.get("en", "").strip():
            raise ValueError("every library item needs English text")
        return value

    @field_validator("verify")
    @classmethod
    def _marked_verify(cls, value: str) -> str:
        if not value.startswith("VERIFY"):
            raise ValueError("library items must be marked VERIFY until clinically reviewed")
        return value


# A group is a list of phrases, or "@NAME" to use a vocabulary list. Inside a list, "@NAME"
# items are spliced in. A trigger is a list of groups that must ALL match (within a short
# token window); a rule fires when ANY of its triggers matches.
Group = Union[str, list[str]]


class RuleDef(StrictModel):
    id: str = Field(pattern=r"^(RF|HR|SP)_[A-Z0-9_]+$")
    tier: RuleTier
    risk_floor: RiskLevel
    urgency: Optional[UrgencyLabel] = None
    special_path: Optional[SpecialPath] = None
    negatable: bool = False
    first_aid_ids: list[FirstAidId] = Field(default_factory=list)
    warning_sign_ids: list[WarningSignId] = Field(default_factory=list)
    verify: str
    description: str
    triggers: list[list[Group]] = Field(min_length=1)

    @field_validator("verify")
    @classmethod
    def _marked_verify(cls, value: str) -> str:
        if not value.startswith("VERIFY"):
            raise ValueError("every medical rule must be marked VERIFY")
        return value

    @field_validator("triggers")
    @classmethod
    def _no_empty_groups(cls, value: list[list[Group]]) -> list[list[Group]]:
        for trigger in value:
            if not trigger:
                raise ValueError("a trigger needs at least one group")
            for group in trigger:
                if not group:
                    raise ValueError("a group needs at least one phrase")
        return value

    @model_validator(mode="after")
    def _tier_consistency(self) -> "RuleDef":
        if self.tier == RuleTier.RF and self.risk_floor != RiskLevel.EMERGENCY:
            raise ValueError("RF rules must have an EMERGENCY floor")
        if self.tier == RuleTier.HR and (
            self.risk_floor != RiskLevel.VISIT_PHC or self.urgency != UrgencyLabel.TODAY
        ):
            raise ValueError("HR rules must have a VISIT_PHC floor with urgency TODAY")
        if self.tier == RuleTier.SPECIAL and self.special_path is None:
            raise ValueError("SPECIAL rules need a special_path")
        return self


class RulesFile(StrictModel):
    rules_version: str
    verify: str
    vocab: dict[str, list[str]]
    rules: list[RuleDef] = Field(min_length=1)

    @model_validator(mode="after")
    def _unique_ids(self) -> "RulesFile":
        ids = [rule.id for rule in self.rules]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate rule ids")
        return self
