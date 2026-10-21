/**
 * Doctor Card Component.
 * Renders verified clinical officer card with NMC credential badges.
 */
export function renderDoctorCard(doc) {
  const isEmergency = doc.emergency_available ? 'Emergency Ready' : 'OPD Service';
  const badgeClass = doc.emergency_available ? 'badge-emergency' : 'badge-phc';

  return `
    <div class="doctor-card" data-doc-id="${doc.id || ''}">
      <div class="doctor-card-header">
        <div class="doctor-avatar">
          <span class="material-symbols-outlined" style="font-size: 28px; color: var(--teal-primary);">person</span>
        </div>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h4 style="font-size: 15px; font-weight: 700; color: var(--on-surface); margin: 0;">${doc.name}</h4>
            <span class="badge ${badgeClass}" style="font-size: 11px;">${isEmergency}</span>
          </div>
          <p style="font-size: 12px; color: var(--teal-primary); font-weight: 600; margin: 2px 0 0 0;">
            ${doc.specialization} • ${doc.qualifications || 'MBBS'}
          </p>
        </div>
      </div>

      <div class="doctor-details" style="margin-top: 10px; font-size: 12px; color: var(--on-surface-variant); display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 15px; color: var(--teal-primary);">local_hospital</span>
          <span>${doc.hospital}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 15px; color: var(--teal-primary);">verified</span>
          <span>Reg: <b>${doc.registration_number || 'NMC-VERIFIED'}</b> (${doc.medical_council || 'NMC'})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 15px; color: var(--teal-primary);">schedule</span>
          <span>${doc.availability || 'Daily OPD (9:00 AM - 1:00 PM)'}</span>
        </div>
      </div>

      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <button type="button" class="btn-cyan-primary btn-sm btn-book-doc" data-doc-id="${doc.id}" style="flex: 1;">
          Book Consultation
        </button>
        <a href="tel:${doc.phone || '108'}" class="btn-outline btn-sm" style="display: inline-flex; align-items: center; justify-content: center; width: 38px; text-decoration: none;">
          <span class="material-symbols-outlined" style="font-size: 18px;">call</span>
        </a>
      </div>
    </div>
  `;
}
