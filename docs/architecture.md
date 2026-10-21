# SwasthaSathi System Architecture & Technical Specifications

**Version:** 2.0.0  
**Clinical Protocol:** `2026.1-safety-v1`  
**Classification:** Clinical Decision Support & Navigation Platform

---

## 1. Architectural Overview

SwasthaSathi is engineered using a decoupled, modular multi-tier architecture designed for high availability, deterministic patient safety, and zero-latency emergency escalation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (Web & Mobile)                     │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐ ┌────────────┐ │
│  │ UI Components │  │ State Store  │  │ Domain Logic  │ │ API Client │ │
│  │ (Modals,Cards)│  │  (Pub/Sub)   │  │  (Services)   │ │ (Fetch/Err)│ │
│  └───────▲───────┘  └──────▲───────┘  └───────▲───────┘ └─────┬──────┘ │
└──────────┼─────────────────┼──────────────────┼───────────────┼────────┘
           │                 │                  │               │ HTTP / JSON
┌──────────┴─────────────────┴──────────────────┴───────────────▼────────┐
│                        BACKEND API LAYER (Python)                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      API Router & Middleware                     │  │
│  │   - Security Headers (CORS, CSP, Cache-Control, No-Sniff)        │  │
│  │   - Structured Request/Response Context (api.context)            │  │
│  │   - Centralized Error Boundary (core.errors)                     │  │
│  └─────────────────▲──────────────────────────────▲─────────────────┘  │
│                    │                              │                    │
│      ┌─────────────┴──────────┐        ┌──────────┴────────────┐       │
│      │   REST Route Handlers  │        │ Core Config & Logging │       │
│      │  (Triage, Facilities,  │        │ (Settings Singleton)  │       │
│      │   Doctors, Vitals, STT)│        └───────────────────────┘       │
│      └─────────────┬──────────┘                                        │
└────────────────────┼───────────────────────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────────────────────┐
│                      DOMAIN SERVICES & SAFETY ENGINES                  │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ Deterministic Safety  │  │ AI Triage Pipeline (Groq Cloud)       │  │
│  │ - Red-Flag Engine     │  │ - Whisper STT (Audio Transcription)   │  │
│  │ - PII Redaction       │  │ - Llama 3.3 70B (Symptom Assessment)  │  │
│  │ - Dosage/Rx Blocker   │  │ - ASHA Referral Memo Generator        │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ Geospatial Engine     │  │ Lab Report Range Comparator           │  │
│  │ - Haversine Distance  │  │ - Strictly compares to printed ranges │  │
│  │ - Facility Registry   │  │ - Zero diagnostic hallucinations      │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```text
swasthasathi/
├── .env.example                 # Environment variable template
├── README.md                    # Project documentation and quickstart
├── build.cjs                    # Production bundle synchronization script
├── package.json                 # Node dependencies and scripts
├── pytest.ini                   # Python test configuration
├── requirements.txt             # Python runtime dependencies
├── server.py                    # Lean HTTP server bootstrap
├── supabase_schema.sql          # PostgreSQL schema with Row Level Security (RLS)
│
├── core/                        # Centralized Core Architecture
│   ├── __init__.py              # Exports settings and error handlers
│   ├── config.py                # Strongly typed environment configuration
│   ├── errors.py                # Standardized exception hierarchy (AppError)
│   └── logger.py                # Structured console logging
│
├── api/                         # Scalable REST API Framework
│   ├── __init__.py              # Initializes and registers route pipeline
│   ├── context.py               # RequestContext & APIResponse envelopes
│   ├── router.py                # Scalable Router class with CORS & error catching
│   └── routes/                  # Modular Route Definitions
│       ├── __init__.py          # Route registry
│       ├── system.py            # /api/status, /api/config, /api/guidelines
│       ├── triage.py            # /api/triage
│       ├── facilities.py        # /api/facilities, /api/location/*
│       ├── doctors.py           # /api/doctors
│       ├── reports.py           # /api/report
│       ├── vitals.py            # /api/vitals
│       └── voice.py             # /api/transcribe
│
├── ai/                          # AI Assessment Engine
│   ├── llm_client.py            # Groq API client with retry and timeout
│   ├── pipeline.py              # Dual-engine orchestration (Rules + LLM)
│   ├── fallback.py              # Conservative deterministic fallback
│   └── schemas.py               # Pydantic models for triage contracts
│
├── safety/                      # Medical Governance & Safety Enforcement
│   ├── rule_engine.py           # Multilingual deterministic safety rules
│   ├── rules.json               # Curated emergency red-flag patterns
│   ├── validator.py             # Dosage and disease assertion suppression
│   ├── disclaimers.json         # Statutory non-diagnostic disclaimers
│   └── first_aid.json           # Emergency life-support instructions
│
├── services/                    # Domain Business Logic
│   ├── facilities.py            # Haversine distance, geolocation, and search
│   ├── report.py                # Comma-aware lab report range parser
│   ├── stt.py                   # Speech-to-text audio processing
│   ├── summary.py               # ASHA clinical referral memo generator
│   └── metrics.py               # Latency and telemetry metrics
│
├── web/                         # Client Frontend Application
│   ├── index.html               # Semantic, mobile-first responsive layout
│   ├── styles.css               # Design system tokens and styling
│   ├── favicon.svg              # SVG medical shield favicon
│   ├── supabaseClient.js        # Supabase auth and local sandbox fallback
│   ├── app.js                   # Application coordinator & event bindings
│   └── js/                      # Modular Frontend Architecture
│       ├── config.js            # Frontend configuration and API constants
│       ├── state.js             # Reactive Pub/Sub State Store
│       ├── api.js               # Unified API client with timeout and errors
│       ├── services/            # Client Domain Services (Triage, Vitals)
│       └── components/          # Reusable UI Components (Toasts, Modals, Cards)
│
├── tests/                       # Automated Test Suite
│   ├── run_eval.py              # Clinical recall benchmark & failure-mode eval
│   ├── test_api_structure.py    # API Router & config unit tests
│   ├── test_pipeline.py         # AI Triage pipeline tests
│   ├── test_rules.py            # Multilingual emergency rules tests
│   ├── test_server_endpoints.py # Facility & guideline tests
│   └── test_validator.py        # Dosage suppression tests
│
└── docs/                        # Architectural Documentation & Media
    ├── architecture.md          # System architecture specifications (this document)
    ├── BLUEPRINT.md             # Hackathon requirements blueprint
    └── screenshots/             # Interface and responsive verification captures
```

