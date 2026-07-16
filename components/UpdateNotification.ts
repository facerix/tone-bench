/**
 * UpdateNotification Web Component
 * Displays a notification when a service worker update is available
 * Uses Shadow DOM with encapsulated styles, matching the rest of the
 * TONEBENCH rack module theme (panel chrome + amber accent).
 */

import { h } from '/src/domUtils.js';
import { panelScrews, PANEL_CHROME_CSS } from '/components/styles/panelChrome.js';

const CSS = `
  ${PANEL_CHROME_CSS}

  :host {
    position: fixed;
    top: max(12px, env(safe-area-inset-top, 0px));
    right: max(12px, env(safe-area-inset-right, 0px));
    left: auto;
    z-index: 1000;
    display: none;
    max-width: min(300px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
    box-sizing: border-box;
  }

  @media (max-width: 360px) {
    :host {
      left: max(12px, env(safe-area-inset-left, 0px));
      right: max(12px, env(safe-area-inset-right, 0px));
      max-width: none;
    }
  }

  .update-notification {
    box-sizing: border-box;
    height: auto;
    box-shadow:
      0 8px 28px rgba(0, 0, 0, 0.5),
      0 0 20px var(--amber-glow);
  }

  .title {
    font-family: var(--font-display);
  }

  .message {
    margin: 0 0 14px;
    font-family: var(--font-body);
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .update-actions {
    display: flex;
    gap: 8px;
  }

  .update-actions.hidden {
    display: none;
  }

  .btn {
    flex: 1;
    font-family: var(--font-display);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: var(--panel-raised);
    color: var(--text);
    border: 1px solid var(--panel-line);
    border-radius: 3px;
    padding: 9px 12px;
    cursor: pointer;
    font-weight: 700;
  }

  .btn:hover:not(:disabled) {
    border-color: var(--amber-dim);
    color: var(--amber);
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.primary {
    color: var(--bg-deep);
    background: var(--amber);
    border-color: var(--amber);
  }

  .btn.primary:hover:not(:disabled) {
    color: var(--bg-deep);
    box-shadow: 0 0 12px var(--amber-glow);
  }

  .updating-state {
    display: none;
  }

  .updating-state.active {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .spinner {
    flex: none;
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--panel-line);
    border-top-color: var(--amber);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 1.6s;
    }
  }

  .update-status {
    margin: 0;
    font-family: var(--font-body);
    font-size: 11.5px;
    color: var(--text-muted);
  }
`;

class UpdateNotification extends HTMLElement {
  pendingWorker: ServiceWorker | null = null;
  isVisible = false;
  isUpdating = false;
  boundHandleUpdateNow: EventListener;
  boundHandleUpdateLater: EventListener;
  _updateProgressHandler: EventListener | null = null;

  constructor() {
    super();
    this.boundHandleUpdateNow = this.handleUpdateNow.bind(this) as EventListener;
    this.boundHandleUpdateLater = this.handleUpdateLater.bind(this) as EventListener;

    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    this.setupEventListeners();
  }

  disconnectedCallback(): void {
    this.cleanupEventListeners();
    if (this._updateProgressHandler) {
      window.removeEventListener('sw-update-progress', this._updateProgressHandler);
      this._updateProgressHandler = null;
    }
  }

