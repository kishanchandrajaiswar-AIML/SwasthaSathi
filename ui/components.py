"""Minimalist clinical UI components for SwasthaSathi.

Implements clean Swiss-inspired layout:
- Minimalist typography and crisp 1px borders
- SVG Sparkline vitals chart widgets
- Linear 3-tier risk calibration gauge
- Range comparator bars for laboratory report analysis
- Subtle tactile hover interactions
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import streamlit as st

from ai.schemas import Language, RiskLevel, UrgencyLabel

FIRST_AID_PATH = Path(__file__).parent.parent / "safety" / "first_aid.json"
WARNING_SIGNS_PATH = Path(__file__).parent.parent / "safety" / "warning_signs.json"
DISCLAIMERS_PATH = Path(__file__).parent.parent / "safety" / "disclaimers.json"


@st.cache_data
def _load_json_library(path: str) -> dict[str, dict[str, str]]:
    p = Path(path)
    if not p.is_file():
        return {}
    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {item["id"]: item.get("text", {}) for item in data if isinstance(item, dict) and "id" in item}
    except Exception:
        return {}


def get_first_aid_text(fa_id: str, lang: Language) -> str:
    lib = _load_json_library(str(FIRST_AID_PATH))
    texts = lib.get(fa_id, {})
    return texts.get(lang.value) or texts.get("en") or fa_id


def get_warning_sign_text(ws_id: str, lang: Language) -> str:
    lib = _load_json_library(str(WARNING_SIGNS_PATH))
    texts = lib.get(ws_id, {})
    return texts.get(lang.value) or texts.get("en") or ws_id


def render_header(show_nav: bool = True):
    """Render minimalist app header with logo, title, and compact language pills."""
    current_lang = st.session_state.get("language", "hi")

    st.markdown(
        """
        <div class="ss-min-header">
            <div class="ss-min-brand">
                <div class="ss-min-logo">🩺</div>
                <div>
                    <h1 class="ss-min-title">SwasthaSathi</h1>
                    <p class="ss-min-subtitle">Multilingual Healthcare Triage Support</p>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font-size:0.75rem; font-weight:700; color:#0284C7; background:#E0F2FE; padding:0.2rem 0.55rem; border-radius:9999px;">
                    ASHA Verified
                </span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if show_nav:
        # Minimalist 3-button language segmented control
        c_space, c1, c2, c3 = st.columns([1.5, 1, 1, 1])
        with c1:
            label_hi = "● हिंदी" if current_lang == "hi" else "हिंदी"
            if st.button(label_hi, key="hdr_lang_hi", help="हिंदी"):
                st.session_state.language = "hi"
                st.rerun()
        with c2:
            label_mr = "● मराठी" if current_lang == "mr" else "मराठी"
            if st.button(label_mr, key="hdr_lang_mr", help="मराठी"):
                st.session_state.language = "mr"
                st.rerun()
        with c3:
            label_en = "● EN" if current_lang == "en" else "EN"
            if st.button(label_en, key="hdr_lang_en", help="English"):
                st.session_state.language = "en"
                st.rerun()


