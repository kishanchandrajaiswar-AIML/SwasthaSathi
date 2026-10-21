/**
 * Vitals Widget Component.
 * Renders patient vital signs grid with clinical assessment status.
 */
import { VitalsService } from '../services/vitalsService.js';

export function renderVitalsWidget(vitals = {}) {
  const tempAssess = VitalsService.assessTemperature(vitals.temp);
  const bpAssess = VitalsService.assessBloodPressure(vitals.bp);
  const sugarAssess = VitalsService.assessBloodGlucose(vitals.sugar);
  const hrAssess = VitalsService.assessHeartRate(vitals.hr);

  const formatItem = (title, val, unit, assess, icon) => {
    const displayVal = val !== null && val !== undefined && val !== '' ? val : '—';
    const tag = assess ? `<span style="font-size: 10px; font-weight: 700; color: ${assess.color};">${assess.label}</span>` : '';

    return `
      <div class="vital-stat-box" style="background: var(--surface); border: 1px solid var(--outline-variant); border-radius: 10px; padding: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: var(--on-surface-variant); font-weight: 600;">${title}</span>
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--teal-primary);">${icon}</span>
        </div>
        <div style="margin-top: 6px; display: flex; align-items: baseline; gap: 4px;">
          <span style="font-size: 16px; font-weight: 800; color: var(--on-surface);">${displayVal}</span>
          <span style="font-size: 10px; color: var(--on-surface-variant); font-weight: 600;">${unit}</span>
        </div>
        <div style="margin-top: 4px;">${tag}</div>
      </div>
    `;
  };

  return `
    <div class="vitals-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
      ${formatItem('Body Temp', vitals.temp, '°F', tempAssess, 'device_thermostat')}
      ${formatItem('Blood Pressure', vitals.bp, 'mmHg', bpAssess, 'vital_signs')}
      ${formatItem('Blood Glucose', vitals.sugar, 'mg/dL', sugarAssess, 'bloodtype')}
      ${formatItem('Heart Rate', vitals.hr, 'bpm', hrAssess, 'cardiology')}
    </div>
  `;
}
