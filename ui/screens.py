"""Minimalist screen views for SwasthaSathi.

Implements clean Swiss/clinical minimalist aesthetic:
- Clear spatial relationships with 8px baseline grid
- Generous whitespace and restrained color palette
- Interactive vitals sparklines, risk gauge, and lab comparator bars
- Deterministic emergency short-circuit without network calls
"""
from __future__ import annotations

import json
import urllib.parse
from pathlib import Path
from typing import Any, Optional

import streamlit as st

from ai.pipeline import get_pipeline, redact_pii
from ai.schemas import Language, RiskLevel, RiskSource, UrgencyLabel
from services.facilities import get_default_helplines, get_nearby_facilities
from services.metrics import record_triage_metric
from services.privacy import sanitize_input_text
from services.report import analyze_report_text
from services.stt import transcribe_audio_bytes
from services.summary import generate_asha_summary
from ui.components import (
    render_bottom_navigation,
    render_emergency_banner,
    render_facility_item,
    render_first_aid_list,
    render_header,
    render_range_comparator_bar,
    render_risk_badge,
    render_triage_risk_gauge,
    render_vitals_telemetry_widget,
    render_warning_signs_list,
)

I18N_DIR = Path(__file__).parent / "i18n"
DEMO_SCENARIOS_PATH = Path(__file__).parent.parent / "data" / "demo_scenarios.json"


@st.cache_data
def load_i18n(lang_code: str) -> dict[str, Any]:
    file_path = I18N_DIR / f"{lang_code}.json"
    if not file_path.is_file():
        file_path = I18N_DIR / "en.json"
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_current_i18n() -> dict[str, Any]:
    lang = st.session_state.get("language", "hi")
    return load_i18n(lang)


def get_current_lang_enum() -> Language:
    code = st.session_state.get("language", "hi")
    try:
        return Language(code)
    except Exception:
        return Language.HI


