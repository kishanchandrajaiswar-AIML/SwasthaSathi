"""SwasthaSathi Real Healthcare API & Web Server.

Serves the modern mobile-styled UI and connects it to genuine clinical backends:
- POST /api/triage: Executes TriagePipeline (Groq + deterministic rules)
- POST /api/report: Analyzes laboratory values strictly against printed ranges
- POST /api/transcribe: Transcribes audio using Groq Whisper model
- GET  /api/facilities: Returns verified clinics, PHCs, CHCs, and hospitals with GPS distance calculation
- GET  /api/scenarios: Returns hero demo scenarios
- GET  /api/status: System safety & Groq API status
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv

# Ensure workspace root is in path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))

load_dotenv(ROOT_DIR / ".env")

from ai.pipeline import get_pipeline
from ai.schemas import Language, RiskLevel
from services.facilities import get_nearby_facilities
from services.report import analyze_report_text
from services.stt import transcribe_audio_bytes
from services.summary import generate_asha_summary

WEB_DIR = ROOT_DIR / "web"

# In-memory patient vitals store
PATIENT_VITALS = {
    "temperature": None,
    "blood_pressure": None,
    "blood_glucose": None,
    "heart_rate": None,
    "updated_at": None,
}


class SwasthaSathiHandler(SimpleHTTPRequestHandler):
    """HTTP Handler serving static assets from web/ and handling REST API endpoints."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _send_json(self, data: Any, status: int = 200) -> None:
        payload = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            groq_key = bool(os.environ.get("GROQ_API_KEY"))
            gemini_key = bool(os.environ.get("GEMINI_API_KEY"))
            supabase_key = bool(os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL"))
            self._send_json({
                "status": "online",
                "groq_configured": groq_key,
                "gemini_configured": gemini_key,
                "supabase_configured": supabase_key,
                "offline_rules_active": True,
                "rules_version": "2026.1-safety-v1",
            })
            return

        if path == "/api/config":
            supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or ""
            supabase_anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY") or ""
            self._send_json({
                "supabase_url": supabase_url,
                "supabase_anon_key": supabase_anon,
                "supabase_configured": bool(supabase_url and supabase_anon),
            })
            return

        if path == "/api/facilities":
            query = parse_qs(parsed.query)
            try:
                user_lat = float(query["lat"][0]) if "lat" in query else None
            except Exception:
                user_lat = None
            try:
                user_lng = float(query["lng"][0]) if "lng" in query else None
            except Exception:
                user_lng = None

            fac_type = query.get("type", [None])[0]
            block = query.get("block", [None])[0]
            emergency = query.get("emergency", ["false"])[0].lower() == "true"

            facilities = get_nearby_facilities(
                district="Pune",
                facility_type=fac_type,
                emergency_only=emergency,
                user_lat=user_lat,
                user_lng=user_lng,
                block=block,
                limit=15,
            )
            self._send_json(facilities)
            return

        if path == "/api/vitals":
            self._send_json(PATIENT_VITALS)
            return

        if path == "/api/scenarios":
            scenarios_file = ROOT_DIR / "data" / "demo_scenarios.json"
            if scenarios_file.is_file():
                with open(scenarios_file, "r", encoding="utf-8") as f:
                    scenarios = json.load(f)
                self._send_json(scenarios)
            else:
                self._send_json([])
            return

        # Serve static web directory files
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            req_data = json.loads(body.decode("utf-8")) if body else {}
        except Exception:
            self._send_json({"error": "Invalid JSON payload"}, 400)
            return

        if path == "/api/triage":
            text = req_data.get("text", "").strip()
            if not text:
                self._send_json({"error": "Symptom text is required"}, 400)
                return

            lang_str = req_data.get("language", "en").lower()
            try:
                lang = Language(lang_str)
            except Exception:
                lang = Language.EN

            follow_ups = req_data.get("follow_ups", [])
            session_id = req_data.get("session_id", "web-session")

            pipeline = get_pipeline()
            try:
                result = pipeline.process_triage(
                    user_text=text,
                    follow_up_answers=follow_ups,
                    language=lang,
                    session_id=session_id,
                )

                # Generate ASHA summary memo
                summary_memo = generate_asha_summary(
                    result=result,
                    raw_symptom_text=text,
                    follow_up_answers=follow_ups,
                    language=lang,
                )

                self._send_json({
                    "success": True,
                    "triage_result": result.model_dump(),
                    "summary_text": summary_memo,
                })
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, 500)
            return

        if path == "/api/transcribe":
            audio_b64 = req_data.get("audio_base64", "")
            lang_hint = req_data.get("language", "hi")
            if not audio_b64:
                self._send_json({"success": False, "error": "No audio data provided"}, 400)
                return
            try:
                # Handle data URL prefix if present
                if "," in audio_b64:
                    audio_b64 = audio_b64.split(",", 1)[1]
                audio_bytes = base64.b64decode(audio_b64)
                ok, transcript, err = transcribe_audio_bytes(audio_bytes, language_hint=lang_hint)
                self._send_json({
                    "success": ok,
                    "transcript": transcript,
                    "error": err,
                })
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, 500)
            return

        if path == "/api/vitals":
            # Update user vitals
            if "temperature" in req_data:
                PATIENT_VITALS["temperature"] = req_data["temperature"]
            if "blood_pressure" in req_data:
                PATIENT_VITALS["blood_pressure"] = req_data["blood_pressure"]
            if "blood_glucose" in req_data:
                PATIENT_VITALS["blood_glucose"] = req_data["blood_glucose"]
            if "heart_rate" in req_data:
                PATIENT_VITALS["heart_rate"] = req_data["heart_rate"]
            from datetime import datetime
            PATIENT_VITALS["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
            self._send_json({"success": True, "vitals": PATIENT_VITALS})
            return

        if path == "/api/report":
            report_text = req_data.get("text", "").strip()
            if not report_text:
                self._send_json({"error": "Report text is required"}, 400)
                return

            try:
                analysis = analyze_report_text(report_text)
                self._send_json({
                    "success": True,
                    "analysis": analysis.model_dump(),
                })
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, 500)
            return

        self._send_json({"error": "Not Found"}, 404)


def run_server(port: int = 8080):
    server_address = ("", port)
    httpd = ThreadingHTTPServer(server_address, SwasthaSathiHandler)
    print(f"SwasthaSathi Real Healthcare Server running on http://localhost:{port}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    run_server(port)
