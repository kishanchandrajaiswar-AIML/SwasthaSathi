from pathlib import Path

from streamlit.testing.v1 import AppTest

APP_PATH = str(Path(__file__).resolve().parent.parent / "app.py")


def test_app_boots_and_shows_disclaimer() -> None:
    at = AppTest.from_file(APP_PATH).run(timeout=30)
    assert not at.exception
    assert at.session_state["screen"] == "welcome"
    assert "does not diagnose" in at.info[0].value


def test_app_never_displays_key_values(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "secret-groq-value")
    at = AppTest.from_file(APP_PATH).run(timeout=30)
    rendered = " ".join(c.value for c in at.caption)
    assert "True" in rendered
    assert "secret-" not in rendered
