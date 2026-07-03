/**
 * EnvelopePanel Web Component
 *
 * The rack's ENVELOPE (ADSR) module: attack/decay/sustainLevel/sustainTime/
 * release, plus a read-only total-duration readout computed via the
 * engine's getDuration() — duration is derived, never stored separately.
 *
 * Set `params` to sync the panel's controls (does not re-emit). User
 * interaction emits:
 *   'params-change' — CustomEvent<{ patch: Partial<SynthParams>; commit: boolean }>
 */

import { h } from '/src/domUtils.js';
import '/components/RangeField.js';
import { panelScrews, moduleLabel, PANEL_CHROME_CSS } from '/components/styles/panelChrome.js';
import { fmtPct, fmtSecs } from '/components/synthFormat.js';
import { getDuration, type SynthParams } from '/src/engine/tonebenchEngine.js';

const CSS = `
  ${PANEL_CHROME_CSS}

  .duration-readout {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--panel-line);
    font-size: 10.5px;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    display: flex;
    justify-content: space-between;
  }
  .duration-readout .duration-value {
    color: var(--amber);
  }
`;

type EnvelopeKey = 'attack' | 'decay' | 'sustainLevel' | 'sustainTime' | 'release';

class EnvelopePanel extends HTMLElement {
  #params: SynthParams | null = null;
  #fields = new Map<EnvelopeKey, HTMLElementTagNameMap['range-field']>();
  #durationEl: HTMLSpanElement | null = null;
  // Local mirror of the 4 fields that feed the duration readout, kept
  // in sync on every drag tick so the readout updates live without a
  // round trip through index.ts (unlike the other panels, this readout
  // depends on multiple fields *within this same panel*).
  #adsr: Record<EnvelopeKey, number> = {
    attack: 0,
    decay: 0,
    sustainLevel: 0,
    sustainTime: 0,
    release: 0,
  };

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

    const attack = h('range-field', { label: 'Attack', min: '0', max: '1', step: '0.001' });
    const decay = h('range-field', { label: 'Decay', min: '0', max: '1', step: '0.001' });
    const sustainLevel = h('range-field', {
      label: 'Sustain Level',
      min: '0',
      max: '1',
      step: '0.01',
    });
    const sustainTime = h('range-field', {
      label: 'Sustain Time',
      min: '0',
      max: '1',
      step: '0.001',
    });
    const release = h('range-field', { label: 'Release', min: '0', max: '2', step: '0.001' });

    this.#fields.set('attack', attack);
    this.#fields.set('decay', decay);
    this.#fields.set('sustainLevel', sustainLevel);
    this.#fields.set('sustainTime', sustainTime);
    this.#fields.set('release', release);

    this.#bindSeconds(attack, 'attack', 3);
    this.#bindSeconds(decay, 'decay', 3);
    this.#bindPercent(sustainLevel, 'sustainLevel');
    this.#bindSeconds(sustainTime, 'sustainTime', 3);
    this.#bindSeconds(release, 'release', 3);

    this.#durationEl = h('span', { className: 'duration-value', innerText: '0.000 s' });

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'panel' }, [
        ...panelScrews(),
        moduleLabel('ENVELOPE (ADSR)'),
        attack,
        decay,
        sustainLevel,
        sustainTime,
        release,
        h('div', { className: 'duration-readout' }, [
          h('span', { innerText: 'TOTAL DURATION' }),
          this.#durationEl,
        ]),
      ])
    );
  }

  #bindSeconds(
    field: HTMLElementTagNameMap['range-field'],
    key: EnvelopeKey,
    decimals: number
  ): void {
    const onEvent = (raw: number, commit: boolean): void => {
      field.display = fmtSecs(raw, decimals);
      this.#adsr[key] = raw;
      this.#refreshDuration();
      this.#emit({ [key]: raw } as Partial<SynthParams>, commit);
    };
    field.addEventListener('range-input', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, false)
    );
    field.addEventListener('range-change', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, true)
    );
  }

  #bindPercent(field: HTMLElementTagNameMap['range-field'], key: EnvelopeKey): void {
    const onEvent = (raw: number, commit: boolean): void => {
      field.display = fmtPct(raw);
      this.#adsr[key] = raw;
      this.#emit({ [key]: raw } as Partial<SynthParams>, commit);
    };
    field.addEventListener('range-input', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, false)
    );
    field.addEventListener('range-change', e =>
      onEvent((e as CustomEvent<{ value: number }>).detail.value, true)
    );
  }

  #refreshDuration(): void {
    if (!this.#durationEl) return;
    const { attack, decay, sustainTime, release } = this.#adsr;
    this.#durationEl.textContent = fmtSecs(attack + decay + sustainTime + release, 3);
  }

  #emit(patch: Partial<SynthParams>, commit: boolean): void {
    this.dispatchEvent(
      new CustomEvent('params-change', { detail: { patch, commit }, bubbles: true, composed: true })
    );
  }

  set params(p: SynthParams) {
    this.#params = p;
    this.#adsr = {
      attack: p.attack,
      decay: p.decay,
      sustainLevel: p.sustainLevel,
      sustainTime: p.sustainTime,
      release: p.release,
    };
    this.#fields.get('attack')!.value = p.attack;
    this.#fields.get('attack')!.display = fmtSecs(p.attack, 3);
    this.#fields.get('decay')!.value = p.decay;
    this.#fields.get('decay')!.display = fmtSecs(p.decay, 3);
    this.#fields.get('sustainLevel')!.value = p.sustainLevel;
    this.#fields.get('sustainLevel')!.display = fmtPct(p.sustainLevel);
    this.#fields.get('sustainTime')!.value = p.sustainTime;
    this.#fields.get('sustainTime')!.display = fmtSecs(p.sustainTime, 3);
    this.#fields.get('release')!.value = p.release;
    this.#fields.get('release')!.display = fmtSecs(p.release, 3);
    if (this.#durationEl) this.#durationEl.textContent = fmtSecs(getDuration(p), 3);
  }

  get params(): SynthParams | null {
    return this.#params;
  }
}

customElements.define('envelope-panel', EnvelopePanel);

declare global {
  interface HTMLElementTagNameMap {
    'envelope-panel': EnvelopePanel;
  }
}

export default EnvelopePanel;
