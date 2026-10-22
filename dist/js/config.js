/**
 * SwasthaSathi Frontend Configuration.
 * Supports both local dev server and direct Supabase Edge Functions for Mobile/APK.
 */
const SUPABASE_PROJECT_URL = 'https://gsrosxssydqirmhgwpdo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdzcm9zeHNzeWRxaXJtaGd3cGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODQwNDAsImV4cCI6MjEwNjk2MDA0MH0.rb3ip45lZPc1ZKFd0__d2TlXgPjw-Hy7OfVE_tiIzxU';

// Detect if running inside Capacitor native mobile app
const isCapacitorNative = typeof window !== 'undefined' && (
  window.Capacitor?.isNativePlatform?.() ||
  window.location?.protocol === 'capacitor:' ||
  window.location?.hostname === 'localhost' && window.location?.port === ''
);

export const Config = Object.freeze({
  APP_NAME: 'SwasthaSathi',
  VERSION: '2.0.0',
  RULES_VERSION: '2026.1-safety-v1',

  // Mobile / Edge Function Environment Flags
  IS_CAPACITOR: isCapacitorNative,
  SUPABASE_URL: SUPABASE_PROJECT_URL,
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,

  // Edge Functions Base
  EDGE_BASE_URL: `${SUPABASE_PROJECT_URL}/functions/v1`,

  // API Endpoints (Adaptive: uses Edge Functions when in mobile bundle, or local /api during local dev)
  API: {
    STATUS: '/api/status',
    CONFIG: '/api/config',
    TRIAGE: isCapacitorNative ? `${SUPABASE_PROJECT_URL}/functions/v1/triage` : '/api/triage',
    FACILITIES: '/api/facilities',
    DOCTORS: '/api/doctors',
    REPORT: isCapacitorNative ? `${SUPABASE_PROJECT_URL}/functions/v1/report` : '/api/report',
    VITALS: '/api/vitals',
    TRANSCRIBE: isCapacitorNative ? `${SUPABASE_PROJECT_URL}/functions/v1/transcribe` : '/api/transcribe',
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
