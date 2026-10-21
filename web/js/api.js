/**
 * SwasthaSathi API Client.
 * Handles HTTP communication, timeout management, standardized JSON deserialization,
 * and unified error wrapping.
 */
import { Config } from './config.js';

export class ApiError extends Error {
  constructor(message, code = 'NETWORK_ERROR', status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ApiClient {
  /**
   * Generic fetch wrapper with timeout and standardized error handling.
   */
  static async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      timeoutMs = Config.NETWORK.TIMEOUT_MS,
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(endpoint, config);
      clearTimeout(timer);

      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errMessage = (data && data.error && data.error.message) || data.message || `Request failed with status ${response.status}`;
        const errCode = (data && data.error && data.error.code) || 'API_ERROR';
        throw new ApiError(errMessage, errCode, response.status, data);
      }

      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out. Please check your connection.', 'TIMEOUT', 408);
      }
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(err.message || 'Network connection error', 'NETWORK_ERROR', 0, err);
    }
  }

  // Convenience Endpoints
  static getStatus() {
    return this.request(Config.API.STATUS);
  }

  static getConfig() {
    return this.request(Config.API.CONFIG);
  }

  static postTriage(payload) {
    return this.request(Config.API.TRIAGE, { method: 'POST', body: payload });
  }

  static getFacilities(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${Config.API.FACILITIES}?${qs}` : Config.API.FACILITIES;
    return this.request(url);
  }

  static getDoctors(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${Config.API.DOCTORS}?${qs}` : Config.API.DOCTORS;
    return this.request(url);
  }

  static postReport(text) {
    return this.request(Config.API.REPORT, { method: 'POST', body: { text } });
  }

  static getVitals() {
    return this.request(Config.API.VITALS);
  }

  static postVitals(vitals) {
    return this.request(Config.API.VITALS, { method: 'POST', body: vitals });
  }

  static transcribeAudio(audioBase64, language = 'hi') {
    return this.request(Config.API.TRANSCRIBE, {
      method: 'POST',
      body: { audio_base64: audioBase64, language },
    });
  }

  static reverseGeocode(lat, lng) {
    return this.request(`${Config.API.LOCATION_REVERSE}?lat=${lat}&lng=${lng}`);
  }

  static searchLocation(query) {
    return this.request(`${Config.API.LOCATION_SEARCH}?q=${encodeURIComponent(query)}`);
  }
}
