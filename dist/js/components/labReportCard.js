/**
 * Lab Report Item Card Component.
 * Displays laboratory test parameter, observed value, reference range,
 * and a visual comparison track.
 */
export function renderLabItemCard(item) {
  const status = (item.status || 'NORMAL').toUpperCase();
  let statusBadge = 'Normal';
  let badgeColor = 'var(--teal-primary, #0f766e)';
  let badgeBg = 'rgba(15, 118, 110, 0.1)';

  if (status === 'HIGH') {
    statusBadge = 'High';
    badgeColor = 'var(--error, #dc2626)';
    badgeBg = 'rgba(220, 38, 38, 0.1)';
  } else if (status === 'LOW') {
    statusBadge = 'Low';
    badgeColor = 'var(--warning, #d97706)';
    badgeBg = 'rgba(217, 119, 6, 0.1)';
  }

  const observed = item.value !== null && item.value !== undefined ? item.value : '—';
  const unit = item.unit || '';
  const rangeStr = item.ref_range ? `${item.ref_range.min} – ${item.ref_range.max} ${unit}` : 'Printed range on report';

  return `
    <div class="lab-item-card" style="background: var(--surface); border: 1px solid var(--outline-variant); border-radius: 12px; padding: 14px; margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h4 style="font-size: 14px; font-weight: 700; color: var(--on-surface); margin: 0;">${item.name}</h4>
          <span style="font-size: 11px; color: var(--on-surface-variant);">Ref: ${rangeStr}</span>
        </div>
        <span style="font-size: 11px; font-weight: 700; color: ${badgeColor}; background: ${badgeBg}; padding: 3px 8px; border-radius: 6px;">
          ${statusBadge}
        </span>
      </div>

      <div style="margin-top: 10px; display: flex; align-items: baseline; gap: 6px;">
        <span style="font-size: 20px; font-weight: 800; color: var(--on-surface);">${observed}</span>
        <span style="font-size: 12px; color: var(--on-surface-variant); font-weight: 600;">${unit}</span>
      </div>

      <div class="range-track" style="margin-top: 8px; height: 6px; background: rgba(0,0,0,0.06); border-radius: 3px; position: relative; overflow: hidden;">
        <div style="position: absolute; left: 20%; right: 20%; top: 0; bottom: 0; background: rgba(15,118,110,0.25);"></div>
        ${
          status === 'HIGH'
            ? '<div style="position: absolute; right: 0; width: 18%; top: 0; bottom: 0; background: var(--error);"></div>'
            : status === 'LOW'
            ? '<div style="position: absolute; left: 0; width: 18%; top: 0; bottom: 0; background: var(--warning, #d97706);"></div>'
            : '<div style="position: absolute; left: 40%; width: 20%; top: 0; bottom: 0; background: var(--teal-primary);"></div>'
        }
      </div>
    </div>
  `;
}
