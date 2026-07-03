/**
 * SpacePanel Web Component
 *
 * The rack's SPACE module: reverb decay/mix + delay time/feedback/mix.
 *
 * Set `params` to sync the panel's controls (does not re-emit). User
 * interaction emits:
 *   'params-change' — CustomEvent<{ patch: Partial<SynthParams>; commit: boolean }>
 */

import { h } from '/src/domUtils.js';
import '/components/RangeField.js';
import { panelScrews, moduleLabel, PANEL_CHROME_CSS } from '/components/styles/panelChrome.js';
import { fmtPct, fmtSecs } from '/components/synthFormat.js';
import type { SynthParams } from '/src/engine/tonebenchEngine.js';

const CSS = PANEL_CHROME_CSS;

type SpaceKey = 'reverbDecay' | 'reverbMix' | 'delayTime' | 'delayFeedback' | 'delayMix';

class SpacePanel extends HTMLElement {
  #params: SynthParams | null = null;
  #fields = new Map<SpaceKey, HTMLElementTagNameMap['range-field']>();

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

    const reverbDecay = h('range-field', {
      label: 'Reverb Decay',
      min: '0.1',
      max: '4',
      step: '0.05',
    });
    const reverbMix = h('range-field', { label: 'Reverb Mix', min: '0', max: '1', step: '0.01' });
    const delayTime = h('range-field', { label: 'Delay Time', min: '0', max: '1', step: '0.005' });
    const delayFeedback = h('range-field', {
      label: 'Delay Feedback',
      min: '0',
      max: '0.9',
      step: '0.01',
    });
    const delayMix = h('range-field', { label: 'Delay Mix', min: '0', max: '1', step: '0.01' });

    this.#fields.set('reverbDecay', reverbDecay);
    this.#fields.set('reverbMix', reverbMix);
    this.#fields.set('delayTime', delayTime);
    this.#fields.set('delayFeedback', delayFeedback);
    this.#fields.set('delayMix', delayMix);

    this.#bindSeconds(reverbDecay, 'reverbDecay', 2);
    this.#bindPercent(reverbMix, 'reverbMix');
    this.#bindSeconds(delayTime, 'delayTime', 3);
    this.#bindPercent(delayFeedback, 'delayFeedback');
    this.#bindPercent(delayMix, 'delayMix');

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'panel' }, [
        ...panelScrews(),
        moduleLabel('SPACE'),
        reverbDecay,
        reverbMix,
        delayTime,
        delayFeedback,
        delayMix,
      ])
    );
  }

  #bindSeconds(field: HTMLElementTagNameMap['range-field'], key: SpaceKey, decimals: number): void {
    const onEvent = (raw: number, commit: boolean): void => {
      field.display = fmtSecs(raw, decimals);
      this.#emit({ [key]: raw } as Partial<SynthParams>, commit);
    };
    field.addEventListener('range-input', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, false)
    );
    field.addEventListener('range-change', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, true)
    );
  }

  #bindPercent(field: HTMLElementTagNameMap['range-field'], key: SpaceKey): void {
    const onEvent = (raw: number, commit: boolean): void => {
      field.display = fmtPct(raw);
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
    this.#fields.get('reverbDecay')!.value = p.reverbDecay;
    this.#fields.get('reverbDecay')!.display = fmtSecs(p.reverbDecay, 2);
    this.#fields.get('reverbMix')!.value = p.reverbMix;
    this.#fields.get('reverbMix')!.display = fmtPct(p.reverbMix);
    this.#fields.get('delayTime')!.value = p.delayTime;
    this.#fields.get('delayTime')!.display = fmtSecs(p.delayTime, 3);
    this.#fields.get('delayFeedback')!.value = p.delayFeedback;
    this.#fields.get('delayFeedback')!.display = fmtPct(p.delayFeedback);
    this.#fields.get('delayMix')!.value = p.delayMix;
    this.#fields.get('delayMix')!.display = fmtPct(p.delayMix);
  }

  get params(): SynthParams | null {
    return this.#params;
  }
}

customElements.define('space-panel', SpacePanel);

declare global {
  interface HTMLElementTagNameMap {
    'space-panel': SpacePanel;
  }
}

export default SpacePanel;
