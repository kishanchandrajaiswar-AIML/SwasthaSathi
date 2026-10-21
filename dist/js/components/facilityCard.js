/**
 * Facility Card Component.
 * Renders verified health facility (PHC, CHC, Hospital) with calculated GPS distance.
 */
export function renderFacilityCard(fac) {
  const isEmergency = fac.emergency_available ? '24/7 Emergency' : 'OPD Only';
  const badgeClass = fac.emergency_available ? 'badge-emergency' : 'badge-phc';
  const distance = fac.distance_km ? `${fac.distance_km.toFixed(1)} km` : 'Near you';

  return `
    <div class="facility-card" data-fac-id="${fac.id || ''}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span class="badge ${badgeClass}" style="margin-bottom: 6px; font-size: 11px;">
            ${fac.type || 'Primary Health Centre'} • ${isEmergency}
          </span>
          <h4 style="font-size: 15px; font-weight: 700; color: var(--on-surface); margin: 0;">${fac.name}</h4>
          <p style="font-size: 12px; color: var(--on-surface-variant); margin: 4px 0 0 0;">${fac.address || fac.block || 'Local Area'}</p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 13px; font-weight: 700; color: var(--teal-primary);">${distance}</span>
        </div>
      </div>

      <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;">
        ${(fac.services || ['General OPD', 'Vaccination'])
          .slice(0, 3)
          .map((s) => `<span class="service-pill" style="font-size: 11px; padding: 2px 8px; background: rgba(15,118,110,0.08); border-radius: 6px; color: var(--teal-primary);">${s}</span>`)
          .join('')}
      </div>

      <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--outline-variant); padding-top: 8px;">
        <span style="font-size: 12px; color: var(--on-surface-variant);">
          <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">schedule</span> ${fac.hours || 'Daily OPD (9:00 AM - 1:00 PM)'}
        </span>
        <a href="tel:${fac.phone || '108'}" class="btn-cyan-primary btn-sm" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
          <span class="material-symbols-outlined" style="font-size: 15px;">call</span> Call
        </a>
      </div>
    </div>
  `;
}
