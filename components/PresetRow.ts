/**
 * PresetRow Web Component
 *
 * Renders a button per built-in preset from src/presets.ts. These are the
 * fixed, hardcoded prototype presets — not user sound sets (see CLAUDE.md's
 * "Presets vs. sound sets" section).
 *
 * Emits 'preset-select' — CustomEvent<{ name: string; params: SynthParams }>
 */

import { h } from '/src/domUtils.js';
import { PRESETS } from '/src/presets.js';

const CSS = `
  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .btn {
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
    transition:
      border-color 0.12s,
      color 0.12s,
      box-shadow 0.12s;
  }
  .btn:hover {
    border-color: var(--amber-dim);
    color: var(--amber);
  }
  .btn:active {
    transform: translateY(1px);
  }
`;

class PresetRow extends HTMLElement {
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

    const buttons = Object.entries(PRESETS).map(([name, params]) => {
      const btn = h('button', { type: 'button', className: 'btn', innerText: name });
      btn.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('preset-select', {
            detail: { name, params },
            bubbles: true,
            composed: true,
          })
        );
      });
      return btn;
    });

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'preset-row' }, buttons)
    );
  }
}

customElements.define('preset-row', PresetRow);

declare global {
  interface HTMLElementTagNameMap {
    'preset-row': PresetRow;
  }
}

export default PresetRow;
