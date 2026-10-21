/**
 * SwasthaSathi Reactive State Management Store.
 * Implements an observable Pub/Sub pattern for predictable state updates
 * and decoupling business state from DOM manipulation.
 */
import { Config } from './config.js';

class StateStore {
  constructor(initialState = {}) {
    this._state = {
      // Navigation & Layout
      currentView: 'home',
      currentLang: localStorage.getItem(Config.STORAGE_KEYS.LANGUAGE) || 'en',

      // Session & Triage
      sessionId: 'session-' + Math.random().toString(36).substring(2, 9),
      triageRisk: 'HOME_CARE',
      symptomText: '',
      followups: [],
      followupIndex: 0,
      isEvaluating: false,
      lastTriageResult: null,

      // User & Clinical Role
      currentUser: null,
      currentProfile: null,
      doctorVerif: null,

      // Location & Facilities
      userLocation: {
        name: 'Wagholi, Pune',
        lat: 18.5793,
        lng: 73.9806,
        isExactGPS: false,
        isManual: false,
      },
      facilityFilter: 'ALL',
      facilities: [],
      verifiedDoctors: [],
      appointments: [],
      selectedDoctor: null,
      selectedSlot: 'Morning OPD (9:00 AM - 1:00 PM)',

      // Vitals
      patientVitals: this._loadPersistedVitals(),

      // Clinical Preferences
      preferences: {
        specialty: 'all',
        location: '5km',
        budget: 'all',
      },

      ...initialState,
    };

    this._listeners = new Map();
  }

  /**
   * Retrieve current state value for a key.
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Retrieve snapshot of the entire state object.
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Set state for a specific key and notify subscribed listeners.
   */
  set(key, value) {
    const prevValue = this._state[key];
    if (prevValue === value) return;

    this._state[key] = value;
    this._notify(key, value, prevValue);

    // Auto-persist select keys
    if (key === 'patientVitals') {
      try {
        localStorage.setItem(Config.STORAGE_KEYS.VITALS, JSON.stringify(value));
      } catch (e) {
        console.warn('Failed to persist vitals to localStorage', e);
      }
    } else if (key === 'currentLang') {
      try {
        localStorage.setItem(Config.STORAGE_KEYS.LANGUAGE, value);
      } catch (e) {
        console.warn('Failed to persist language to localStorage', e);
      }
    }
  }

  /**
   * Merge partial state updates and trigger appropriate notifications.
   */
  update(partialState) {
    if (!partialState || typeof partialState !== 'object') return;
    for (const [key, val] of Object.entries(partialState)) {
      this.set(key, val);
    }
  }

  /**
   * Subscribe a callback to state changes on a specific key.
   * Returns an unsubscribe cleanup function.
   */
  subscribe(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);

    return () => {
      const subs = this._listeners.get(key);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  /**
   * Notify subscribers of a state change.
   */
  _notify(key, newValue, oldValue) {
    const subs = this._listeners.get(key);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(newValue, oldValue);
        } catch (err) {
          console.error(`Error in state subscriber for '${key}':`, err);
        }
      }
    }
  }

  /**
   * Load persisted vitals from localStorage.
   */
  _loadPersistedVitals() {
    try {
      const saved = localStorage.getItem(Config.STORAGE_KEYS.VITALS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // fallback
    }
    return {
      temp: null,
      bp: null,
      sugar: null,
      hr: null,
    };
  }
}

// Export singleton instance
export const store = new StateStore();