# --------------------------------------------------------------------------- Screen 1: Welcome
def render_welcome():
    i18n = get_current_i18n()
    w = i18n.get("welcome", {})

    st.markdown(
        f"""
        <div style="text-align:center; padding:1.25rem 0.25rem;">
            <div style="width:48px; height:48px; margin:0 auto 0.75rem auto; border-radius:12px; background:#0F172A; color:#FFFFFF; display:flex; align-items:center; justify-content:center; font-size:1.5rem; box-shadow:0 4px 12px rgba(15,23,42,0.15);">
                🩺
            </div>
            <h1 style="font-size:1.75rem; font-weight:800; color:#0F172A; margin-bottom:0.2rem; letter-spacing:-0.02em;">
                {i18n.get('app_name')}
            </h1>
            <p style="font-size:0.92rem; font-weight:500; color:#475569; margin-bottom:0.75rem;">
                {i18n.get('app_tagline')}
            </p>
            <span style="display:inline-block; font-size:0.75rem; font-weight:700; color:#0284C7; background:#E0F2FE; border:1px solid #BAE6FD; padding:0.25rem 0.65rem; border-radius:9999px; margin-bottom:1.25rem;">
                🛡️ {w.get('badge', 'Decision Support • Not Diagnosis')}
            </span>
            <p style="font-size:0.98rem; line-height:1.6; color:#334155; margin-bottom:1.5rem;">
                {w.get('subtitle')}
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        f"""
        <div class="ss-card" style="margin-bottom:1.25rem;">
            <p style="margin:0 0 0.5rem 0; font-size:0.9rem; color:#1E293B;">⚡ <b>{w.get('key_benefit_1')}</b></p>
            <p style="margin:0 0 0.5rem 0; font-size:0.9rem; color:#1E293B;">🗣️ <b>{w.get('key_benefit_2')}</b></p>
            <p style="margin:0; font-size:0.9rem; color:#1E293B;">📋 <b>{w.get('key_benefit_3')}</b></p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if st.button(f"🚀 {w.get('start_button', 'Get Started')}", key="btn_welcome_start", type="primary"):
        st.session_state.screen = "language"
        st.rerun()

    st.write("")
    if st.button(f"ℹ️ {w.get('about_button', 'About & Safety Standards')}", key="btn_welcome_about"):
        st.session_state.screen = "about"
        st.rerun()


# --------------------------------------------------------------------------- Screen 2: Language Selection
def render_language():
    i18n = get_current_i18n()
    ls = i18n.get("language_screen", {})

    st.markdown(
        f"""
        <div style="text-align:center; padding:1.25rem 0;">
            <div style="font-size:2rem; margin-bottom:0.35rem;">🌐</div>
            <h2 style="font-size:1.5rem; font-weight:800; color:#0F172A; margin-bottom:0.35rem;">{ls.get('title')}</h2>
            <p style="font-size:0.92rem; color:#64748B;">{ls.get('subtitle')}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if st.button("🇮🇳 हिंदी (Hindi)", key="lang_btn_hi", type="primary"):
        st.session_state.language = "hi"
        st.session_state.screen = "home"
        st.rerun()

    st.write("")
    if st.button("🚩 मराठी (Marathi)", key="lang_btn_mr"):
        st.session_state.language = "mr"
        st.session_state.screen = "home"
        st.rerun()

    st.write("")
    if st.button("🌐 English", key="lang_btn_en"):
        st.session_state.language = "en"
        st.session_state.screen = "home"
        st.rerun()


# --------------------------------------------------------------------------- Screen 3: Home Dashboard
def render_home():
    render_header(show_nav=True)
    i18n = get_current_i18n()
    h = i18n.get("home", {})
    lang_enum = get_current_lang_enum()

    st.markdown(
        f"""
        <div style="margin-bottom:1rem;">
            <h2 style="font-size:1.4rem; font-weight:800; color:#0F172A; margin-bottom:0.15rem;">
                {h.get('greeting')}
            </h2>
            <p style="font-size:0.9rem; color:#64748B; margin:0;">
                {h.get('choose_action')}
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # 1. Interactive Vitals Telemetry Widget (Heart Rate, Blood Pressure, Temp, SpO2 with Sparklines)
    render_vitals_telemetry_widget(lang_enum)

    # 2. Primary Action: Check Symptoms
    st.markdown(
        f"""
        <div class="ss-card" style="border-left: 4px solid #0284C7;">
            <div style="font-size:1.08rem; font-weight:800; color:#0F172A; margin-bottom:0.25rem;">
                🩺 {h.get('symptoms_title')}
            </div>
            <p style="font-size:0.88rem; color:#475569; margin-bottom:0.65rem;">
                {h.get('symptoms_desc')}
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button(f"🔍 {h.get('symptoms_title')} (Start Triage)", key="home_symptoms_btn", type="primary"):
        st.session_state.screen = "input"
        st.rerun()

    st.write("")

    # 3. Secondary Action: Understand Report
    st.markdown(
        f"""
        <div class="ss-card" style="border-left: 4px solid #D97706;">
            <div style="font-size:1.08rem; font-weight:800; color:#0F172A; margin-bottom:0.25rem;">
                📄 {h.get('report_title')}
            </div>
            <p style="font-size:0.88rem; color:#475569; margin-bottom:0.65rem;">
                {h.get('report_desc')}
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button(f"📄 {h.get('report_title')}", key="home_report_btn"):
        st.session_state.screen = "report_upload"
        st.rerun()

    st.write("")

    # 4. Tertiary Action: Find Facilities
    st.markdown(
        f"""
        <div class="ss-card" style="border-left: 4px solid #059669;">
            <div style="font-size:1.08rem; font-weight:800; color:#0F172A; margin-bottom:0.25rem;">
                🏥 {h.get('facilities_title')}
            </div>
            <p style="font-size:0.88rem; color:#475569; margin-bottom:0.65rem;">
                {h.get('facilities_desc')}
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button(f"🏥 {h.get('facilities_title')}", key="home_facilities_btn"):
        st.session_state.screen = "facilities"
        st.rerun()

    st.write("---")

    # Demo Mode Expander
    with st.expander(f"✨ {h.get('demo_mode_badge', 'Demo Scenarios (Pre-recorded)')}"):
        st.caption("Inspect live offline emergency proof or pre-recorded verified flows:")
        if DEMO_SCENARIOS_PATH.is_file():
            with open(DEMO_SCENARIOS_PATH, "r", encoding="utf-8") as f:
                scenarios = json.load(f)
            for sc in scenarios:
                if st.button(f"▶️ {sc.get('title')}", key=f"demo_btn_{sc.get('id')}"):
                    st.session_state.demo_mode = True
                    st.session_state.demo_scenario = sc
                    st.session_state.language = sc.get("language", "hi")
                    st.session_state.symptom_text = sc.get("input_text", "")

                    if "items" in sc:
                        st.session_state.report_result = sc
                        st.session_state.screen = "report_result"
                    elif sc.get("result", {}).get("risk_level") == "EMERGENCY":
                        st.session_state.screen = "emergency"
                        st.session_state.triage_result = sc.get("result")
                    else:
                        st.session_state.screen = "input"
                    st.rerun()

    render_bottom_navigation()


# --------------------------------------------------------------------------- Screen 4: Symptom Input
def render_input():
    render_header(show_nav=True)
    i18n = get_current_i18n()
    inp = i18n.get("input", {})
    lang_enum = get_current_lang_enum()

    st.markdown(
        f"""
        <div style="margin-bottom:0.85rem;">
            <h2 style="font-size:1.35rem; font-weight:800; color:#0F172A; margin-bottom:0.2rem;">
                {inp.get('title')}
            </h2>
            <p style="font-size:0.9rem; color:#64748B; margin:0;">{inp.get('subtitle')}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Voice Input Feature
    st.markdown(f"**🎙️ {inp.get('mic_button')}**")
    audio_val = st.audio_input("Record voice", key="audio_recorder_widget")

    if audio_val and not st.session_state.get("audio_transcribed", False):
        with st.spinner("Transcribing voice via Whisper..."):
            audio_bytes = audio_val.read()
            ok, transcript, err = transcribe_audio_bytes(audio_bytes, language_hint=lang_enum.value)
            if ok and transcript:
                st.session_state.transcribed_text = transcript
                st.session_state.audio_transcribed = True
                st.success("Transcribed successfully! Please review below.")
            elif err:
                st.warning(err)

    default_text = st.session_state.get("transcribed_text") or st.session_state.get("symptom_text", "")

    user_text = st.text_area(
        label="Symptoms",
        value=default_text,
        placeholder=inp.get("text_placeholder"),
        height=110,
        label_visibility="collapsed",
    )

    # Example chips
    st.markdown(f"<span style='font-size:0.78rem; font-weight:600; color:#64748B;'>{inp.get('example_label')}</span>", unsafe_allow_html=True)
    c1, c2, c3 = st.columns(3)
    with c1:
        if st.button(inp.get("example_1", "Child fever"), key="ex_btn_1"):
            st.session_state.symptom_text = inp.get("example_1")
            st.session_state.transcribed_text = inp.get("example_1")
            st.rerun()
    with c2:
        if st.button(inp.get("example_2", "Chest pain"), key="ex_btn_2"):
            st.session_state.symptom_text = inp.get("example_2")
            st.session_state.transcribed_text = inp.get("example_2")
            st.rerun()
    with c3:
        if st.button(inp.get("example_3", "Mild cold"), key="ex_btn_3"):
            st.session_state.symptom_text = inp.get("example_3")
            st.session_state.transcribed_text = inp.get("example_3")
            st.rerun()

    st.write("")

    col_back, col_submit = st.columns([1, 2])
    with col_back:
        if st.button("⬅️ Home", key="btn_input_back"):
            st.session_state.screen = "home"
            st.rerun()

    with col_submit:
        if st.button(f"🔍 {inp.get('submit_button')}", key="btn_input_submit", type="primary"):
            cleaned = sanitize_input_text(user_text)
            if not cleaned or len(cleaned) < 3:
                st.error(inp.get("empty_error"))
                return

            st.session_state.symptom_text = cleaned
            pipeline = get_pipeline()

            # STEP 1: Deterministic offline rule check FIRST
            rule_result = pipeline.rule_engine.evaluate(cleaned)

            # STEP 2: Emergency Short-Circuit (ZERO network calls, works offline)
            if rule_result.emergency:
                res = pipeline.validator.merge_assessment(
                    rule_result=rule_result,
                    llm_assessment=None,
                    input_language=lang_enum,
                    output_language=lang_enum,
                    session_id=st.session_state.session_id,
                )
                st.session_state.triage_result = res
                record_triage_metric(res.risk_level, res.risk_source, False, lang_enum.value)
                st.session_state.screen = "emergency"
                st.rerun()

            # STEP 3: Normal / Non-emergency flow
            with st.spinner("Analyzing symptoms and preparing follow-up questions..."):
                extraction = pipeline.extract_symptoms(cleaned)
                questions = pipeline.generate_follow_up_questions(extraction.symptoms, language=lang_enum)
                st.session_state.extracted_symptoms = extraction.symptoms
                st.session_state.patient_context = extraction.patient_context
                st.session_state.follow_up_questions = questions
                st.session_state.follow_up_answers = []
                st.session_state.current_question_idx = 0
                st.session_state.screen = "followup"
                st.rerun()

    render_bottom_navigation()


# --------------------------------------------------------------------------- Screen 5: Follow-Up Questions
def render_followup():
    render_header(show_nav=False)
    i18n = get_current_i18n()
    fo = i18n.get("followup", {})
    lang_enum = get_current_lang_enum()

    questions = st.session_state.get("follow_up_questions", [])
    idx = st.session_state.get("current_question_idx", 0)

    if not questions or idx >= len(questions):
        _finalize_triage(lang_enum)
        return

    curr_q = questions[idx]
    total_q = len(questions)

    progress_label = fo.get("progress_label", "Question {current} of {total}").replace("{current}", str(idx + 1)).replace("{total}", str(total_q))
    st.markdown(
        f"""
        <div class="ss-card" style="margin-bottom:1.25rem;">
            <span style="font-size:0.75rem; font-weight:700; color:#0284C7; text-transform:uppercase; letter-spacing:0.06em;">{progress_label}</span>
            <div style="display:flex; gap:0.35rem; margin:0.5rem 0 0.85rem 0;">
                {''.join(f'<div style="height:5px; flex:1; border-radius:3px; background:{"#0F172A" if i <= idx else "#E2E8F0"};"></div>' for i in range(total_q))}
            </div>
            <h3 style="font-size:1.25rem; font-weight:700; color:#0F172A; line-height:1.4; margin:0;">
                {curr_q.text}
            </h3>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if curr_q.type == "choice" and curr_q.options:
        for opt in curr_q.options:
            if st.button(opt, key=f"q_choice_{idx}_{opt}"):
                st.session_state.follow_up_answers.append({"question": curr_q.text, "answer": opt})
                st.session_state.current_question_idx += 1
                if st.session_state.current_question_idx >= total_q:
                    _finalize_triage(lang_enum)
                else:
                    st.rerun()
    else:
        c_yes, c_no = st.columns(2)
        with c_yes:
            if st.button(f"👍 {fo.get('yes_button', 'Yes')}", key=f"q_yes_{idx}", type="primary"):
                st.session_state.follow_up_answers.append({"question": curr_q.text, "answer": "Yes"})
                st.session_state.current_question_idx += 1
                if st.session_state.current_question_idx >= total_q:
                    _finalize_triage(lang_enum)
                else:
                    st.rerun()
        with c_no:
            if st.button(f"👎 {fo.get('no_button', 'No')}", key=f"q_no_{idx}"):
                st.session_state.follow_up_answers.append({"question": curr_q.text, "answer": "No"})
                st.session_state.current_question_idx += 1
                if st.session_state.current_question_idx >= total_q:
                    _finalize_triage(lang_enum)
                else:
                    st.rerun()

    st.write("")
    if st.button(fo.get("skip_btn", "Skip to Result"), key="btn_skip_followup"):
        _finalize_triage(lang_enum)


def _finalize_triage(lang_enum: Language):
    with st.spinner("Completing safety validation and triage assessment..."):
        pipeline = get_pipeline()
        raw_text = st.session_state.get("symptom_text", "")
        answers = st.session_state.get("follow_up_answers", [])
        result = pipeline.process_triage(
            user_text=raw_text,
            follow_up_answers=answers,
            language=lang_enum,
            session_id=st.session_state.session_id,
        )
        st.session_state.triage_result = result
        record_triage_metric(
            result.risk_level,
            result.risk_source,
            result.meta.fallback_used,
            lang_enum.value,
            result.meta.latency_ms,
        )

        if result.emergency:
            st.session_state.screen = "emergency"
        else:
            st.session_state.screen = "result"
        st.rerun()


# --------------------------------------------------------------------------- Screen 6: Emergency Screen
def render_emergency():
    i18n = get_current_i18n()
    em = i18n.get("emergency", {})
    lang_enum = get_current_lang_enum()
    result = st.session_state.get("triage_result")

    if st.session_state.get("demo_mode"):
        st.markdown(
            '<div style="background:#FFFBEB; border:1px solid #FDE68A; color:#B45309; font-size:0.75rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:6px; margin-bottom:0.75rem;">⚠️ Demo scenario: pre-recorded response</div>',
            unsafe_allow_html=True,
        )

    render_emergency_banner(i18n)

    first_aid_ids = result.first_aid_ids if hasattr(result, "first_aid_ids") else result.get("first_aid_ids", ["FA_CALL_112"])
    st.markdown(f"### 🛡️ {em.get('first_aid_title')}")
    render_first_aid_list(first_aid_ids, lang_enum)

    st.write("---")

    st.markdown(f"### 🏥 {em.get('nearest_hospital_title')}")
    facilities = get_nearby_facilities(emergency_only=True, limit=2)
    for fac in facilities:
        render_facility_item(fac, i18n)

    st.write("")
    if st.button(f"🏠 {em.get('back_home', 'Back to Home')}", key="btn_emergency_home", type="primary"):
        st.session_state.screen = "home"
        st.session_state.demo_mode = False
        st.rerun()


# --------------------------------------------------------------------------- Screen 7: Result Screen
def render_result():
    render_header(show_nav=True)
    i18n = get_current_i18n()
    res_texts = i18n.get("result", {})
    lang_enum = get_current_lang_enum()
    result = st.session_state.get("triage_result")

    if not result:
        st.session_state.screen = "home"
        st.rerun()
        return

    if st.session_state.get("demo_mode"):
        st.markdown(
            '<div style="background:#FFFBEB; border:1px solid #FDE68A; color:#B45309; font-size:0.75rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:6px; margin-bottom:0.75rem;">⚠️ Demo scenario: pre-recorded response</div>',
            unsafe_allow_html=True,
        )

    st.markdown(f"## {res_texts.get('title')}")

    # Risk Meter & Badge
    render_triage_risk_gauge(result.risk_level, result.urgency_label)
    render_risk_badge(result.risk_level, result.urgency_label, i18n)

    action = result.recommended_action if hasattr(result, "recommended_action") else result.get("recommended_action")
    st.markdown(
        f"""
        <div class="ss-card" style="border-left: 4px solid #0284C7; margin-top:0.5rem;">
            <span style="font-size:0.75rem; font-weight:700; color:#0284C7; text-transform:uppercase; letter-spacing:0.05em;">
                {res_texts.get('recommended_action_title')}
            </span>
            <p style="margin:0.25rem 0 0 0; font-size:1.1rem; font-weight:700; color:#0F172A; line-height:1.5;">{action}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    reasoning = result.reasoning_summary if hasattr(result, "reasoning_summary") else result.get("reasoning_summary")
    if reasoning:
        st.markdown(f"**💡 {res_texts.get('reasoning_title')}**")
        st.info(reasoning)

    ws_ids = result.warning_signs_to_return if hasattr(result, "warning_signs_to_return") else result.get("warning_signs_to_return", [])
    if ws_ids:
        st.markdown(f"**🚨 {res_texts.get('warning_signs_title')}**")
        render_warning_signs_list(ws_ids, lang_enum)

    fa_ids = result.first_aid_ids if hasattr(result, "first_aid_ids") else result.get("first_aid_ids", [])
    if fa_ids:
        st.markdown(f"**🩹 {res_texts.get('first_aid_title')}**")
        render_first_aid_list(fa_ids, lang_enum)

    source = result.risk_source.value if hasattr(result, "risk_source") else result.get("risk_source", "MERGED")
    source_msg = res_texts.get(f"audit_source_{source.lower()}", f"Audited via {source}")
    st.caption(f"🔒 {source_msg}")

    st.write("---")

    c1, c2 = st.columns(2)
    with c1:
        if st.button(f"🏥 {res_texts.get('find_phc_button')}", key="btn_res_facilities", type="primary"):
            st.session_state.screen = "facilities"
            st.rerun()
    with c2:
        if st.button(f"📋 {res_texts.get('create_summary_button')}", key="btn_res_summary"):
            st.session_state.screen = "summary"
            st.rerun()

    st.write("")
    if st.button(f"🔄 {res_texts.get('start_over_button')}", key="btn_res_restart"):
        st.session_state.screen = "home"
        st.session_state.demo_mode = False
        st.rerun()

    render_bottom_navigation()


# --------------------------------------------------------------------------- Screen 8: Facilities Screen
def render_facilities():
    render_header(show_nav=True)
    i18n = get_current_i18n()
    fac_texts = i18n.get("facilities", {})

    st.markdown(f"## {fac_texts.get('title')}")
    st.markdown(f"<p style='color:#64748B;'>{fac_texts.get('subtitle')}</p>", unsafe_allow_html=True)

    facilities = get_nearby_facilities(limit=4)
    for fac in facilities:
        render_facility_item(fac, i18n)

    st.markdown(f"### 📞 {fac_texts.get('helpline_box_title')}")
    helplines = get_default_helplines()
    for hl in helplines:
        st.markdown(
            f"""
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:0.6rem 0.85rem; margin-bottom:0.4rem; display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#1E293B; font-weight:600; font-size:0.9rem;">{hl['name']}</span>
                <a href="tel:{hl['phone']}" style="color:#0284C7; font-weight:700; text-decoration:none;">📞 {hl['phone']}</a>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.write("---")
    if st.button(f"⬅️ {fac_texts.get('back_to_result', 'Back')}", key="btn_facilities_back"):
        if st.session_state.get("triage_result"):
            st.session_state.screen = "result"
        else:
            st.session_state.screen = "home"
        st.rerun()

    render_bottom_navigation()


# --------------------------------------------------------------------------- Screen 9: ASHA Referral Summary
def render_summary():
    render_header(show_nav=True)
    i18n = get_current_i18n()
    s_texts = i18n.get("summary", {})
    lang_enum = get_current_lang_enum()
    result = st.session_state.get("triage_result")

    st.markdown(f"## {s_texts.get('title')}")
    st.markdown(f"<p style='color:#64748B;'>{s_texts.get('subtitle')}</p>", unsafe_allow_html=True)

    summary_text = generate_asha_summary(
        result=result,
        raw_symptom_text=st.session_state.get("symptom_text", ""),
        follow_up_answers=st.session_state.get("follow_up_answers", []),
        language=lang_enum,
    )

    st.markdown(f'<div class="ss-summary-block">{summary_text}</div>', unsafe_allow_html=True)

    c1, c2 = st.columns(2)
    with c1:
        encoded = urllib.parse.quote(summary_text)
        wa_url = f"https://api.whatsapp.com/send?text={encoded}"
        st.markdown(
            f"""
            <a href="{wa_url}" target="_blank" style="text-decoration:none;">
                <button style="width:100%; min-height:48px; background:#059669; color:white; font-size:0.95rem; font-weight:700; border-radius:8px; border:none; cursor:pointer;">
                    💬 {s_texts.get('whatsapp_button', 'Share via WhatsApp')}
                </button>
            </a>
            """,
            unsafe_allow_html=True,
        )

    with c2:
        st.download_button(
            label=f"📥 {s_texts.get('download_button', 'Download')}",
            data=summary_text,
            file_name=f"SwasthaSathi_Referral_{st.session_state.session_id}.txt",
            mime="text/plain",
            key="btn_download_summary",
        )

    st.write("---")
    if st.button(f"⬅️ {s_texts.get('back_to_result', 'Back to Result')}", key="btn_summary_back"):
        st.session_state.screen = "result"
        st.rerun()

    render_bottom_navigation()


# --------------------------------------------------------------------------- Screen 10: Report Upload & Result
def render_report_upload():
    render_header(show_nav=True)
    i18n = get_current_i18n()
    rep = i18n.get("report", {})

    st.markdown(f"## {rep.get('title')}")
    st.markdown(f"<p style='color:#64748B;'>{rep.get('subtitle')}</p>", unsafe_allow_html=True)

    uploaded_file = st.file_uploader(rep.get("upload_label"), type=["jpg", "jpeg", "png"])

    st.info(f"🔒 {rep.get('privacy_notice')}")

    if st.button(f"🧪 {rep.get('sample_button')}", key="btn_sample_cbc"):
        sample_text = (
            "Complete Blood Count Report\n"
            "Hemoglobin: 10.2 g/dL (Reference Range: 12.0 - 15.5)\n"
            "WBC Count: 7500 /cumm (Reference Range: 4000 - 11000)\n"
            "Platelet Count: 210000 /cumm (Reference Range: 150000 - 450000)\n"
            "ESR: 26 mm/hr\n"
        )
        res = analyze_report_text(sample_text)
        st.session_state.report_result = res
        st.session_state.screen = "report_result"
        st.rerun()

    if uploaded_file:
        if st.button(f"🔍 {rep.get('analyze_button')}", key="btn_analyze_report", type="primary"):
            with st.spinner("Extracting printed values and reference ranges..."):
                img_bytes = uploaded_file.read()
                from services.ocr import extract_text_from_image

                ok, ocr_text, err = extract_text_from_image(img_bytes)
                if not ok or not ocr_text:
                    st.error(err or "Could not extract text. Please ensure the photo is clear and well-lit.")
                    return

                res = analyze_report_text(ocr_text)
                st.session_state.report_result = res
                st.session_state.screen = "report_result"
                st.rerun()

    st.write("---")
    if st.button("⬅️ Home", key="btn_report_back"):
        st.session_state.screen = "home"
        st.rerun()

    render_bottom_navigation()


def render_report_result():
    render_header(show_nav=True)
    i18n = get_current_i18n()
    rep = i18n.get("report", {})
    result = st.session_state.get("report_result")

    st.markdown(f"## {rep.get('result_title')}")
    st.warning(f"⚠️ {rep.get('disclaimer_note')}")

    items = result.items if hasattr(result, "items") else result.get("items", [])

    if not items:
        st.info("No test parameters detected with printed values. Please discuss with your clinician.")
    else:
        for it in items:
            t_name = it.test_name if hasattr(it, "test_name") else it.get("test_name")
            val = it.value if hasattr(it, "value") else it.get("value")
            unit = it.unit if hasattr(it, "unit") else it.get("unit")
            pr_range = it.printed_range if hasattr(it, "printed_range") else it.get("printed_range")
            flag = it.flag if hasattr(it, "flag") else it.get("flag")
            exp = it.plain_explanation if hasattr(it, "plain_explanation") else it.get("plain_explanation")

            render_range_comparator_bar(
                test_name=t_name,
                value=val,
                unit=unit,
                printed_range=pr_range,
                flag=flag,
                explanation=exp,
            )

    st.write("---")
    if st.button("⬅️ Back to Home", key="btn_rep_res_home"):
        st.session_state.screen = "home"
        st.rerun()

    render_bottom_navigation()


# --------------------------------------------------------------------------- Screen 11: About & Safety Standards
def render_about():
    render_header(show_nav=True)
    i18n = get_current_i18n()
    ab = i18n.get("about", {})

    st.markdown(f"## {ab.get('title')}")
    st.markdown(f"<p style='color:#334155; line-height:1.5;'>{ab.get('mission')}</p>", unsafe_allow_html=True)

    st.markdown("### 🛡️ Non-Negotiable Safety Architecture")
    st.markdown(
        f"""
        - **{ab.get('safety_rule_1')}**
        - **{ab.get('safety_rule_2')}**
        - **{ab.get('safety_rule_3')}**
        - **{ab.get('safety_rule_4')}**
        """
    )

    st.warning(ab.get("disclaimer_box"))

    st.write("---")
    if st.button(f"🗑️ {ab.get('clear_data_button', 'Clear Session Data')}", key="btn_clear_session"):
        st.session_state.clear()
        st.success("Session data cleared successfully.")
        st.rerun()

    if st.button(f"🏠 {ab.get('back_home', 'Back to Home')}", key="btn_about_home"):
        st.session_state.screen = "home"
        st.rerun()

    render_bottom_navigation()
