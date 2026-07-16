/**
 * OscilloscopePanel Web Component
 *
 * The rack's OSCILLOSCOPE module: a live waveform trace read from an
 * `AnalyserNode`, a trigger pad, and an export-WAV button. This component
 * owns the canvas draw loop only — it does not own the AudioContext or
 * AnalyserNode (index.ts creates those lazily on first trigger, matching
 * the prototype's suspended-until-first-interaction behavior) and does not
 * know how to synthesize or export audio; it just asks the parent to.
 *
 * Set `analyser` once the AudioContext exists. Emits:
 *   'trigger-request' — user pressed the trigger pad
 *   'export-request'  — user pressed "Export WAV"
 *   'code-out-request' — user pressed "Code Out"
 */

import { h } from '/src/domUtils.js';
import { panelScrews, moduleLabel, PANEL_CHROME_CSS } from '/components/styles/panelChrome.js';

const CSS = `
  ${PANEL_CHROME_CSS}

  .scope-wrap {
    background: #0d0b08;
    border: 1px solid var(--panel-line);
    border-radius: 3px;
    position: relative;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 170px;
  }
  .scope-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.025) 0px,
      rgba(255, 255, 255, 0.025) 1px,
      transparent 1px,
      transparent 3px
    );
  }

  .trigger-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
    align-items: stretch;
  }
  .trigger-pad {
    flex: 1;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.12em;
    background: linear-gradient(180deg, #2a2116, #1c1710);
    color: var(--amber);
    border: 1px solid var(--amber-dim);
    border-radius: 4px;
    padding: 14px;
    cursor: pointer;
    text-transform: uppercase;
    transition:
      box-shadow 0.08s,
      transform 0.05s,
      background 0.08s;
  }
  .trigger-pad:hover {
    box-shadow: 0 0 16px var(--amber-glow);
  }
  .trigger-pad:active {
    transform: translateY(1px);
    background: #332616;
  }
  .trigger-pad.flash {
    box-shadow:
      0 0 26px var(--amber-glow),
      inset 0 0 20px rgba(255, 176, 32, 0.25);
  }
  .btn-secondary {
    flex: 0 0 auto;
    font-family: var(--font-display);
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    background: var(--panel-raised);
    border: 1px solid var(--panel-line);
    border-radius: 4px;
    padding: 14px 16px;
    cursor: pointer;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .btn-secondary:hover {
    color: var(--text);
    border-color: var(--amber-dim);
  }
  @media (max-width: 560px) {
    .trigger-pad,
    .btn-secondary {
      flex: 1 1 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .trigger-pad {
      transition: none;
    }
  }
`;

class OscilloscopePanel extends HTMLElement {
  #analyser: AnalyserNode | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #canvasCtx: CanvasRenderingContext2D | null = null;
  #triggerPad: HTMLButtonElement | null = null;
  #dataArray = new Uint8Array(2048);
  #rafId: number | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #flashTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    if (!this.shadowRoot?.childElementCount) this.#render();
    this.#resizeCanvas();
    this.#resizeObserver = new ResizeObserver(() => this.#resizeCanvas());
    if (this.#canvas) this.#resizeObserver.observe(this.#canvas);
    this.#rafId = requestAnimationFrame(this.#draw);
  }

  disconnectedCallback(): void {
    if (this.#rafId !== null) cancelAnimationFrame(this.#rafId);
    this.#resizeObserver?.disconnect();
    if (this.#flashTimeout !== null) clearTimeout(this.#flashTimeout);
  }

  #render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    this.#canvas = h('canvas', {});
    this.#canvasCtx = this.#canvas.getContext('2d');

    this.#triggerPad = h('button', {
      type: 'button',
      className: 'trigger-pad',
      innerHTML: '&#9654; TRIGGER',
    });
    this.#triggerPad.addEventListener('click', () => {
      this.#flash();
      this.dispatchEvent(new CustomEvent('trigger-request', { bubbles: true, composed: true }));
    });

    const exportBtn = h('button', {
      type: 'button',
      className: 'btn-secondary',
      innerText: 'EXPORT WAV',
    });
    exportBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('export-request', { bubbles: true, composed: true }));
    });

    const codeOutBtn = h('button', {
      type: 'button',
      className: 'btn-secondary',
      innerText: 'CODE OUT',
    });
    codeOutBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('code-out-request', { bubbles: true, composed: true }));
    });

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'panel' }, [
        ...panelScrews(),
        moduleLabel('OSCILLOSCOPE'),
        h('div', { className: 'scope-wrap' }, [
          this.#canvas,
          h('div', { className: 'scope-overlay' }),
        ]),
        h('div', { className: 'trigger-row' }, [this.#triggerPad, exportBtn, codeOutBtn]),
      ])
    );
  }

  #resizeCanvas(): void {
    const canvas = this.#canvas;
    const ctx = this.#canvasCtx;
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  #flash(): void {
    if (!this.#triggerPad) return;
    this.#triggerPad.classList.add('flash');
    if (this.#flashTimeout !== null) clearTimeout(this.#flashTimeout);
    this.#flashTimeout = setTimeout(() => this.#triggerPad?.classList.remove('flash'), 150);
  }

  #draw = (): void => {
    this.#rafId = requestAnimationFrame(this.#draw);
    const canvas = this.#canvas;
    const ctx = this.#canvasCtx;
    if (!canvas || !ctx) return;

    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,176,32,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (!this.#analyser) return;
    this.#analyser.getByteTimeDomainData(this.#dataArray);
    ctx.strokeStyle = '#ffb020';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = 'rgba(255,176,32,0.6)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    const sliceWidth = w / this.#dataArray.length;
    let x = 0;
    for (let i = 0; i < this.#dataArray.length; i++) {
      const v = this.#dataArray[i]! / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  set analyser(node: AnalyserNode | null) {
    this.#analyser = node;
  }

  get analyser(): AnalyserNode | null {
    return this.#analyser;
  }
}

customElements.define('oscilloscope-panel', OscilloscopePanel);

declare global {
  interface HTMLElementTagNameMap {
    'oscilloscope-panel': OscilloscopePanel;
  }
}

export default OscilloscopePanel;
