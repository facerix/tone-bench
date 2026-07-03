/**
 * RangeField Web Component
 *
 * A single labeled slider row: label + live formatted value + a native
 * `<input type="range">`. Purely presentational — it knows nothing about
 * SynthParams or frequency mapping. Every knob is a plain property (not an
 * HTML attribute), because these are always constructed via `h()`, which
 * configures elements by assigning JS properties, not by calling
 * `setAttribute`. Set `label`/`min`/`max`/`step` once at creation, then
 * drive `value` (the raw slider number) and `display` (the formatted
 * readout text, e.g. "440 Hz") as the params change.
 *
 * Emits:
 *   'range-input'  — CustomEvent<{ value: number }> on every drag tick (live preview)
 *   'range-change' — CustomEvent<{ value: number }> on release/commit
 */

import { h } from '/src/domUtils.js';
import { PANEL_CHROME_CSS } from '/components/styles/panelChrome.js';

const CSS = `
  ${PANEL_CHROME_CSS}

  .field {
    margin-bottom: 14px;
  }
  .field-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 5px;
  }
  .field-label {
    font-size: 10.5px;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .field-value {
    font-size: 11px;
    color: var(--amber);
    font-variant-numeric: tabular-nums;
  }

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--panel-line);
    outline: none;
    margin: 8px 0 2px;
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--amber);
    border: 2px solid var(--bg-deep);
    box-shadow: 0 0 6px var(--amber-glow);
    cursor: pointer;
    margin-top: -1px;
  }
  input[type='range']::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--amber);
    border: 2px solid var(--bg-deep);
    box-shadow: 0 0 6px var(--amber-glow);
    cursor: pointer;
  }
  input[type='range']:focus-visible::-webkit-slider-thumb {
    outline: 2px solid var(--green);
    outline-offset: 2px;
  }
`;

class RangeField extends HTMLElement {
  #input: HTMLInputElement | null = null;
  #labelEl: HTMLSpanElement | null = null;
  #valueEl: HTMLSpanElement | null = null;

  #label = '';
  #min = '0';
  #max = '100';
  #step = '1';
  #value = 0;
  #display = '';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    if (this.shadowRoot?.childElementCount) return;
    this.#render();
  }

  #render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    this.#labelEl = h('span', { className: 'field-label', innerText: this.#label });
    this.#valueEl = h('span', { className: 'field-value', innerText: this.#display });
    this.#input = h('input', {
      type: 'range',
      min: this.#min,
      max: this.#max,
      step: this.#step,
      value: String(this.#value),
    }) as HTMLInputElement;
    this.#input.addEventListener('input', () => this.#emit('range-input'));
    this.#input.addEventListener('change', () => this.#emit('range-change'));

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'field' }, [
        h('div', { className: 'field-row' }, [this.#labelEl, this.#valueEl]),
        this.#input,
      ])
    );
  }

  #emit(name: 'range-input' | 'range-change'): void {
    if (!this.#input) return;
    this.#value = parseFloat(this.#input.value);
    this.dispatchEvent(
      new CustomEvent(name, { detail: { value: this.#value }, bubbles: true, composed: true })
    );
  }

  set label(text: string) {
    this.#label = text;
    if (this.#labelEl) this.#labelEl.textContent = text;
  }

  get label(): string {
    return this.#label;
  }

  set min(v: string) {
    this.#min = v;
    this.#input?.setAttribute('min', v);
  }

  get min(): string {
    return this.#min;
  }

  set max(v: string) {
    this.#max = v;
    this.#input?.setAttribute('max', v);
  }

  get max(): string {
    return this.#max;
  }

  set step(v: string) {
    this.#step = v;
    this.#input?.setAttribute('step', v);
  }

  get step(): string {
    return this.#step;
  }

  set value(v: number) {
    this.#value = v;
    if (this.#input) this.#input.value = String(v);
  }

  get value(): number {
    return this.#value;
  }

  set display(text: string) {
    this.#display = text;
    if (this.#valueEl) this.#valueEl.textContent = text;
  }

  get display(): string {
    return this.#display;
  }
}

customElements.define('range-field', RangeField);

declare global {
  interface HTMLElementTagNameMap {
    'range-field': RangeField;
  }
}

export default RangeField;
