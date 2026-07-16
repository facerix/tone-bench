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
import { buildSoundSnippet, buildSoundSetSnippet } from '/src/soundSetCode.js';
import type { SynthParams } from '/src/engine/tonebenchEngine.js';
import type { SoundSet } from '/src/DataStore.js';

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
  .copy-btn {
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
  .copy-btn:hover {
    color: var(--amber);
    border-color: var(--amber-dim);
  }
  .copy-btn.copied {
    color: var(--green);
    border-color: var(--green);
  }

  .code-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  }
  .tab-btn {
    font-family: var(--font-display);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: none;
    border: 1px solid var(--panel-line);
    color: var(--text-muted);
    border-radius: 3px;
    padding: 6px 10px;
    cursor: pointer;
  }
  .tab-btn.active {
    color: var(--amber);
    border-color: var(--amber-dim);
    background: var(--panel-raised);
  }
  .tab-btn:hover:not(.active) {
    color: var(--text);
    border-color: var(--amber-dim);
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
    flex: 1;
    min-height: min(62vh, 520px);
    min-width: 0;
    white-space: pre;
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

let engineSourceCache: Promise<string> | null = null;

function fetchEngineSource(): Promise<string> {
  engineSourceCache ??= fetch(ENGINE_SOURCE_URL).then(r => r.text());
  return engineSourceCache;
}

type CodeTab = 'sound' | 'set';

class CodeOutPanel extends HTMLElement {
  #params: SynthParams | null = null;
  #soundSet: SoundSet | null = null;
  #activeTab: CodeTab = 'sound';
  #codeScroll: HTMLDivElement | null = null;
  #copyBtn: HTMLButtonElement | null = null;
  #tabSoundBtn: HTMLButtonElement | null = null;
  #tabSetBtn: HTMLButtonElement | null = null;
  #snippetText = '';
  #copyResetTimeout: ReturnType<typeof setTimeout> | null = null;

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

    this.#tabSoundBtn = h('button', {
      type: 'button',
      className: 'tab-btn active',
      innerText: 'THIS SOUND',
    });
    this.#tabSoundBtn.addEventListener('click', () => this.#setActiveTab('sound'));

    this.#tabSetBtn = h('button', {
      type: 'button',
      className: 'tab-btn',
      innerText: 'THIS SET',
    });
    this.#tabSetBtn.addEventListener('click', () => this.#setActiveTab('set'));

    this.#codeScroll = h('div', { className: 'code-scroll' });

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'panel' }, [
        ...panelScrews(),
        moduleLabel('CODE OUT', [h('span', { className: 'panel-actions' }, [this.#copyBtn])]),
        h('div', { className: 'code-tabs' }, [this.#tabSoundBtn, this.#tabSetBtn]),
        this.#codeScroll,
      ])
    );
  }

  #setActiveTab(tab: CodeTab): void {
    if (this.#activeTab === tab) return;
    this.#activeTab = tab;
    this.#tabSoundBtn?.classList.toggle('active', tab === 'sound');
    this.#tabSetBtn?.classList.toggle('active', tab === 'set');
    void this.#refresh();
  }

  async #refresh(): Promise<void> {
    if (!this.#codeScroll) return;
    const engineSource = await fetchEngineSource();

    if (this.#activeTab === 'set') {
      this.#snippetText = this.#soundSet
        ? buildSoundSetSnippet(engineSource, this.#soundSet)
        : '// No active sound set.';
    } else {
      if (!this.#params) return;
      this.#snippetText = buildSoundSnippet(engineSource, this.#params);
    }
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

  set params(p: SynthParams) {
    this.#params = p;
    if (this.#activeTab === 'sound') void this.#refresh();
  }

  get params(): SynthParams | null {
    return this.#params;
  }

  set soundSet(s: SoundSet | null) {
    this.#soundSet = s;
    if (this.#activeTab === 'set') void this.#refresh();
  }

  get soundSet(): SoundSet | null {
    return this.#soundSet;
  }
}

customElements.define('code-out-panel', CodeOutPanel);

declare global {
  interface HTMLElementTagNameMap {
    'code-out-panel': CodeOutPanel;
  }
}

export default CodeOutPanel;
