import json
from pathlib import Path
from services.facilities import get_nearby_facilities, calculate_distance_km
from ai.pipeline import get_pipeline
from ai.schemas import Language, RiskLevel, RiskSource

ROOT_DIR = Path(__file__).resolve().parent.parent


def test_clinical_guidelines_dataset() -> None:
    guidelines_file = ROOT_DIR / "data" / "clinical_guidelines.json"
    assert guidelines_file.is_file(), "clinical_guidelines.json must exist"

    with open(guidelines_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "sources" in data
    assert "specialties" in data
    assert "disclaimer" in data
    assert len(data["sources"]) >= 3
    assert any("MoHFW" in s["authority"] for s in data["sources"])
    assert any("IMNCI" in s["title"] for s in data["sources"])


def test_facilities_and_distance_calculation() -> None:
    facs = get_nearby_facilities(district="Pune", user_lat=18.5793, user_lng=73.9806, limit=5)
    assert len(facs) > 0
    # First item should have accurate real calculated distance
    assert 0.0 <= facs[0]["distance_km"] <= 25.0
    # Facilities must be sorted in ascending order of proximity
    for i in range(len(facs) - 1):
        assert facs[i]["distance_km"] <= facs[i + 1]["distance_km"]
    assert "name" in facs[0]

    # Haversine distance check: distance between Wagholi (18.5793, 73.9806) and Hadapsar (18.4984, 73.9312)
    dist = calculate_distance_km(18.5793, 73.9806, 18.4984, 73.9312)
    assert 10.0 <= dist <= 13.0


def test_deterministic_emergency_short_circuit() -> None:
    pipeline = get_pipeline()
    # Severe chest pain with sweating must short-circuit to EMERGENCY with zero delay
    res = pipeline.process_triage(
        user_text="सीने में बहुत तेज दर्द है और बहुत पसीना आ रहा है",
        language=Language.HI,
        session_id="test-emergency-session"
    )
    assert res.risk_level == RiskLevel.EMERGENCY
    assert res.risk_source in [RiskSource.RULES, "RULES", "DETERMINISTIC_PRE_LLM", "DETERMINISTIC_POST_LLM"]
    assert "108" in res.recommended_action or "112" in res.recommended_action or "Emergency" in res.recommended_action or "अस्पताल" in res.recommended_action or "तत्काल" in res.recommended_action
