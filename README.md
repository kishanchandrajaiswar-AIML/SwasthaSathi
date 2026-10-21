<div align="center">
  <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80" alt="SwasthaSathi Banner" width="600" style="border-radius: 12px;"/>
  <h1>🏥 SwasthaSathi</h1>
  <p><strong>AI-Assisted Clinical Decision Support & Rural Healthcare Facility Navigation Platform</strong></p>
  <p>Engineered for deterministic patient safety, multilingual triage, verified clinician routing, and zero diagnostic hallucinations.</p>
</div>

<br>

## 🌟 Architectural Highlights

- 🛡️ **Dual-Engine Clinical Safety**: Combines fast-inference Groq LLMs (`llama-3.3-70b-versatile`) with deterministic offline emergency rules (`2026.1-safety-v1`). Red-flag emergencies bypass LLMs instantly (<40 ms) and trigger 108 emergency actions.
- 🏗️ **Scalable & Decoupled Architecture**: Cleanly separated into `core/` (config & errors), `api/` (declarative router & routes), `services/` (domain logic), and `web/js/` (modular components, pub/sub state store, and unified API client).
- 📍 **Authentic Healthcare Locator**: Computes Haversine distances to verified Primary Health Centres (PHCs), Community Health Centres (CHCs), and Sub-District Hospitals.
- 🔬 **Objective Lab Explainer**: Analyzes lab report values strictly against printed reference ranges to prevent hallucinated diagnoses.
- 🔒 **Role-Based Security & Compliance**: Strict role separation between Patients and Clinicians with State Medical Council (NMC) credential checks and DPDP Act 2023 disclosures.

---

## 📂 Project Structure

```text
swasthasathi/
├── server.py                    # Lean HTTP server bootstrap
├── core/                        # Centralized settings, error codes, and logger
│   ├── config.py                # Environment configuration singleton
│   ├── errors.py                # AppError hierarchy with uniform JSON envelopes
│   └── logger.py                # Structured console logging
├── api/                         # Scalable REST API Framework
│   ├── router.py                # Declarative method router with CORS & error boundary
│   ├── context.py               # RequestContext & APIResponse envelopes
│   └── routes/                  # Dedicated endpoint handlers
│       ├── system.py            # /api/status, /api/config, /api/guidelines
│       ├── triage.py            # /api/triage
│       ├── facilities.py        # /api/facilities, /api/location/*
│       ├── doctors.py           # /api/doctors
│       ├── reports.py           # /api/report
│       ├── vitals.py            # /api/vitals
│       └── voice.py             # /api/transcribe
├── ai/                          # AI orchestration & Pydantic contracts
├── safety/                      # Multilingual deterministic safety rules & validator
├── services/                    # Geolocation, lab parsing, ASHA summaries, and STT
├── web/                         # Mobile-first web application
│   ├── index.html               # Semantic UI with accessible modals
│   ├── styles.css               # Design system & tokens
│   ├── supabaseClient.js        # Auth client with offline sandbox fallback
│   ├── app.js                   # Main application coordinator
│   └── js/                      # Modular Frontend Framework
│       ├── config.js            # Frontend configuration & storage keys
│       ├── state.js             # Reactive Pub/Sub State Store
│       ├── api.js               # Unified HTTP client with timeout & retry
│       ├── services/            # Domain services (Vitals, Triage)
│       └── components/          # Reusable UI components (Toast, Modals, Cards)
├── tests/                       # Unit tests, integration tests, and clinical benchmarks
└── docs/                        # Architecture diagrams and technical specs
```

---

## 📡 REST API Documentation

| Method | Endpoint | Description | Request Payload / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/status` | System health & rules version | None |
| `GET` | `/api/config` | Client-facing public configuration | None |
| `POST` | `/api/triage` | Symptom assessment & safety classification | `{"text": "...", "language": "en\|hi\|mr"}` |
| `GET` | `/api/facilities` | Nearby clinics & hospitals sorted by GPS distance | `?lat=18.57&lng=73.98&emergency=true` |
| `GET` | `/api/doctors` | Verified medical officers with NMC registrations | `?lat=18.57&lng=73.98` |
| `POST` | `/api/report` | Objective laboratory reference range comparator | `{"text": "Hemoglobin: 9.8 g/dL..."}` |
| `GET` | `/api/vitals` | Retrieve current patient vital signs | None |
| `POST` | `/api/vitals` | Record patient vitals | `{"temperature": "98.6 F", "bp": "120/80"}` |
| `POST` | `/api/transcribe`| Base64 audio transcription via Whisper STT | `{"audio_base64": "...", "language": "hi"}` |
| `GET` | `/api/guidelines`| Authenticated clinical practice guidelines | None |

---

## ⚙️ Quickstart & Local Setup

### 1. Environment Setup
```bash
# Clone the repository
git clone https://github.com/kishanchandrajaiswar-AIML/SwasthaSathi.git
cd SwasthaSathi

# Create and activate Python virtual environment
python -m venv .venv
.venv\Scripts\activate      # On Windows
# source .venv/bin/activate  # On macOS/Linux

# Install dependencies
pip install -r requirements.txt
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your keys:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...your-anon-key-here
PORT=8080
```

### 3. Launch the Server
```bash
python server.py
```
Open **`http://localhost:8080/`** in your browser.

---

## 🧪 Testing Suite

SwasthaSathi includes automated test coverage spanning unit, integration, and clinical benchmarks:

```bash
# 1. Run all Python unit and API tests (34+ tests)
pytest -v

# 2. Run JavaScript bundle and DOM smoke tests
npm test

# 3. Run Clinical Recall & Section 24 Failure-Mode Benchmark
python tests/run_eval.py
```

### Benchmark Metrics
- **Critical Emergency Recall**: **100.0% (13/13)**
- **False Alarm Rate**: **0.0% (0/6)**
- **Offline Emergency Latency**: **< 15 ms**
- **Live Groq LLM Latency**: **~ 39 ms median**
