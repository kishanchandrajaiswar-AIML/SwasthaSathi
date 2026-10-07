"""Template follow-up questions and conservative fallback assessments.

Used when:
1. LLM API is unavailable, timed out, or rate-limited.
2. LLM returns invalid JSON or fails Pydantic schema validation.
3. Offline mode is active.

Non-negotiable rule 3:
Invalid, slow or low-confidence LLM output means at least VISIT_PHC.
"""
from __future__ import annotations

from typing import Any

from ai.schemas import (
    Confidence,
    Language,
    LLMAssessment,
    RiskLevel,
    UrgencyLabel,
)

# Standard template follow-up questions by language
TEMPLATE_QUESTIONS: dict[Language, list[dict[str, Any]]] = {
    Language.EN: [
        {
            "id": "q_duration",
            "text": "How many days have you had these symptoms?",
            "type": "choice",
            "options": ["Less than 1 day", "1 to 3 days", "More than 3 days"],
        },
        {
            "id": "q_fluids",
            "text": "Are you able to drink water and keep fluids down?",
            "type": "yes_no",
            "options": ["Yes", "No"],
        },
        {
            "id": "q_breathing",
            "text": "Is there any difficulty breathing or chest pain?",
            "type": "yes_no",
            "options": ["Yes", "No"],
        },
        {
            "id": "q_age",
            "text": "What is the age group of the patient?",
            "type": "choice",
            "options": ["Infant/child under 5", "5 to 60 years", "Senior over 60"],
        },
    ],
    Language.HI: [
        {
            "id": "q_duration",
            "text": "यह लक्षण कितने दिनों से हैं?",
            "type": "choice",
            "options": ["1 दिन से कम", "1 से 3 दिन", "3 दिन से अधिक"],
        },
        {
            "id": "q_fluids",
            "text": "क्या मरीज़ पानी पी पा रहा है और उल्टी तो नहीं हो रही?",
            "type": "yes_no",
            "options": ["हाँ", "नहीं"],
        },
        {
            "id": "q_breathing",
            "text": "क्या साँस लेने में तकलीफ़ या सीने में दर्द है?",
            "type": "yes_no",
            "options": ["हाँ", "नहीं"],
        },
        {
            "id": "q_age",
            "text": "मरीज़ की उम्र का वर्ग क्या है?",
            "type": "choice",
            "options": ["5 साल से कम बच्चा", "5 से 60 वर्ष", "60 वर्ष से अधिक"],
        },
    ],
    Language.MR: [
        {
            "id": "q_duration",
            "text": "ही लक्षणे किती दिवसांपासून आहेत?",
            "type": "choice",
            "options": ["1 दिवसापेक्षा कमी", "1 ते 3 दिवस", "3 दिवसांपेक्षा जास्त"],
        },
        {
            "id": "q_fluids",
            "text": "पाणी पिता येत आहे का आणि उलट्या होत नाहीत ना?",
            "type": "yes_no",
            "options": ["होय", "नाही"],
        },
        {
            "id": "q_breathing",
            "text": "श्वास घेण्यास त्रास किंवा छातीत दुखत आहे का?",
            "type": "yes_no",
            "options": ["होय", "नाही"],
        },
        {
            "id": "q_age",
            "text": "रुग्णाचे वयोगट काय आहे?",
            "type": "choice",
            "options": ["5 वर्षांखालील बालक", "5 ते 60 वर्षे", "60 वर्षांपेक्षा जास्त"],
        },
    ],
}


def get_template_questions(language: Language = Language.EN) -> list[dict[str, Any]]:
    """Return vetted template follow-up questions for the given language."""
    return TEMPLATE_QUESTIONS.get(language, TEMPLATE_QUESTIONS[Language.EN])


def get_conservative_assessment(language: Language = Language.EN) -> LLMAssessment:
    """Return safe conservative fallback assessment (at least VISIT_PHC today)."""
    actions = {
        Language.EN: "Please visit the nearest Primary Health Centre (PHC) or doctor for evaluation.",
        Language.HI: "कृपया जांच के लिए नजदीकी प्राथमिक स्वास्थ्य केंद्र (PHC) या डॉक्टर के पास जाएं।",
        Language.MR: "कृपया तपासणीसाठी जवळच्या प्राथमिक आरोग्य केंद्रात (PHC) किंवा डॉक्टरांकडे जावे.",
    }
    reasonings = {
        Language.EN: "Automated safety fallback applied. Clinical evaluation is recommended.",
        Language.HI: "सुरक्षा फ़ालबैक लागू किया गया। डॉक्टर द्वारा जांच की सलाह दी जाती है।",
        Language.MR: "सुरक्षा फॉलबॅक लागू केला आहे. डॉक्टरांकडून तपासणी करून घेण्याचा सल्ला दिला जातो.",
    }

    return LLMAssessment(
        risk_level=RiskLevel.VISIT_PHC,
        urgency_label=UrgencyLabel.TODAY,
        llm_confidence=Confidence.LOW,
        recommended_action=actions.get(language, actions[Language.EN]),
        first_aid_ids=[],
        warning_signs_to_return=["WS_NOT_DRINKING", "WS_VERY_DROWSY"],
        reasoning_summary=reasonings.get(language, reasonings[Language.EN]),
        uncertainty_notes="Assessment completed via conservative offline fallback.",
    )
