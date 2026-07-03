// Shared Shadow DOM styling for TONEBENCH's rack "panel" look (raised box,
// corner screws, amber module label). Every panel-ish component splices
// PANEL_CHROME_CSS into its own <style> string instead of pasting the same
// ~50 lines of CSS into every component file. Ported from the
// `.panel`/`.screw-*`/`.module-label` rules in docs/prototype.html.
//
// Custom properties (--panel, --panel-line, --amber, etc.) are defined on
// :root in main.css and inherit across the shadow boundary, so components
// using this sheet don't need to redefine the palette themselves.

import { h } from '/src/domUtils.js';

export const PANEL_CHROME_CSS = `
  .panel {
    position: relative;
    background: var(--panel);
    border: 1px solid var(--panel-line);
    border-radius: 4px;
    box-sizing: border-box;
    height: 100%;
    min-width: 0;
    padding: 16px 18px;
  }

  .panel .screw {
    position: absolute;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #0000;
    box-shadow:
      inset 0 0 0 1px var(--panel-line),
      inset 0 0 2px #000;
  }
  .panel .screw-tl {
    top: 6px;
    left: 6px;
  }
  .panel .screw-tr {
    top: 6px;
    right: 6px;
  }
  .panel .screw-bl {
    bottom: 6px;
    left: 6px;
  }
  .panel .screw-br {
    bottom: 6px;
    right: 6px;
  }

  .module-label {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.14em;
    color: var(--amber);
    text-transform: uppercase;
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .module-label .label-text {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .module-label .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--amber);
    box-shadow: 0 0 6px var(--amber-glow);
  }
`;

/** The four corner-screw decoration elements every `.panel` renders. */
export function panelScrews(): HTMLSpanElement[] {
  return ['screw-tl', 'screw-tr', 'screw-bl', 'screw-br'].map(corner =>
    h('span', { className: `screw ${corner}` })
  );
}

/** Builds a `.module-label` element: an amber dot + uppercase title text. */
export function moduleLabel(text: string, extra: Node[] = []): HTMLDivElement {
  return h('div', { className: 'module-label' }, [
    h('span', { className: 'label-text' }, [
      h('span', { className: 'dot' }),
      h('span', { innerText: text }),
    ]),
    ...extra,
  ]);
}
