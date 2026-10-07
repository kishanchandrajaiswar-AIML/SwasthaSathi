Stage C: UI journey

text
Build app.py as a screen state machine and the screens in Section 15 (welcome, language, home, input,
follow-up, emergency, result, facilities, summary, about). Mobile-first CSS with large buttons. Add
ui/i18n en.json, hi.json, mr.json (mark strings needing native-speaker review). The emergency screen
must use rules only, with no network call. Add template-based services/summary.py and
services/facilities.py reading data/facilities.json (placeholders only). Run the app and describe
how to test it on a phone. Stop.

Stage D: extras (only after C is stable)

text
Add voice (st.audio_input + Groq Whisper, transcript confirm/edit step, text fallback), the report flow
(OCR, extract values, compare ONLY against printed ranges, RANGE_NOT_FOUND otherwise, Section 13.4),
Demo Mode from data/demo_scenarios.json with a visible "pre-recorded" label, and anonymous metrics
(no symptom text). Each feature must degrade gracefully if its API fails.

Stage E: evidence

text
Create tests/test_cases.csv with all 26 cases from Section 19 and tests/run_eval.py that reports
emergency recall on Critical rows, false-alarm rate and latency, in mock and live modes. Then run
failure-mode tests from Section 24 (no keys, both LLMs down, bad file, offline) and fix problems.