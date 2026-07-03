/**
 * SourcePanel Web Component
 *
 * The rack's SOURCE module: waveform toggle + start/end frequency + volume.
 * Frequency fields are backed by a 0-100 log-scale slider per
 * sliderToFreq/freqToSlider — never linear (see CLAUDE.md).
 *
 * Set `params` to sync the panel's controls from the current SynthParams
 * (does not re-emit). User interaction emits:
 *   'params-change' — CustomEvent<{ patch: Partial<SynthParams>; commit: boolean }>
 */

import { h } from '/src/domUtils.js';
import '/components/RangeField.js';
import '/components/WaveToggle.js';
import { panelScrews, moduleLabel, PANEL_CHROME_CSS } from '/components/styles/panelChrome.js';
import { fmtHz, fmtPct } from '/components/synthFormat.js';
import {
  FREQ_MIN,
  FREQ_MAX,
  sliderToFreq,
  freqToSlider,
  type SynthParams,
  type WaveType,
} from '/src/engine/tonebenchEngine.js';

const CSS = PANEL_CHROME_CSS;

class SourcePanel extends HTMLElement {
  #params: SynthParams | null = null;
  #waveToggle: HTMLElementTagNameMap['wave-toggle'] | null = null;
  #freqStart: HTMLElementTagNameMap['range-field'] | null = null;
  #freqEnd: HTMLElementTagNameMap['range-field'] | null = null;
  #volume: HTMLElementTagNameMap['range-field'] | null = null;

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

    this.#waveToggle = h('wave-toggle', {});
    this.#waveToggle.addEventListener('wave-change', e => {
      const { value } = (e as CustomEvent<{ value: WaveType }>).detail;
      this.#emit({ waveType: value }, true);
    });

    this.#freqStart = h('range-field', { label: 'Start Freq', min: '0', max: '100', step: '0.1' });
    this.#freqEnd = h('range-field', { label: 'End Freq', min: '0', max: '100', step: '0.1' });
    this.#bindFreqField(this.#freqStart, 'freqStart');
    this.#bindFreqField(this.#freqEnd, 'freqEnd');

    this.#volume = h('range-field', { label: 'Volume', min: '0', max: '1', step: '0.01' });
    this.#bindVolumeField(this.#volume);

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'panel' }, [
        ...panelScrews(),
        moduleLabel('SOURCE'),
        this.#waveToggle,
        this.#freqStart,
        this.#freqEnd,
        this.#volume,
      ])
    );
  }

  #bindFreqField(field: HTMLElementTagNameMap['range-field'], key: 'freqStart' | 'freqEnd'): void {
    const onEvent = (raw: number, commit: boolean): void => {
      const hz = sliderToFreq(raw, FREQ_MIN, FREQ_MAX);
      field.display = fmtHz(hz);
      this.#emit({ [key]: hz } as Partial<SynthParams>, commit);
    };
    field.addEventListener('range-input', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, false)
    );
    field.addEventListener('range-change', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, true)
    );
  }

  #bindVolumeField(field: HTMLElementTagNameMap['range-field']): void {
    const onEvent = (raw: number, commit: boolean): void => {
      field.display = fmtPct(raw);
      this.#emit({ volume: raw }, commit);
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
    if (this.#waveToggle) this.#waveToggle.value = p.waveType;
    if (this.#freqStart) {
      this.#freqStart.value = freqToSlider(p.freqStart, FREQ_MIN, FREQ_MAX);
      this.#freqStart.display = fmtHz(p.freqStart);
    }
    if (this.#freqEnd) {
      this.#freqEnd.value = freqToSlider(p.freqEnd, FREQ_MIN, FREQ_MAX);
      this.#freqEnd.display = fmtHz(p.freqEnd);
    }
    if (this.#volume) {
      this.#volume.value = p.volume;
      this.#volume.display = fmtPct(p.volume);
    }
  }

  get params(): SynthParams | null {
    return this.#params;
  }
}

customElements.define('source-panel', SourcePanel);

declare global {
  interface HTMLElementTagNameMap {
    'source-panel': SourcePanel;
  }
}

export default SourcePanel;
