"""Laboratory report value extraction and printed-range comparator.

NON-NEGOTIABLE SAFETY RULES (from Blueprint Section 13.4 & 14.2 Prompt 4):
1. Code compares extracted test values ONLY against the printed reference range on the report itself.
2. Never invents or assumes standard clinical ranges.
3. If printed reference range is not found on the report, flag is strictly 'RANGE_NOT_FOUND'.
4. Code calculates the flag deterministically, NOT the LLM.
5. The LLM only generates a simple, 1-sentence explanation of what the test generally measures.
6. Never diagnoses or recommends medicines.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from pydantic import BaseModel, Field

from ai.llm_client import LLMClient, get_llm_client

logger = logging.getLogger(__name__)


class LabReportItem(BaseModel):
    test_name: str
    value: float
    unit: str = ""
    printed_range: Optional[str] = None
    flag: str = "RANGE_NOT_FOUND"  # BELOW_PRINTED_RANGE, ABOVE_PRINTED_RANGE, NORMAL_PRINTED_RANGE, RANGE_NOT_FOUND
    plain_explanation: str = ""


class ReportAnalysisResult(BaseModel):
    items: list[LabReportItem] = Field(default_factory=list)
    note: str = "Flags compare only against the range printed on your report. Please discuss results with a doctor."
    raw_text: str = ""


# Common lab test explanations (vetted templates, zero hallucination risk)
VETTED_TEST_EXPLANATIONS = {
    "hemoglobin": "Hemoglobin is an iron-rich protein in red blood cells that carries oxygen throughout your body.",
    "hb": "Hemoglobin is an iron-rich protein in red blood cells that carries oxygen throughout your body.",
    "wbc": "White blood cells (WBC) are cells of the immune system that help the body fight infections.",
    "platelets": "Platelets are blood cell fragments that help the blood clot to stop bleeding.",
    "rbc": "Red blood cells (RBC) carry oxygen from the lungs to the rest of the body.",
    "blood sugar": "Blood sugar measures the concentration of glucose in the bloodstream.",
    "glucose": "Glucose is the primary sugar found in the blood and the main source of energy for the body's cells.",
    "creatinine": "Creatinine is a normal waste product from muscle metabolism filtered out by the kidneys.",
    "esr": "Erythrocyte Sedimentation Rate (ESR) is a marker that reflects general inflammation in the body.",
}


def parse_reference_range(range_str: Optional[str]) -> tuple[Optional[float], Optional[float]]:
    """Parse range strings like '12.0 - 15.5' or '12.0-15.5' into (low, high)."""
    if not range_str:
        return None, None

    # Matches patterns like 12.0 - 15.5 or 4,000 - 11,000
    cleaned = range_str.replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*[\-\–\—\to]\s*(\d+(?:\.\d+)?)", cleaned, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1)), float(match.group(2))
        except ValueError:
            pass
    return None, None


def evaluate_printed_range(value: float, printed_range: Optional[str]) -> str:
    """Deterministically determine flag against printed range only."""
    low, high = parse_reference_range(printed_range)
    if low is None or high is None:
        return "RANGE_NOT_FOUND"

    if value < low:
        return "BELOW_PRINTED_RANGE"
    elif value > high:
        return "ABOVE_PRINTED_RANGE"
    else:
        return "NORMAL_PRINTED_RANGE"


# Regex to scan lines in OCR text for common lab report formats:
# Format e.g. "Hemoglobin: 10.2 g/dL (Reference Range: 12.0 - 15.5)"
# or "WBC Count 8500 /cumm 4000-11000"
LAB_LINE_REGEX = re.compile(
    r"(?P<test>[A-Za-z\s]+?)\s*[:=\t]\s*(?P<val>\d+(?:\.\d+)?)\s*(?P<unit>[a-zA-Z/%μ]+)?\s*(?:[\(\[]?(?:ref|range|reference)?[:\s]*?(?P<range>\d+(?:\.\d+)?\s*[\-\–]\s*\d+(?:\.\d+)?))?",
    re.IGNORECASE,
)


def extract_lab_items_from_text(raw_text: str) -> list[LabReportItem]:
    """Parse text into structured items using deterministic regex first."""
    items: list[LabReportItem] = []

    lines = raw_text.splitlines()
    for line in lines:
        line = line.strip()
        if not line or len(line) < 5:
            continue

        match = LAB_LINE_REGEX.search(line)
        if match:
            test_name = match.group("test").strip()
            val_str = match.group("val")
            unit = match.group("unit") or ""
            range_str = match.group("range")
            if not range_str:
                after_val = line[match.end("val"):]
                range_match = re.search(r"(\d+(?:\.\d+)?\s*[\-\–]\s*\d+(?:\.\d+)?)", after_val)
                if range_match:
                    range_str = range_match.group(1).strip()

            if test_name.lower() in ("test", "parameter", "investigation", "date", "time"):
                continue

            try:
                val = float(val_str)
                flag = evaluate_printed_range(val, range_str)
                explanation = VETTED_TEST_EXPLANATIONS.get(
                    test_name.lower(),
                    f"{test_name} is a laboratory test measuring bodily health indicators.",
                )

                items.append(
                    LabReportItem(
                        test_name=test_name,
                        value=val,
                        unit=unit,
                        printed_range=range_str,
                        flag=flag,
                        plain_explanation=explanation,
                    )
                )
            except ValueError:
                continue

    return items


def analyze_report_text(raw_text: str, llm_client: Optional[LLMClient] = None) -> ReportAnalysisResult:
    """Analyze OCR text, extract items, apply deterministic range checks, and generate plain explanations."""
    items = extract_lab_items_from_text(raw_text)

    # If deterministic regex didn't find items or text is unstructured, ask LLM to extract values and printed ranges
    if not items and len(raw_text) > 20:
        client = llm_client or get_llm_client()
        system_prompt = (
            "Extract laboratory test names, reported values, units, and printed reference ranges exactly as shown in the text.\n"
            "Output JSON only: {\"items\": [{\"test_name\": \"\", \"value\": 0.0, \"unit\": \"\", \"printed_range\": null}]}\n"
            "If printed_range is missing on the text, set printed_range to null. Do NOT judge or flag values yourself."
        )
        user_prompt = f"Report text:\n{raw_text[:2000]}"
        res = client.generate_json(system_prompt=system_prompt, user_prompt=user_prompt)

        if res.success and res.json_data and "items" in res.json_data:
            for it in res.json_data.get("items", []):
                try:
                    val = float(it.get("value", 0))
                    pr_range = it.get("printed_range")
                    flag = evaluate_printed_range(val, pr_range)
                    t_name = str(it.get("test_name", "Test"))
                    explanation = VETTED_TEST_EXPLANATIONS.get(
                        t_name.lower(),
                        f"{t_name} is a laboratory test measuring bodily health indicators.",
                    )
                    items.append(
                        LabReportItem(
                            test_name=t_name,
                            value=val,
                            unit=it.get("unit", ""),
                            printed_range=pr_range,
                            flag=flag,
                            plain_explanation=explanation,
                        )
                    )
                except Exception:
                    continue

    return ReportAnalysisResult(
        items=items,
        note="Flags compare only against the range printed on your report. Please discuss results with a doctor.",
        raw_text=raw_text,
    )
