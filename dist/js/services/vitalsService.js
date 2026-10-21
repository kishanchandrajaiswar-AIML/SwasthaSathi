/**
 * Clinical Vitals Assessment Service.
 * Evaluates patient physiological parameters against standard Indian public health ranges.
 */
export class VitalsService {
  /**
   * Assess body temperature in Fahrenheit.
   */
  static assessTemperature(tempF) {
    if (tempF === null || tempF === undefined || isNaN(tempF)) return null;
    const val = parseFloat(tempF);
    if (val < 95.0) {
      return { status: 'CRITICAL', label: 'Hypothermia', color: 'var(--error)' };
    }
    if (val >= 103.0) {
      return { status: 'HIGH', label: 'High Fever', color: 'var(--error)' };
    }
    if (val >= 100.4) {
      return { status: 'MODERATE', label: 'Fever', color: 'var(--warning, #f59e0b)' };
    }
    if (val >= 97.0 && val <= 99.5) {
      return { status: 'NORMAL', label: 'Normal', color: 'var(--teal-primary, #0f766e)' };
    }
    return { status: 'ELEVATED', label: 'Low-grade', color: 'var(--warning, #f59e0b)' };
  }

  /**
   * Assess blood pressure string (e.g., "120/80").
   */
  static assessBloodPressure(bpStr) {
    if (!bpStr || typeof bpStr !== 'string') return null;
    const parts = bpStr.split('/');
    if (parts.length !== 2) return null;

    const sys = parseInt(parts[0].trim(), 10);
    const dia = parseInt(parts[1].trim(), 10);
    if (isNaN(sys) || isNaN(dia)) return null;

    if (sys >= 180 || dia >= 120) {
      return { status: 'CRITICAL', label: 'Hypertensive Crisis', color: 'var(--error)' };
    }
    if (sys >= 140 || dia >= 90) {
      return { status: 'HIGH', label: 'Stage 2 Hypertension', color: 'var(--error)' };
    }
    if (sys >= 130 || dia >= 80) {
      return { status: 'MODERATE', label: 'Stage 1 Hypertension', color: 'var(--warning, #f59e0b)' };
    }
    if (sys < 90 || dia < 60) {
      return { status: 'LOW', label: 'Hypotension', color: 'var(--warning, #f59e0b)' };
    }
    return { status: 'NORMAL', label: 'Normal BP', color: 'var(--teal-primary, #0f766e)' };
  }

  /**
   * Assess blood glucose in mg/dL.
   */
  static assessBloodGlucose(glucose) {
    if (glucose === null || glucose === undefined || isNaN(glucose)) return null;
    const val = parseFloat(glucose);
    if (val < 70) {
      return { status: 'CRITICAL', label: 'Hypoglycemia', color: 'var(--error)' };
    }
    if (val >= 200) {
      return { status: 'CRITICAL', label: 'Severe Hyperglycemia', color: 'var(--error)' };
    }
    if (val >= 140) {
      return { status: 'HIGH', label: 'Elevated (Pre/Diabetic)', color: 'var(--warning, #f59e0b)' };
    }
    return { status: 'NORMAL', label: 'Normal Glucose', color: 'var(--teal-primary, #0f766e)' };
  }

  /**
   * Assess resting pulse rate in bpm.
   */
  static assessHeartRate(bpm) {
    if (bpm === null || bpm === undefined || isNaN(bpm)) return null;
    const val = parseInt(bpm, 10);
    if (val > 120) {
      return { status: 'HIGH', label: 'Marked Tachycardia', color: 'var(--error)' };
    }
    if (val > 100) {
      return { status: 'MODERATE', label: 'Tachycardia', color: 'var(--warning, #f59e0b)' };
    }
    if (val < 50) {
      return { status: 'LOW', label: 'Bradycardia', color: 'var(--warning, #f59e0b)' };
    }
    return { status: 'NORMAL', label: 'Normal Heart Rate', color: 'var(--teal-primary, #0f766e)' };
  }
}
