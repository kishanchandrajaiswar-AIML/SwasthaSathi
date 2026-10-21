/**
 * SwasthaSathi Modular Application Entry Point.
 * Integrates reactive state store, unified API client, accessible modals,
 * and component renderers.
 */
import { ApiClient } from './api.js';
import { renderDoctorCard } from './components/doctorCard.js';
import { renderFacilityCard } from './components/facilityCard.js';
import { renderLabItemCard } from './components/labReportCard.js';
import { ModalManager } from './components/modal.js';
import { Toast } from './components/toast.js';
import { renderVitalsWidget } from './components/vitalsWidget.js';
import { Config } from './config.js';
import { TriageService } from './services/triageService.js';
import { VitalsService } from './services/vitalsService.js';
import { store } from './state.js';

export class SwasthaApp {
  static init() {
    console.log(`[SwasthaSathi] Initializing v${Config.VERSION} (Safety: ${Config.RULES_VERSION})`);

    // Bind modals
    ModalManager.bind('authModal', '#btnProfileAuth', ['#btnCancelAuth', '#btnAuthClose']);
    ModalManager.bind('vitalsModal', '#btnOpenVitalsModal', ['#btnCancelVitals', '#btnVitalsClose']);
    ModalManager.bind('privacyModal', '#linkPrivacyPolicy', ['#btnClosePrivacyModal', '#btnUnderstoodPrivacy']);
    ModalManager.bind('termsModal', '#linkTermsOfService', ['#btnCloseTermsModal', '#btnUnderstoodTerms']);

    // Check system status
    this.checkHealth();
  }

  static async checkHealth() {
    try {
      const status = await ApiClient.getStatus();
      store.set('systemStatus', status);
      console.log('[SwasthaSathi] System status: ONLINE', status);
    } catch (err) {
      console.warn('[SwasthaSathi] Health check warning:', err.message);
    }
  }
}

// Export for window or module bundlers
if (typeof window !== 'undefined') {
  window.SwasthaModular = {
    Config,
    store,
    ApiClient,
    Toast,
    ModalManager,
    TriageService,
    VitalsService,
    renderDoctorCard,
    renderFacilityCard,
    renderLabItemCard,
    renderVitalsWidget,
    SwasthaApp,
  };
}
