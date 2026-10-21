/**
 * Triage Business Logic Service.
 * Manages symptom validation, risk level metadata, and referral memo generation.
 */
import { Config } from '../config.js';

export class TriageService {
  /**
   * Validate symptom narrative input.
   */
  static validateSymptomText(text) {
    const trimmed = (text || '').trim();
    if (trimmed.length < Config.LIMITS.MIN_SYMPTOM_CHARS) {
      return {
        isValid: false,
        error: `Please describe symptoms with at least ${Config.LIMITS.MIN_SYMPTOM_CHARS} characters.`,
      };
    }
    if (trimmed.length > Config.LIMITS.MAX_SYMPTOM_CHARS) {
      return {
        isValid: false,
        error: `Symptom description cannot exceed ${Config.LIMITS.MAX_SYMPTOM_CHARS} characters.`,
      };
    }
    return { isValid: true, error: null, text: trimmed };
  }

  /**
   * Retrieve UI presentation metadata for clinical risk level.
   */
  static getRiskMeta(riskLevel) {
    const norm = (riskLevel || 'HOME_CARE').toUpperCase();
    switch (norm) {
      case 'EMERGENCY':
        return {
          level: 'EMERGENCY',
          badgeText: 'Emergency Red-Flag',
          badgeClass: 'badge-emergency',
          icon: 'emergency',
          headerColor: 'var(--error, #dc2626)',
          actionLead: 'Immediate Hospital Transfer Required (Call 108)',
        };
      case 'VISIT_PHC':
        return {
          level: 'VISIT_PHC',
          badgeText: 'Visit PHC Clinic',
          badgeClass: 'badge-phc',
          icon: 'local_hospital',
          headerColor: 'var(--warning, #f59e0b)',
          actionLead: 'Consult Doctor or Health Worker within 24–48 Hours',
        };
      case 'HOME_CARE':
      default:
        return {
          level: 'HOME_CARE',
          badgeText: 'Home Care Guidance',
          badgeClass: 'badge-home',
          icon: 'home_health',
          headerColor: 'var(--teal-primary, #0f766e)',
          actionLead: 'Supportive Home Observation & Hydration',
        };
    }
  }

  /**
   * Format ASHA/referral summary for clipboard or SMS sharing.
   */
  static formatReferralSummary(triageResult, symptoms, sessionData = {}) {
    const date = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const risk = triageResult.risk_level || 'HOME_CARE';
    const action = triageResult.recommended_action || 'Consult local medical provider.';

    return [
      `=== SWASTHASATHI CLINICAL REFERRAL MEMO ===`,
      `Date/Time: ${date}`,
      `Risk Tier: ${risk}`,
      `Chief Complaint: ${symptoms}`,
      `Recommended Action: ${action}`,
      `Clinical Governance: MoHFW India Guidelines & WHO IMNCI Decision Support`,
      `===========================================`,
    ].join('\n');
  }
}