def render_vitals_telemetry_widget(lang: Language):
    """Render minimalist vitals widget with SVG sparkline charts."""
    if lang == Language.MR:
        title = "आरोग्य मापदंड आणि निरीक्षण (Vitals Telemetry)"
        t_hr, v_hr, m_hr = "हृदय गती", "74 bpm", "नियमित गती"
        t_bp, v_bp, m_bp = "रक्तदाब", "118/78", "सामान्य श्रेणी"
        t_temp, v_temp, m_temp = "शरीराचे तापमान", "98.4 °F", "ताप नाही"
        t_spo2, v_spo2, m_spo2 = "ऑक्सिजन संपृक्तता", "98 %", "उत्कृष्ट पातळी"
    elif lang == Language.HI:
        title = "स्वास्थ्य मापदंड एवं निगरानी (Vitals Telemetry)"
        t_hr, v_hr, m_hr = "हृदय गति", "74 bpm", "नियमित गति"
        t_bp, v_bp, m_bp = "रक्तचाप", "118/78", "सामान्य सीमा"
        t_temp, v_temp, m_temp = "शरीर का तापमान", "98.4 °F", "बुखार नहीं"
        t_spo2, v_spo2, m_spo2 = "ऑक्सीजन स्तर", "98 %", "उत्कृष्ट स्तर"
    else:
        title = "Vitals Telemetry & Observational Benchmarks"
        t_hr, v_hr, m_hr = "Heart Rate", "74 bpm", "Resting regular"
        t_bp, v_bp, m_bp = "Blood Pressure", "118/78", "Normal range"
        t_temp, v_temp, m_temp = "Body Temp", "98.4 °F", "Afebrile normal"
        t_spo2, v_spo2, m_spo2 = "Oxygen (SpO2)", "98 %", "Optimal pulse"

    st.markdown(
        f"""
        <div style="margin: 0.5rem 0 1rem 0;">
            <div style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.6rem;">
                📈 {title}
            </div>
            <div class="ss-vitals-grid">
                <!-- Heart Rate Sparkline Card -->
                <div class="ss-vital-card">
                    <div class="ss-vital-header">
                        <span>{t_hr}</span>
                        <span>❤️</span>
                    </div>
                    <div class="ss-vital-value">{v_hr}</div>
                    <div class="ss-vital-meta">{m_hr}</div>
                    <svg class="ss-sparkline-svg" viewBox="0 0 100 25" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#E11D48" stop-opacity="0.25"/>
                                <stop offset="100%" stop-color="#E11D48" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,15 L15,16 L25,12 L35,22 L45,3 L55,20 L65,14 L80,15 L100,14" fill="none" stroke="#E11D48" stroke-width="2" stroke-linecap="round"/>
                        <path d="M0,15 L15,16 L25,12 L35,22 L45,3 L55,20 L65,14 L80,15 L100,14 L100,25 L0,25 Z" fill="url(#hrGrad)"/>
                    </svg>
                </div>

                <!-- Blood Pressure Sparkline Card -->
                <div class="ss-vital-card">
                    <div class="ss-vital-header">
                        <span>{t_bp}</span>
                        <span>🩸</span>
                    </div>
                    <div class="ss-vital-value">{v_bp}</div>
                    <div class="ss-vital-meta">{m_bp}</div>
                    <svg class="ss-sparkline-svg" viewBox="0 0 100 25" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#0284C7" stop-opacity="0.25"/>
                                <stop offset="100%" stop-color="#0284C7" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,18 Q20,8 40,16 T80,12 T100,14" fill="none" stroke="#0284C7" stroke-width="2" stroke-linecap="round"/>
                        <path d="M0,18 Q20,8 40,16 T80,12 T100,14 L100,25 L0,25 Z" fill="url(#bpGrad)"/>
                    </svg>
                </div>

                <!-- Temperature Sparkline Card -->
                <div class="ss-vital-card">
                    <div class="ss-vital-header">
                        <span>{t_temp}</span>
                        <span>🌡️</span>
                    </div>
                    <div class="ss-vital-value">{v_temp}</div>
                    <div class="ss-vital-meta">{m_temp}</div>
                    <svg class="ss-sparkline-svg" viewBox="0 0 100 25" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#D97706" stop-opacity="0.25"/>
                                <stop offset="100%" stop-color="#D97706" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,15 L20,15 L40,14 L60,16 L80,14 L100,15" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round"/>
                        <path d="M0,15 L20,15 L40,14 L60,16 L80,14 L100,15 L100,25 L0,25 Z" fill="url(#tempGrad)"/>
                    </svg>
                </div>

                <!-- Oxygen SpO2 Sparkline Card -->
                <div class="ss-vital-card">
                    <div class="ss-vital-header">
                        <span>{t_spo2}</span>
                        <span>🫁</span>
                    </div>
                    <div class="ss-vital-value">{v_spo2}</div>
                    <div class="ss-vital-meta">{m_spo2}</div>
                    <svg class="ss-sparkline-svg" viewBox="0 0 100 25" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#059669" stop-opacity="0.25"/>
                                <stop offset="100%" stop-color="#059669" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,12 L25,12 L50,11 L75,13 L100,12" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round"/>
                        <path d="M0,12 L25,12 L50,11 L75,13 L100,12 L100,25 L0,25 Z" fill="url(#spo2Grad)"/>
                    </svg>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_triage_risk_gauge(risk_level: RiskLevel, urgency_label: Optional[UrgencyLabel]):
    """Render a clean minimalist 3-segment calibrated risk gauge."""
    pos_percent = 16.6 if risk_level == RiskLevel.HOME_CARE else (50.0 if risk_level == RiskLevel.VISIT_PHC else 83.3)
    pin_color = "#059669" if risk_level == RiskLevel.HOME_CARE else ("#D97706" if risk_level == RiskLevel.VISIT_PHC else "#E11D48")

    st.markdown(
        f"""
        <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:0.9rem; margin-bottom:1rem; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">
                <span>Triage Risk Spectrum</span>
                <span style="color:{pin_color}; font-weight:800;">{risk_level.value}</span>
            </div>
            <!-- Segmented Gauge Track -->
            <div style="position:relative; height:10px; background:#F1F5F9; border-radius:9999px; overflow:hidden; display:flex;">
                <div style="flex:1; background:#D1FAE5; border-right:1px solid #FFFFFF;"></div>
                <div style="flex:1; background:#FEF3C7; border-right:1px solid #FFFFFF;"></div>
                <div style="flex:1; background:#FFE4E6;"></div>
            </div>
            <!-- Indicator Pin -->
            <div style="position:relative; height:6px; margin-top:2px;">
                <div style="position:absolute; left:{pos_percent}%; transform:translateX(-50%); width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-bottom:6px solid {pin_color};"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:600; color:#94A3B8; margin-top:0.25rem;">
                <span>Home Care</span>
                <span>Visit PHC</span>
                <span>Emergency</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_range_comparator_bar(test_name: str, value: float, unit: str, printed_range: Optional[str], flag: str, explanation: str):
    """Render minimalist visual comparator bar for laboratory test ranges."""
    pos = 50.0
    status_class = "normal"
    badge_label = "Normal"
    badge_color = "#059669"
    badge_bg = "#ECFDF5"

    if flag == "BELOW_PRINTED_RANGE":
        pos = 18.0
        status_class = "below"
        badge_label = "Below Printed Range"
        badge_color = "#D97706"
        badge_bg = "#FFFBEB"
    elif flag == "ABOVE_PRINTED_RANGE":
        pos = 85.0
        status_class = "above"
        badge_label = "Above Printed Range"
        badge_color = "#E11D48"
        badge_bg = "#FFF1F2"
    elif flag == "RANGE_NOT_FOUND":
        pos = 50.0
        status_class = "unknown"
        badge_label = "Range Not Stated"
        badge_color = "#64748B"
        badge_bg = "#F1F5F9"

    st.markdown(
        f"""
        <div class="ss-card" style="margin-bottom:0.75rem; padding:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:#0F172A;">{test_name}</h4>
                    <span style="font-size:0.85rem; font-weight:700; color:#0284C7;">{value} {unit}</span>
                </div>
                <span style="font-size:0.75rem; font-weight:700; color:{badge_color}; background:{badge_bg}; border:1px solid {badge_color}33; padding:0.2rem 0.6rem; border-radius:9999px;">
                    {badge_label}
                </span>
            </div>

            <!-- Range Bar -->
            <div class="ss-range-bar-wrapper">
                <div class="ss-range-bar-track">
                    <div class="ss-range-bar-normal-zone"></div>
                    <div class="ss-range-bar-pointer {status_class}" style="left:calc({pos}% - 5px);"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:#64748B;">
                    <span>Printed Range: {printed_range or 'Not specified on report'}</span>
                </div>
            </div>

            <p style="margin:0.4rem 0 0 0; font-size:0.85rem; color:#475569; line-height:1.4;">
                {explanation}
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_emergency_banner(i18n: dict[str, Any]):
    """Render high-contrast emergency banner with call buttons."""
    em_texts = i18n.get("emergency", {})
    title = em_texts.get("banner_title", "EMERGENCY: Immediate Medical Care Needed")
    sub = em_texts.get("banner_subtitle", "Critical symptoms detected. Do NOT wait.")
    badge = em_texts.get("offline_badge", "Offline Safety Rule Triggered")

    st.markdown(
        f"""
        <div class="ss-emergency-banner">
            <div class="ss-emergency-title">🚨 {title}</div>
            <p class="ss-emergency-subtitle">{sub}</p>
            <span style="display:inline-block; font-size:0.78rem; font-weight:700; color:#E11D48; background:#FFFFFF; border:1px solid #FECDD3; padding:0.25rem 0.65rem; border-radius:9999px;">
                ⚡ {badge}
            </span>
        </div>
        """,
        unsafe_allow_html=True,
    )

    c1, c2 = st.columns(2)
    with c1:
        st.markdown(
            f"""
            <a href="tel:112" class="ss-emergency-call-btn">
                📞 {em_texts.get('call_112', 'Call 112')}
            </a>
            """,
            unsafe_allow_html=True,
        )
    with c2:
        st.markdown(
            f"""
            <a href="tel:108" class="ss-emergency-call-btn" style="background:#BE123C;">
                🚑 {em_texts.get('call_108', 'Call 108')}
            </a>
            """,
            unsafe_allow_html=True,
        )


def render_risk_badge(risk_level: RiskLevel, urgency_label: Optional[UrgencyLabel], i18n: dict[str, Any]):
    """Render color-coded triage risk level badge."""
    res_texts = i18n.get("result", {})
    if risk_level == RiskLevel.EMERGENCY:
        label = res_texts.get("urgency_badge_emergency", "EMERGENCY - ACT NOW")
        st.markdown(f'<div class="ss-badge ss-badge-emergency">🚨 {label}</div>', unsafe_allow_html=True)
    elif risk_level == RiskLevel.VISIT_PHC:
        if urgency_label == UrgencyLabel.WITHIN_DAYS:
            label = res_texts.get("urgency_badge_phc_days", "VISIT PHC WITHIN A FEW DAYS")
            st.markdown(f'<div class="ss-badge ss-badge-phc-days">⚠️ {label}</div>', unsafe_allow_html=True)
        else:
            label = res_texts.get("urgency_badge_phc_today", "VISIT PHC TODAY")
            st.markdown(f'<div class="ss-badge ss-badge-phc-today">⚠️ {label}</div>', unsafe_allow_html=True)
    else:
        label = res_texts.get("urgency_badge_home", "HOME CARE & OBSERVATION")
        st.markdown(f'<div class="ss-badge ss-badge-home">✅ {label}</div>', unsafe_allow_html=True)


def render_first_aid_list(first_aid_ids: list[str], lang: Language):
    """Render list of vetted first aid guidance."""
    if not first_aid_ids:
        return
    for fa_id in first_aid_ids:
        text = get_first_aid_text(fa_id, lang)
        st.markdown(
            f"""
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:0.6rem 0.85rem; margin-bottom:0.4rem; font-size:0.92rem; color:#1E293B;">
                🩹 <b>{text}</b>
            </div>
            """,
            unsafe_allow_html=True,
        )


def render_warning_signs_list(warning_sign_ids: list[str], lang: Language):
    """Render list of vetted warning signs to watch for."""
    if not warning_sign_ids:
        return
    for ws_id in warning_sign_ids:
        text = get_warning_sign_text(ws_id, lang)
        st.markdown(
            f"""
            <div style="background:#FFF1F2; border:1px solid #FECDD3; border-radius:8px; padding:0.6rem 0.85rem; margin-bottom:0.4rem; font-size:0.92rem; color:#9F1239;">
                ⚠️ <b>{text}</b>
            </div>
            """,
            unsafe_allow_html=True,
        )


def render_facility_item(facility: dict[str, Any], i18n: dict[str, Any]):
    """Render a single healthcare facility minimalist card."""
    fac_texts = i18n.get("facilities", {})
    name = facility.get("name", "Healthcare Facility")
    f_type = facility.get("type", "PHC")
    type_label = fac_texts.get(f"type_{f_type.lower()}", f_type)
    address = facility.get("address", "")
    dist = facility.get("distance_km", "")
    phone = facility.get("phone", "")
    hours = facility.get("hours", "")
    em_avail = facility.get("emergency_available", False)

    em_badge = " • 🚨 24x7 Emergency" if em_avail else ""
    dist_label = fac_texts.get("distance_km", "{dist} km").replace("{dist}", str(dist))

    st.markdown(
        f"""
        <div class="ss-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h4 style="margin:0 0 0.15rem 0; font-size:1.05rem; font-weight:700; color:#0F172A;">{name}</h4>
                    <span style="font-size:0.8rem; font-weight:600; color:#0284C7;">{type_label}{em_badge}</span>
                </div>
                <span style="font-size:0.82rem; font-weight:700; color:#475569; background:#F1F5F9; border:1px solid #E2E8F0; padding:0.2rem 0.6rem; border-radius:9999px;">
                    {dist_label}
                </span>
            </div>
            <p style="margin:0.4rem 0 0.2rem 0; font-size:0.85rem; color:#64748B;">📍 {address}</p>
            <p style="margin:0 0 0.6rem 0; font-size:0.8rem; color:#94A3B8;">⏰ {hours}</p>
            <div>
                <a href="tel:{phone}" style="text-decoration:none;">
                    <button style="padding:0.45rem 1rem; background:#0F172A; color:#FFFFFF; border:none; border-radius:8px; font-weight:600; font-size:0.88rem; cursor:pointer;">
                        📞 {fac_texts.get('call_button', 'Call')} ({phone})
                    </button>
                </a>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_bottom_navigation():
    """Render minimalist navigation dock."""
    st.write("")
    st.markdown(
        """
        <div style="text-align:center; font-size:0.75rem; color:#94A3B8; margin-top:1.5rem; margin-bottom:0.4rem;">
            Navigation Dock
        </div>
        """,
        unsafe_allow_html=True,
    )

    c1, c2, c3, c4, c5 = st.columns(5)
    with c1:
        if st.button("🏠\nHome", key="dock_home", help="Home Dashboard"):
            st.session_state.screen = "home"
            st.rerun()
    with c2:
        if st.button("🩺\nTriage", key="dock_triage", help="Check Symptoms"):
            st.session_state.screen = "input"
            st.rerun()
    with c3:
        if st.button("🏥\nClinics", key="dock_facilities", help="Find PHC"):
            st.session_state.screen = "facilities"
            st.rerun()
    with c4:
        if st.button("📄\nReport", key="dock_report", help="Lab Report"):
            st.session_state.screen = "report_upload"
            st.rerun()
    with c5:
        if st.button("ℹ️\nAbout", key="dock_about", help="About & Safety"):
            st.session_state.screen = "about"
            st.rerun()
