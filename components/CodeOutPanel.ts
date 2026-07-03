/**
 * CodeOutPanel Web Component
 *
 * The rack's CODE OUT module. Fetches the *real served* engine source
 * (`/src/engine/tonebenchEngine.js`, the exact compiled file the browser
 * is running) at runtime rather than embedding a hand-maintained snippet,
 * so what you see here is always what actually runs — same principle as
 * the prototype's function-as-text trick, just against a real network
 * fetch instead of an inline array-of-strings. Fetched once and cached
 * across all instances since the source never changes at runtime.
 *
 * Set `params` to rebuild and re-highlight the snippet.
 */

import { h } from '/src/domUtils.js';
import { highlightJs } from '/components/codeHighlight.js';
import { panelScrews, moduleLabel, PANEL_CHROME_CSS } from '/components/styles/panelChrome.js';
import type { SynthParams } from '/src/engine/tonebenchEngine.js';

const CSS = `
  ${PANEL_CHROME_CSS}

  :host {
    display: block;
    min-width: 0;
  }

  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
  }
  .panel-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .copy-btn,
  .toggle-btn {
    font-family: var(--font-display);
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    background: none;
    border: 1px solid var(--panel-line);
    border-radius: 3px;
    padding: 5px 9px;
    cursor: pointer;
    text-transform: uppercase;
  }
  .copy-btn:hover,
  .toggle-btn:hover {
    color: var(--amber);
    border-color: var(--amber-dim);
  }
  .copy-btn.copied {
    color: var(--green);
    border-color: var(--green);
  }
  .collapsed-summary {
    flex: 1;
    display: grid;
    align-content: center;
    gap: 10px;
    min-height: 170px;
    padding: 12px 14px;
    background: #0d0b08;
    border: 1px solid var(--panel-line);
    border-radius: 3px;
    color: var(--text-muted);
    font-size: 11px;
    line-height: 1.6;
  }
  .collapsed-summary strong {
    color: var(--text);
    font-family: var(--font-display);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .collapsed-summary span {
    display: block;
  }

  .code-scroll {
    background: #0d0b08;
    border: 1px solid var(--panel-line);
    border-radius: 3px;
    padding: 12px 14px;
    font-size: 11.5px;
    line-height: 1.6;
    color: #cbd6c9;
    overflow: auto;
    max-height: 340px;
    flex: 1;
    min-width: 0;
    white-space: pre;
  }
  :host(:not([expanded])) .code-scroll {
    display: none;
  }
  :host([expanded]) .collapsed-summary {
    display: none;
  }
  .code-scroll .kw {
    color: #ff9d6c;
  }
  .code-scroll .fn {
    color: #7fd8ff;
  }
  .code-scroll .num {
    color: var(--green);
  }
  .code-scroll .str {
    color: #f0c674;
  }
  .code-scroll .com {
    color: #5c5648;
    font-style: italic;
  }
`;

const ENGINE_SOURCE_URL = '/src/engine/tonebenchEngine.js';

function buildSnippet(engineSource: string, params: SynthParams): string {
  const paramsJson = JSON.stringify(params, null, 2);
  return [
    '// 1. Paste this file into your project as tonebenchEngine.js — it is',
    '//    dependency-free and safe to drop into any Web Audio project as-is.',
    engineSource.trimEnd(),
    '',
    '// 2. This object is your current TONEBENCH settings.',
    `const params = ${paramsJson};`,
    '',
    '// 3. Play it through any AudioContext.',
    "import { playSound } from './tonebenchEngine.js';",
    'const audioCtx = new AudioContext();',
    'playSound(audioCtx, params);',
  ].join('\n');
}

let engineSourceCache: Promise<string> | null = null;

function fetchEngineSource(): Promise<string> {
  engineSourceCache ??= fetch(ENGINE_SOURCE_URL).then(r => r.text());
  return engineSourceCache;
}

class CodeOutPanel extends HTMLElement {
  #params: SynthParams | null = null;
  #codeScroll: HTMLDivElement | null = null;
  #copyBtn: HTMLButtonElement | null = null;
  #toggleBtn: HTMLButtonElement | null = null;
  #snippetText = '';
  #copyResetTimeout: ReturnType<typeof setTimeout> | null = null;
  #expanded = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    if (!this.shadowRoot?.childElementCount) this.#render();
    void this.#refresh();
  }

  disconnectedCallback(): void {
    if (this.#copyResetTimeout !== null) clearTimeout(this.#copyResetTimeout);
  }

  #render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    this.#copyBtn = h('button', { type: 'button', className: 'copy-btn', innerText: 'COPY' });
    this.#copyBtn.addEventListener('click', () => void this.#copy());
    this.#toggleBtn = h('button', { type: 'button', className: 'toggle-btn', innerText: 'EXPAND' });
    this.#toggleBtn.addEventListener('click', () => this.#toggleExpanded());

    this.#codeScroll = h('div', { className: 'code-scroll' });

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'panel' }, [
        ...panelScrews(),
        moduleLabel('CODE OUT', [
          h('span', { className: 'panel-actions' }, [this.#copyBtn, this.#toggleBtn]),
        ]),
        h('div', { className: 'collapsed-summary' }, [
          h('strong', { innerText: 'Export-ready source' }),
          h('span', {
            innerText: 'Copy the dependency-free engine and current params, or expand to inspect.',
          }),
        ]),
        this.#codeScroll,
      ])
    );
    this.#syncExpanded();
  }

  async #refresh(): Promise<void> {
    if (!this.#params || !this.#codeScroll) return;
    const engineSource = await fetchEngineSource();
    this.#snippetText = buildSnippet(engineSource, this.#params);
    this.#codeScroll.innerHTML = highlightJs(this.#snippetText);
  }

  async #copy(): Promise<void> {
    if (!this.#snippetText && this.#params) await this.#refresh();
    const btn = this.#copyBtn;
    if (!btn) return;
    const showCopied = (): void => {
      btn.textContent = 'COPIED';
      btn.classList.add('copied');
      if (this.#copyResetTimeout !== null) clearTimeout(this.#copyResetTimeout);
      this.#copyResetTimeout = setTimeout(() => {
        btn.textContent = 'COPY';
        btn.classList.remove('copied');
      }, 1400);
    };

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(this.#snippetText);
        showCopied();
        return;
      } catch {
        // fall through to legacy fallback below
      }
    }

    const ta = h('textarea', { value: this.#snippetText });
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showCopied();
    } finally {
      document.body.removeChild(ta);
    }
  }

  #toggleExpanded(): void {
    this.#expanded = !this.#expanded;
    this.#syncExpanded();
    this.dispatchEvent(
      new CustomEvent('code-panel-toggle', {
        detail: { expanded: this.#expanded },
        bubbles: true,
        composed: true,
      })
    );
  }

  #syncExpanded(): void {
    this.toggleAttribute('expanded', this.#expanded);
    if (this.#toggleBtn) this.#toggleBtn.textContent = this.#expanded ? 'COLLAPSE' : 'EXPAND';
  }

  set params(p: SynthParams) {
    this.#params = p;
    void this.#refresh();
  }

  get params(): SynthParams | null {
    return this.#params;
  }
}

customElements.define('code-out-panel', CodeOutPanel);

declare global {
  interface HTMLElementTagNameMap {
    'code-out-panel': CodeOutPanel;
  }
}

export default CodeOutPanel;
