"""Deterministic safety rule engine for SwasthaSathi.

NON-NEGOTIABLE SAFETY RULES (from Blueprint):
1. Runs BEFORE and AFTER the LLM.
2. Any red-flag match returns EMERGENCY immediately with no LLM call.
3. Must work completely offline with no network access.
4. Deterministic, fast (<1s), audit-trail enabled.
5. Strict negation handling: narrow tested window only, escalate when unsure.
"""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from ai.schemas import (
    FirstAidId,
    RedFlag,
    RiskLevel,
    RuleDef,
    RulesFile,
    RuleTier,
    SpecialPath,
    UrgencyLabel,
    WarningSignId,
)

RULES_JSON_PATH = Path(__file__).parent / "rules.json"

# Common colloquial / phonetic / misheard Hinglish mappings
WORD_ALIASES: dict[str, str] = {
    "dar": "dard",
    "drd": "dard",
    "drad": "dard",
    "dukhna": "dard",
    "seene": "sine",
    "seena": "sine",
    "chhati": "sine",
    "pasina": "paseena",
    "gham": "paseena",
    "h": "hai",
    "nhi": "nahi",
    "nahin": "nahi",
    "mein": "me",
    "me": "me",
    "kitnashak": "keetnashak",
    "bachche": "bache",
    "bachha": "bache",
    "bachee": "bache",
    "chakar": "chakkar",
    "ulti": "vomit",
    "ultiya": "vomit",
    "vanti": "vomit",
    "saas": "saans",
    "sans": "saans",
}

INTENSIFIERS: set[str] = {
    "very",
    "severe",
    "severely",
    "much",
    "too",
    "quite",
    "extremely",
    "bahut",
    "bohot",
    "bht",
    "khup",
    "kafi",
    "badi",
    "tez",
    "tezz",
    "बहुत",
    "खूप",
    "काफी",
    "अत्यधिक",
    "तीव्र",
    "तेज",
    "तेज़",
    "फार",
}

# Negation words in English, Hindi, Marathi, and Hinglish
NEGATION_WORDS = {
    "no",
    "not",
    "without",
    "denies",
    "denied",
    "never",
    "zero",
    "nahi",
    "nahin",
    "nhi",
    "na",
    "bina",
    "koi nahi",
    "kahi nahi",
    "naslyas",
    "नाही",
    "नाहीं",
    "नही",
    "नहीं",
    "बिना",
    "नसल्यास",
}


def normalize_text(text: str) -> str:
    """Normalize text across Unicode, case, punctuation, and common spellings."""
    if not text:
        return ""

    # 1. Unicode NFC normalization
    text = unicodedata.normalize("NFC", text)

    # 2. Lowercase
    text = text.lower()

    # 3. Normalize Hindi/Marathi nukhtas and variations
    # Replace common variations
    text = text.replace("ज़", "ज").replace("फ़", "फ").replace("क़", "क")
    text = text.replace("ज़", "ज").replace("फ़", "फ").replace("क़", "क")

    # 4. Standardize punctuation to spaces while keeping word tokens
    # Keep alphanumeric characters and Devanagari script (range \u0900-\u097F)
    cleaned_chars = []
    for ch in text:
        if ch.isalnum() or ("\u0900" <= ch <= "\u097f"):
            cleaned_chars.append(ch)
        else:
            cleaned_chars.append(" ")

    text = "".join(cleaned_chars)

    # 5. Collapse whitespace
    tokens = text.split()
    return " ".join(tokens)