  render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'update-notification panel' }, [
        ...panelScrews(),
        h('div', { className: 'module-label' }, [
          h('span', { className: 'label-text' }, [
            h('span', { className: 'dot' }),
            h('span', { className: 'title', innerText: 'Update Available' }),
          ]),
        ]),
        h('p', { className: 'message', innerText: 'A new version is ready.' }),
        h('div', { className: 'update-actions' }, [
          h('button', {
            type: 'button',
            className: 'btn primary update-now',
            innerText: 'Update Now',
          }),
          h('button', { type: 'button', className: 'btn update-later', innerText: 'Later' }),
        ]),
        h('div', { className: 'updating-state' }, [
          h('div', { className: 'spinner' }),
          h('p', {
            className: 'update-status',
            innerText: 'Please wait while we install the update.',
          }),
        ]),
      ])
    );
  }

  setupEventListeners(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const updateNowBtn = root.querySelector('.update-now');
    const updateLaterBtn = root.querySelector('.update-later');

    if (updateNowBtn) {
      updateNowBtn.addEventListener('click', this.boundHandleUpdateNow);
    }

    if (updateLaterBtn) {
      updateLaterBtn.addEventListener('click', this.boundHandleUpdateLater);
    }
  }

  cleanupEventListeners(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const updateNowBtn = root.querySelector('.update-now');
    const updateLaterBtn = root.querySelector('.update-later');

    if (updateNowBtn) {
      updateNowBtn.removeEventListener('click', this.boundHandleUpdateNow);
    }

    if (updateLaterBtn) {
      updateLaterBtn.removeEventListener('click', this.boundHandleUpdateLater);
    }
  }

  show(pendingWorker: ServiceWorker | null): void {
    this.pendingWorker = pendingWorker;
    const notification = this.shadowRoot?.querySelector<HTMLElement>('.update-notification');

    if (notification) {
      this.style.display = 'block';
      notification.style.display = 'block';
      this.isVisible = true;

      this.dispatchEvent(
        new CustomEvent('update-notification-shown', {
          detail: { pendingWorker },
          bubbles: true,
          composed: true,
        })
      );
    } else {
      console.error('[UpdateNotification] Could not find .update-notification element');
    }
  }

  hide(): void {
    const notification = this.shadowRoot?.querySelector<HTMLElement>('.update-notification');

    if (notification) {
      this.style.display = 'none';
      notification.style.display = 'none';
      this.isVisible = false;

      this.dispatchEvent(
        new CustomEvent('update-notification-hidden', {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  showUpdating(status: string = 'Please wait while we install the update.'): void {
    this.isUpdating = true;
    const root = this.shadowRoot;
    if (!root) return;
    const notification = root.querySelector<HTMLElement>('.update-notification');
    const actions = root.querySelector<HTMLElement>('.update-actions');
    const updatingState = root.querySelector<HTMLElement>('.updating-state');
    const statusText = root.querySelector<HTMLElement>('.update-status');
    const title = root.querySelector<HTMLElement>('.title');
    const message = root.querySelector<HTMLElement>('.message');

    if (notification && actions && updatingState) {
      actions.classList.add('hidden');
      updatingState.classList.add('active');
      if (statusText) {
        statusText.textContent = status;
      }
      if (title) {
        title.textContent = 'Updating...';
      }
      if (message) {
        message.style.display = 'none';
      }

      const buttons = root.querySelectorAll<HTMLButtonElement>('button');
      buttons.forEach(btn => {
        btn.disabled = true;
      });
    }
  }

  handleUpdateNow(): void {
    this.showUpdating('Activating new service worker...');

    this.dispatchEvent(
      new CustomEvent('update-accepted', {
        detail: { pendingWorker: this.pendingWorker },
        bubbles: true,
        composed: true,
      })
    );

    if (window.serviceWorkerManager && this.pendingWorker) {
      const handleUpdateProgress = (event: Event): void => {
        const customEvent = event as CustomEvent<{ status?: string }>;
        if (customEvent.detail && customEvent.detail.status) {
          this.showUpdating(customEvent.detail.status);
        }
      };

      this._updateProgressHandler = handleUpdateProgress;
      window.addEventListener('sw-update-progress', handleUpdateProgress);

      window.serviceWorkerManager.handleUpdateNow(this.pendingWorker).catch((error: unknown) => {
        console.error('[UpdateNotification] Update failed:', error);
        this.showUpdating('Update failed. Please try again.');
        this.isUpdating = false;
        const buttons = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('button');
        buttons?.forEach(btn => {
          btn.disabled = false;
        });
        if (this._updateProgressHandler) {
          window.removeEventListener('sw-update-progress', this._updateProgressHandler);
          this._updateProgressHandler = null;
        }
      });
    } else {
      console.error('[UpdateNotification] ServiceWorkerManager not available');
      this.hide();
    }
  }

  handleUpdateLater(): void {
    this.dispatchEvent(
      new CustomEvent('update-dismissed', {
        bubbles: true,
        composed: true,
      })
    );

    this.hide();
  }

  get visible(): boolean {
    return this.isVisible;
  }

  get pendingWorkerInstance(): ServiceWorker | null {
    return this.pendingWorker;
  }
}

customElements.define('update-notification', UpdateNotification);

declare global {
  interface HTMLElementTagNameMap {
    'update-notification': UpdateNotification;
  }
}

export default UpdateNotification;
