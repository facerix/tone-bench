/**
 * FilterPanel Web Component
 *
 * The rack's FILTER module: filter type select + cutoff (log-scale slider
 * per CUTOFF_MIN/MAX, never linear) + resonance (Q) + distortion amount.
 *
 * Set `params` to sync the panel's controls (does not re-emit). User
 * interaction emits:
 *   'params-change' — CustomEvent<{ patch: Partial<SynthParams>; commit: boolean }>
 */

import { h } from '/src/domUtils.js';
import '/components/RangeField.js';
import { panelScrews, moduleLabel, PANEL_CHROME_CSS } from '/components/styles/panelChrome.js';
import { fmtHz, fmtQ, fmtCount } from '/components/synthFormat.js';
import {
  CUTOFF_MIN,
  CUTOFF_MAX,
  sliderToFreq,
  freqToSlider,
  type SynthParams,
  type FilterType,
} from '/src/engine/tonebenchEngine.js';

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'none', label: 'None (bypass)' },
  { value: 'lowpass', label: 'Lowpass' },
  { value: 'highpass', label: 'Highpass' },
  { value: 'bandpass', label: 'Bandpass' },
];

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

  select {
    width: 100%;
    font-family: var(--font-body);
    font-size: 12px;
    background: var(--panel-raised);
    color: var(--text);
    border: 1px solid var(--panel-line);
    border-radius: 3px;
    padding: 8px;
    cursor: pointer;
  }
  select:focus-visible {
    outline: 2px solid var(--green);
  }
`;

class FilterPanel extends HTMLElement {
  #params: SynthParams | null = null;
  #select: HTMLSelectElement | null = null;
  #cutoff: HTMLElementTagNameMap['range-field'] | null = null;
  #q: HTMLElementTagNameMap['range-field'] | null = null;
  #distortion: HTMLElementTagNameMap['range-field'] | null = null;

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

    this.#select = h(
      'select',
      {},
      FILTER_TYPES.map(({ value, label }) => h('option', { value, innerText: label }))
    );
    this.#select.addEventListener('change', () => {
      this.#emit({ filterType: this.#select!.value as FilterType }, true);
    });

    this.#cutoff = h('range-field', { label: 'Cutoff', min: '0', max: '100', step: '0.1' });
    this.#bindCutoff(this.#cutoff);

    this.#q = h('range-field', { label: 'Resonance (Q)', min: '0.1', max: '20', step: '0.1' });
    this.#bindDirect(this.#q, 'filterQ', fmtQ);

    this.#distortion = h('range-field', { label: 'Distortion', min: '0', max: '100', step: '1' });
    this.#bindDirect(this.#distortion, 'distortion', fmtCount);

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'panel' }, [
        ...panelScrews(),
        moduleLabel('FILTER'),
        h('div', { className: 'field' }, [
          h('div', { className: 'field-row' }, [
            h('span', { className: 'field-label', innerText: 'Type' }),
          ]),
          this.#select,
        ]),
        this.#cutoff,
        this.#q,
        this.#distortion,
      ])
    );
  }

  #bindCutoff(field: HTMLElementTagNameMap['range-field']): void {
    const onEvent = (raw: number, commit: boolean): void => {
      const hz = sliderToFreq(raw, CUTOFF_MIN, CUTOFF_MAX);
      field.display = fmtHz(hz);
      this.#emit({ filterCutoff: hz }, commit);
    };
    field.addEventListener('range-input', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, false)
    );
    field.addEventListener('range-change', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, true)
    );
  }

  #bindDirect(
    field: HTMLElementTagNameMap['range-field'],
    key: 'filterQ' | 'distortion',
    format: (n: number) => string
  ): void {
    const onEvent = (raw: number, commit: boolean): void => {
      field.display = format(raw);
      this.#emit({ [key]: raw } as Partial<SynthParams>, commit);
    };
    field.addEventListener('range-input', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, false)
    );
    field.addEventListener('range-change', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, true)
    );
  }

  #emit(patch: Partial<SynthParams>, commit: boolean): void {
    this.dispatchEvent(
      new CustomEvent('params-change', { detail: { patch, commit }, bubbles: true, composed: true })
    );
  }

  set params(p: SynthParams) {
    this.#params = p;
    if (this.#select) this.#select.value = p.filterType;
    if (this.#cutoff) {
      this.#cutoff.value = freqToSlider(p.filterCutoff, CUTOFF_MIN, CUTOFF_MAX);
      this.#cutoff.display = fmtHz(p.filterCutoff);
    }
    if (this.#q) {
      this.#q.value = p.filterQ;
      this.#q.display = fmtQ(p.filterQ);
    }
    if (this.#distortion) {
      this.#distortion.value = p.distortion;
      this.#distortion.display = fmtCount(p.distortion);
    }
  }

  get params(): SynthParams | null {
    return this.#params;
  }
}

customElements.define('filter-panel', FilterPanel);

declare global {
  interface HTMLElementTagNameMap {
    'filter-panel': FilterPanel;
  }
}

export default FilterPanel;
