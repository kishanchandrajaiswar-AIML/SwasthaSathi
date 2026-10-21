/**
 * Toast Notification Component.
 * Displays accessible floating toast alerts for errors, warnings, and confirmations.
 */
export class Toast {
  static _container = null;

  static _ensureContainer() {
    if (!this._container) {
      this._container = document.getElementById('toastContainer');
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.id = 'toastContainer';
        this._container.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        `;
        document.body.appendChild(this._container);
      }
    }
  }

  /**
   * Display a floating toast message.
   * @param {string} message - Notification text.
   * @param {'info'|'success'|'warning'|'error'} type - Style variant.
   * @param {number} durationMs - Auto-dismiss timeout.
   */
  static show(message, type = 'info', durationMs = 3500) {
    this._ensureContainer();

    const toast = document.createElement('div');
    toast.className = `swastha-toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    let icon = 'info';
    let bgColor = '#0f766e';
    if (type === 'error') {
      icon = 'error';
      bgColor = '#dc2626';
    } else if (type === 'warning') {
      icon = 'warning';
      bgColor = '#d97706';
    } else if (type === 'success') {
      icon = 'check_circle';
      bgColor = '#16a34a';
    }

    toast.style.cssText = `
      pointer-events: auto;
      background: ${bgColor};
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: fadeIn 0.25s ease-out;
      max-width: 380px;
    `;

    toast.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 18px;">${icon}</span>
      <span style="flex: 1; line-height: 1.4;">${message}</span>
    `;

    this._container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, durationMs);
  }

  static success(msg) {
    this.show(msg, 'success');
  }

  static error(msg) {
    this.show(msg, 'error', 4500);
  }

  static warning(msg) {
    this.show(msg, 'warning');
  }

  static info(msg) {
    this.show(msg, 'info');
  }
}