---

## 3. Scalable API Routing

The API architecture decouples network protocol handling from business services:
- **`api.router.Router`**: Provides lightweight, declarative route registration (`@router.get`, `@router.post`).
- **`api.context.RequestContext`**: Standardizes parameter extraction (`get_query_float`, `get_query_bool`) and JSON parsing.
- **`core.errors.format_error_response`**: Transforms domain exceptions into uniform JSON contracts:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "User-friendly description",
      "details": null
    }
  }
  ```

---

## 4. Frontend State Management

The frontend utilizes an observable Pub/Sub `StateStore`:
- **Single Source of Truth**: State transitions trigger focused component updates without tight DOM couplings.
- **Persistence Layer**: Critical user preferences and vitals seamlessly serialize to `localStorage`.
- **Role Isolation**: The store enforces view guards across `patient`, `doctor`, and `pending_verification` user states.

---

## 5. Clinical Safety Dual-Engine

```text
User Narrative Input
        │
        ▼
[ PII Redaction ] (Masks Aadhaar, phone numbers, names)
        │
        ▼
[ Deterministic Rule Engine ] ──(Emergency Trigger?)──► IMMEDIATE EMERGENCY RESULT (0 ms LLM wait)
        │ No Emergency
        ▼
[ Groq LLM Assessment ]
        │
        ▼
[ Safety Output Validator ]
        ├── Rejects Disease Assertions ("You have Dengue" -> "Symptoms consistent with acute viral illness")
        ├── Blocks Medication Dosages (Suppresses prescription quantities)
        └── Prevents Risk Downgrading (LLM cannot override deterministic safety floor)
        │
        ▼
[ Verified Triage Output + ASHA Referral Memo ]
```
