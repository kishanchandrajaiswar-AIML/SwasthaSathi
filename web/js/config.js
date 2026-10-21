/**
 * SwasthaSathi Frontend Configuration.
 * Separates environment and API endpoints from application code.
 */
export const Config = Object.freeze({
  APP_NAME: 'SwasthaSathi',
  VERSION: '2.0.0',
  RULES_VERSION: '2026.1-safety-v1',

  // API Endpoints
  API: {
    STATUS: '/api/status',
    CONFIG: '/api/config',
    TRIAGE: '/api/triage',
    FACILITIES: '/api/facilities',
    DOCTORS: '/api/doctors',
    REPORT: '/api/report',
    VITALS: '/api/vitals',
    TRANSCRIBE: '/api/transcribe',
    SCENARIOS: '/api/scenarios',
    GUIDELINES: '/api/guidelines',
    LOCATION_REVERSE: '/api/location/reverse',
    LOCATION_SEARCH: '/api/location/search',
  },

  // Storage Keys
  STORAGE_KEYS: {
    USER_SESSION: 'swastha_sandbox_session',
    DOCTOR_VERIF: 'swastha_sandbox_doctor_verif',
    PREFERENCES: 'swastha_sandbox_preferences',
    VITALS: 'swastha_patient_vitals',
    LANGUAGE: 'swastha_selected_lang',
    TRIAGE_HISTORY: 'swastha_triage_history',
  },

  // Network Settings
  NETWORK: {
    TIMEOUT_MS: 15000,
    MAX_RETRIES: 2,
  },

  // Safety Boundaries
  LIMITS: {
    MAX_SYMPTOM_CHARS: 500,
    MIN_SYMPTOM_CHARS: 3,
  },
});
