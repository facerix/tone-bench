/**
 * WaveToggle Web Component
 *
 * A 5-button toggle group over the engine's WAVE_TYPES. Property `value`
 * sets which button is active; clicking a button emits 'wave-change' and
 * updates the active state itself (callers should still set `value` when
 * params change from elsewhere, e.g. loading a preset).
 *
 * Emits 'wave-change' — CustomEvent<{ value: WaveType }>
 */

import { h } from '/src/domUtils.js';
import { WAVE_TYPES, type WaveType } from '/src/engine/tonebenchEngine.js';

const CSS = `
  .wave-toggle {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(68px, 1fr));
    gap: 6px;
    margin-bottom: 14px;
    min-width: 0;
  }
  .wave-btn {
    font-family: var(--font-display);
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 9px 4px;
    background: var(--panel-raised);
    color: var(--text-muted);
    border: 1px solid var(--panel-line);
    border-radius: 3px;
    cursor: pointer;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wave-btn.active {
    color: var(--bg-deep);
    background: var(--amber);
    border-color: var(--amber);
    font-weight: 700;
  }
  .wave-btn:hover:not(.active) {
    color: var(--amber);
    border-color: var(--amber-dim);
  }
`;

class WaveToggle extends HTMLElement {
  #value: WaveType = 'sine';
  #buttons: HTMLButtonElement[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.#render();
  }

  #render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    this.#buttons = WAVE_TYPES.map(wave => {
      const btn = h('button', {
        type: 'button',
        className: `wave-btn${wave === this.#value ? ' active' : ''}`,
        innerText: wave,
        dataset: { wave },
      }) as HTMLButtonElement;
      btn.addEventListener('click', () => this.#select(wave));
      return btn;
    });

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'wave-toggle' }, this.#buttons)
    );
  }

  #select(wave: WaveType): void {
    this.value = wave;
    this.dispatchEvent(
      new CustomEvent('wave-change', { detail: { value: wave }, bubbles: true, composed: true })
    );
  }

  set value(wave: WaveType) {
    this.#value = wave;
    this.#buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.wave === wave);
    });
  }

  get value(): WaveType {
    return this.#value;
  }
}

customElements.define('wave-toggle', WaveToggle);

declare global {
  interface HTMLElementTagNameMap {
    'wave-toggle': WaveToggle;
  }
}

export default WaveToggle;
