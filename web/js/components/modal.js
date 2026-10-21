/**
 * Accessible Modal Manager Component.
 * Provides unified dialog open/close lifecycle, escape key listeners,
 * and focus management.
 */
export class ModalManager {
  static _activeModals = new Set();
  static _isInitialized = false;

  static _initGlobalListeners() {
    if (this._isInitialized) return;
    this._isInitialized = true;

    // Close topmost modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._activeModals.size > 0) {
        const lastModalId = Array.from(this._activeModals).pop();
        this.close(lastModalId);
      }
    });
  }

  /**
   * Open modal dialog by ID.
   */
  static open(modalId) {
    this._initGlobalListeners();
    const modalEl = document.getElementById(modalId);
    if (!modalEl) {
      console.warn(`Modal element '#${modalId}' not found.`);
      return;
    }

    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');
    this._activeModals.add(modalId);

    // Prevent body scroll on mobile
    document.body.classList.add('modal-open');
  }

  /**
   * Close modal dialog by ID.
   */
  static close(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      modalEl.classList.add('hidden');
      modalEl.setAttribute('aria-hidden', 'true');
    }
    this._activeModals.delete(modalId);

    if (this._activeModals.size === 0) {
      document.body.classList.remove('modal-open');
    }
  }

  /**
   * Bind open trigger button and close buttons for a given modal.
   */
  static bind(modalId, triggerSelector, closeSelectors = []) {
    if (triggerSelector) {
      const trigger = document.querySelector(triggerSelector);
      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          this.open(modalId);
        });
      }
    }

    closeSelectors.forEach((sel) => {
      const closeButtons = document.querySelectorAll(sel);
      closeButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.close(modalId);
        });
      });
    });

    // Close when clicking modal backdrop
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
          this.close(modalId);
        }
      });
    }
  }
}
