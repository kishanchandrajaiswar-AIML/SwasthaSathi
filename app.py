"""SwasthaSathi - Streamlit State-Machine Entry Point.

Follows Blueprint Section 15 specifications:
- Screen state machine driven by st.session_state.screen
- Mobile-first CSS injected with large touch targets
- Dispatches cleanly to screens: welcome, language, home, input, followup, emergency,
  result, facilities, report_upload, report_result, summary, about
"""
import os
import secrets
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv

from ui.screens import (
    render_about,
    render_emergency,
    render_facilities,
    render_followup,
    render_home,
    render_input,
    render_language,
    render_report_result,
    render_report_upload,
    render_result,
    render_summary,
    render_welcome,
)

load_dotenv()

STYLES_PATH = Path(__file__).parent / "ui" / "styles.css"
DEFAULT_SCREEN = "welcome"
DISCLAIMER = (
    "SwasthaSathi gives general guidance to help you decide the next step. "
    "It does not diagnose illness or replace a doctor. "
    "If you are worried, please see a health worker or doctor."
)


def key_status(env_var: str) -> bool:
    """Return True if the env var is set. Never returns or displays the value."""
    return bool(os.environ.get(env_var))


def inject_custom_css():
    if STYLES_PATH.is_file():
        css = STYLES_PATH.read_text(encoding="utf-8")
        st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)


SCREEN_ROUTER = {
    "welcome": render_welcome,
    "language": render_language,
    "home": render_home,
    "input": render_input,
    "followup": render_followup,
    "emergency": render_emergency,
    "result": render_result,
    "facilities": render_facilities,
    "summary": render_summary,
    "report_upload": render_report_upload,
    "report_result": render_report_result,
    "about": render_about,
}


def main():
    st.set_page_config(
        page_title="SwasthaSathi | स्वास्थ्यसाथी",
        page_icon="🩺",
        layout="centered",
        initial_sidebar_state="collapsed",
    )

    inject_custom_css()

    # Session State Initialization
    if "screen" not in st.session_state:
        st.session_state.screen = DEFAULT_SCREEN
    if "language" not in st.session_state:
        st.session_state.language = "hi"
    if "session_id" not in st.session_state:
        st.session_state.session_id = secrets.token_hex(6)
    if "demo_mode" not in st.session_state:
        st.session_state.demo_mode = False

    current_screen = st.session_state.screen
    render_fn = SCREEN_ROUTER.get(current_screen, render_welcome)

    # Render current screen
    render_fn()

    # Disclaimer and system status in footer (satisfies clinical compliance & smoke tests)
    st.write("")
    st.write("---")
    st.info(DISCLAIMER)
    st.caption(
        f"Groq API configured: {key_status('GROQ_API_KEY')} • Gemini API configured: {key_status('GEMINI_API_KEY')} • Session: {st.session_state.session_id}"
    )


if __name__ == "__main__":
    main()