def levenshtein_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein distance between two short strings."""
    if s1 == s2:
        return 0
    if len(s1) < len(s2):
        s1, s2 = s2, s1
    if not s2:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def tokens_match_fuzzy(token: str, target: str) -> bool:
    """Check if token matches target either exactly, via alias, or fuzzy (distance <= 1)."""
    if token == target:
        return True

    # Check alias mapping
    alias = WORD_ALIASES.get(token, token)
    if alias == target or WORD_ALIASES.get(target, target) == alias:
        return True

    # Allow edit distance 1 for tokens with length >= 4
    if len(target) >= 4 and len(token) >= 3 and abs(len(token) - len(target)) <= 1:
        if levenshtein_distance(token, target) <= 1:
            return True

    return False


@dataclass
class MatchSpan:
    phrase: str
    start_token_idx: int
    end_token_idx: int


def find_phrase_in_tokens(phrase: str, tokens: list[str]) -> list[MatchSpan]:
    """Find occurrences of a phrase in a list of tokens, allowing aliases, fuzzy matching, and intervening intensifiers."""
    phrase_norm = normalize_text(phrase)
    p_tokens = phrase_norm.split()
    if not p_tokens or not tokens:
        return []

    matches: list[MatchSpan] = []
    n_p = len(p_tokens)
    n_t = len(tokens)

    for start_i in range(n_t):
        curr_t = start_i
        matched = True
        skipped_intensifiers = 0

        for pt in p_tokens:
            # Skip intervening intensifiers (e.g. 'बहुत', 'bahut', 'very') if current token doesn't match
            while (
                curr_t < n_t
                and not tokens_match_fuzzy(tokens[curr_t], pt)
                and tokens[curr_t] in INTENSIFIERS
                and skipped_intensifiers < 3
            ):
                curr_t += 1
                skipped_intensifiers += 1

            if curr_t < n_t and tokens_match_fuzzy(tokens[curr_t], pt):
                curr_t += 1
            else:
                matched = False
                break

        if matched:
            matches.append(MatchSpan(phrase=phrase, start_token_idx=start_i, end_token_idx=curr_t))

    return matches


def is_span_negated(span: MatchSpan, tokens: list[str]) -> bool:
    """Check if a match span is immediately negated.

    Narrow safe window:
    - 1-2 words preceding: e.g. 'no chest pain', 'not having chest pain'
    - 1-2 words following (Hindi/Marathi): e.g. 'chest pain nahi hai', 'dard nahi'
    """
    # Check preceding tokens (up to 3 words before)
    pre_window = tokens[max(0, span.start_token_idx - 3) : span.start_token_idx]
    for w in pre_window:
        if w in NEGATION_WORDS:
            return True

    # Check following tokens (up to 3 words after)
    post_window = tokens[span.end_token_idx : min(len(tokens), span.end_token_idx + 3)]
    for w in post_window:
        if w in NEGATION_WORDS:
            return True

    return False


@dataclass
class RuleEngineResult:
    risk_floor: RiskLevel
    urgency: Optional[UrgencyLabel] = None
    emergency: bool = False
    matched_rules: list[RuleDef] = field(default_factory=list)
    red_flags: list[RedFlag] = field(default_factory=list)
    first_aid_ids: list[FirstAidId] = field(default_factory=list)
    warning_sign_ids: list[WarningSignId] = field(default_factory=list)
    special_path: Optional[SpecialPath] = None


class RuleEngine:
    """Deterministic, offline-capable rule engine."""

    def __init__(self, rules_file_path: Path = RULES_JSON_PATH) -> None:
        self.rules_file_path = rules_file_path
        self._load_rules()

    def _load_rules(self) -> None:
        with open(self.rules_file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.rules_file = RulesFile.model_validate(data)
        self.vocab = self.rules_file.vocab
        self.rules = self.rules_file.rules

    def _expand_group(self, group: str | list[str]) -> list[str]:
        """Expand a group definition, resolving any @VOCAB_KEY references."""
        if isinstance(group, str):
            if group.startswith("@"):
                vocab_key = group[1:]
                return self.vocab.get(vocab_key, [])
            return [group]

        expanded: list[str] = []
        for item in group:
            if isinstance(item, str) and item.startswith("@"):
                vocab_key = item[1:]
                expanded.extend(self.vocab.get(vocab_key, []))
            else:
                expanded.append(str(item))
        return expanded

    def evaluate(self, text: str) -> RuleEngineResult:
        """Run all rules deterministically on normalized text."""
        norm_text = normalize_text(text)
        tokens = norm_text.split()

        matched_rules: list[RuleDef] = []
        red_flags: list[RedFlag] = []
        first_aid_set: set[FirstAidId] = set()
        warning_signs_set: set[WarningSignId] = set()
        special_path: Optional[SpecialPath] = None

        highest_risk = RiskLevel.HOME_CARE
        highest_urgency: Optional[UrgencyLabel] = None

        if not tokens:
            return RuleEngineResult(
                risk_floor=highest_risk,
                urgency=highest_urgency,
                emergency=False,
            )

        for rule in self.rules:
            rule_matched = False
            matched_phrase_desc = ""

            for trigger in rule.triggers:
                # A trigger is a list of groups; all groups must match in the text
                trigger_satisfied = True
                matched_in_trigger: list[str] = []

                for group in trigger:
                    phrases = self._expand_group(group)
                    group_found = False

                    for phrase in phrases:
                        spans = find_phrase_in_tokens(phrase, tokens)
                        if not spans:
                            continue

                        # Check if matches are negated
                        valid_spans = []
                        for span in spans:
                            if rule.negatable and is_span_negated(span, tokens):
                                # Narrow negation matched
                                continue
                            valid_spans.append(span)

                        if valid_spans:
                            group_found = True
                            matched_in_trigger.append(phrase)
                            break

                    if not group_found:
                        trigger_satisfied = False
                        break

                if trigger_satisfied:
                    rule_matched = True
                    matched_phrase_desc = ", ".join(matched_in_trigger)
                    break

            if rule_matched:
                matched_rules.append(rule)

                # Track highest risk floor
                if rule.risk_floor.rank > highest_risk.rank:
                    highest_risk = rule.risk_floor
                    highest_urgency = rule.urgency
                elif rule.risk_floor.rank == highest_risk.rank and rule.urgency:
                    highest_urgency = rule.urgency

                if rule.tier == RuleTier.RF:
                    red_flags.append(
                        RedFlag(
                            rule_id=rule.id,
                            source="rules",
                            matched_text=matched_phrase_desc[:100],
                        )
                    )

                for fa_id in rule.first_aid_ids:
                    first_aid_set.add(fa_id)

                for ws_id in rule.warning_sign_ids:
                    warning_signs_set.add(ws_id)

                if rule.special_path:
                    special_path = rule.special_path

        is_emergency = highest_risk == RiskLevel.EMERGENCY

        return RuleEngineResult(
            risk_floor=highest_risk,
            urgency=highest_urgency if highest_risk == RiskLevel.VISIT_PHC else None,
            emergency=is_emergency,
            matched_rules=matched_rules,
            red_flags=red_flags,
            first_aid_ids=sorted(first_aid_set),
            warning_sign_ids=sorted(warning_signs_set),
            special_path=special_path,
        )


# Singleton instance for simple imports across services
_DEFAULT_ENGINE: Optional[RuleEngine] = None


def get_rule_engine() -> RuleEngine:
    global _DEFAULT_ENGINE
    if _DEFAULT_ENGINE is None:
        _DEFAULT_ENGINE = RuleEngine()
    return _DEFAULT_ENGINE
