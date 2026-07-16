/**
 * SoundSetDrawer Web Component
 *
 * The "SOUND SETS" drawer: browse/create/rename/delete SoundSets, browse/
 * preview/load/delete the sounds inside the active one, and save the
 * currently-edited sound back into a set.
 *
 * Self-subscribes to `dataStore`'s 'change' event in connectedCallback()
 * per CLAUDE.md's DataStore consumer pattern — the sets/sounds list is
 * never pushed down from index.ts. `index.ts` only pushes the live editor
 * `params` (for status-line diffing), same as every other panel gets.
 *
 * The built-in Presets set (src/presets.ts, `readOnly: true`) is always
 * present in the picker alongside whatever's in `dataStore.items`, but
 * never persisted through DataStore and never deletable/renamable.
 *
 * Two modes, no separate "editingSoundId can be null" special-casing:
 *   - no active sound tracked  -> freeform editing, Save = save-as
 *   - active sound in a real set -> diffed against the stored sound,
 *     Save updates in place
 *   - active sound in the read-only Presets set -> Save always routes to
 *     save-as (there's nothing to update in place)
 *
 * `activeSoundSet`/`activeSound` are pure navigation/session state — two
 * small localStorage keys, deliberately NOT part of the SoundSet schema.
 *
 * Emits:
 *   'sound-load'             — CustomEvent<{ params: SynthParams }>
 *   'sound-preview'          — CustomEvent<{ params: SynthParams }>
 *   'active-soundset-change' — CustomEvent<{ soundSet: SoundSet | null }>
 */

import { h } from '/src/domUtils.js';
import { panelScrews, moduleLabel, PANEL_CHROME_CSS } from '/components/styles/panelChrome.js';
import '/components/ConfirmationModal.js';
import dataStore from '/src/DataStore.js';
import { PRESETS, BUILTIN_PRESETS_ID } from '/src/presets.js';
import { ensureUniqueName } from '/src/soundSetCode.js';
import { v4WithTimestamp } from '/src/uuid.js';
import type { SoundSet, NamedSound } from '/src/DataStore.js';
import type { SynthParams } from '/src/engine/tonebenchEngine.js';
import type ConfirmationModal from '/components/ConfirmationModal.js';

const ACTIVE_SET_KEY = 'tonebench-active-soundset-id';
const ACTIVE_SOUND_KEY = 'tonebench-active-sound-id';
const NEW_SET_OPTION = '__new__';

const CSS = `
  ${PANEL_CHROME_CSS}

  :host {
    display: block;
  }

  .set-row, .set-meta-row {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  .set-row select, .set-meta-row input {
    flex: 1;
    min-width: 0;
  }

  .icon-btn {
    font-family: var(--font-display);
    font-size: 14px;
    width: 34px;
    flex: none;
    background: var(--panel-raised);
    color: var(--text-muted);
    border: 1px solid var(--panel-line);
    border-radius: 3px;
    cursor: pointer;
  }
  .icon-btn:hover:not(:disabled) {
    color: var(--amber);
    border-color: var(--amber-dim);
  }
  .icon-btn.danger:hover:not(:disabled) {
    color: var(--red);
    border-color: #5a2a24;
  }
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  input[type='text'] {
    font-family: var(--font-body);
    font-size: 12px;
    background: var(--panel-raised);
    color: var(--text);
    border: 1px solid var(--panel-line);
    border-radius: 3px;
    padding: 8px 9px;
  }
  input[type='text']:focus-visible {
    outline: 2px solid var(--green);
  }
  input[type='text']:disabled {
    opacity: 0.5;
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

  .sound-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 320px;
    overflow: auto;
    margin-bottom: 10px;
    padding-right: 2px;
  }
  .sound-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    background: var(--panel-raised);
  }
  .sound-row:hover {
    border-color: var(--panel-line);
  }
  .sound-row.active {
    border-color: var(--amber-dim);
    background: #2a2116;
  }
  .row-play {
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 50%;
    background: none;
    border: 1px solid var(--panel-line);
    color: var(--amber);
    font-size: 9px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .row-play:hover {
    border-color: var(--amber);
    box-shadow: 0 0 6px var(--amber-glow);
  }
  .row-name {
    flex: 1;
    font-size: 12px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-tag {
    font-size: 9px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
    border: 1px solid var(--panel-line);
    border-radius: 2px;
    padding: 2px 5px;
    flex: none;
  }
  .row-del {
    width: 20px;
    height: 20px;
    flex: none;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 15px;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }
  .row-del:hover {
    color: var(--red);
  }

  .empty-msg {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.6;
    padding: 4px 2px 10px;
  }

  .current-sound {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px dashed var(--panel-line);
  }
  .current-sound-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .current-sound-row input {
    flex: 1;
    min-width: 0;
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
    flex: none;
  }
  .btn:hover {
    border-color: var(--amber-dim);
    color: var(--amber);
  }
  .btn.primary {
    color: var(--bg-deep);
    background: var(--amber);
    border-color: var(--amber);
    font-weight: 700;
  }
  .btn.primary:hover {
    color: var(--bg-deep);
    box-shadow: 0 0 12px var(--amber-glow);
  }

  .status {
    font-size: 10.5px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .status.neutral {
    color: var(--text-muted);
  }
  .status.unsaved {
    color: var(--red);
  }
  .status.saved {
    color: var(--green);
  }

  .save-as-row {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }
  .save-as-row[hidden] {
    display: none;
  }
  .save-as-row select {
    flex: 1;
    min-width: 0;
  }
`;

class SoundSetDrawer extends HTMLElement {
  #sets: SoundSet[] = [PRESETS];
  #activeSetId: string = BUILTIN_PRESETS_ID;
  #activeSoundId: string | null = null;
  #params: SynthParams | null = null;
  #pendingConfirmAction: (() => void) | null = null;
  #pendingSaveAsName = '';

  #setSelect: HTMLSelectElement | null = null;
  #newSetBtn: HTMLButtonElement | null = null;
  #renameInput: HTMLInputElement | null = null;
  #deleteSetBtn: HTMLButtonElement | null = null;
  #soundListEl: HTMLDivElement | null = null;
  #emptyMsg: HTMLDivElement | null = null;
  #nameInput: HTMLInputElement | null = null;
  #saveBtn: HTMLButtonElement | null = null;
  #statusEl: HTMLDivElement | null = null;
  #saveAsRow: HTMLDivElement | null = null;
  #saveAsSelect: HTMLSelectElement | null = null;
  #confirmationModal: ConfirmationModal | null = null;
  #hasHydrated = false;

  #onStoreChangeBound = (): void => this.#onStoreChange();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    if (!this.shadowRoot?.childElementCount) this.#render();
    this.#loadPersistedIds();
    dataStore.addEventListener('change', this.#onStoreChangeBound);
    // Optimistic initial paint from whatever's already in memory (at least
    // PRESETS) — never validates/persists. #onStoreChange() takes over once
    // a real 'change' event arrives; see its comment for why the order
    // matters here.
    this.#renderAll();
  }

  disconnectedCallback(): void {
    dataStore.removeEventListener('change', this.#onStoreChangeBound);
  }

  #loadPersistedIds(): void {
    try {
      this.#activeSetId = localStorage.getItem(ACTIVE_SET_KEY) || BUILTIN_PRESETS_ID;
      this.#activeSoundId = localStorage.getItem(ACTIVE_SOUND_KEY);
    } catch {
      this.#activeSetId = BUILTIN_PRESETS_ID;
      this.#activeSoundId = null;
    }
  }

  #persistActiveSet(): void {
    try {
      localStorage.setItem(ACTIVE_SET_KEY, this.#activeSetId);
    } catch {
      /* best-effort */
    }
  }

  #persistActiveSound(): void {
    try {
      if (this.#activeSoundId) localStorage.setItem(ACTIVE_SOUND_KEY, this.#activeSoundId);
      else localStorage.removeItem(ACTIVE_SOUND_KEY);
    } catch {
      /* best-effort */
    }
  }

  #getActiveSet(): SoundSet | undefined {
    return this.#sets.find(s => s.id === this.#activeSetId);
  }

  #render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    this.#setSelect = h('select', { ariaLabel: 'Active sound set' }) as HTMLSelectElement;
    this.#setSelect.addEventListener('change', () => this.#setActiveSet(this.#setSelect!.value));

    this.#newSetBtn = h('button', {
      type: 'button',
      className: 'icon-btn',
      innerText: '+',
      title: 'New sound set',
    });
    this.#newSetBtn.addEventListener('click', () => this.#onNewSetClick());

    this.#renameInput = h('input', {
      type: 'text',
      ariaLabel: 'Sound set name',
    }) as HTMLInputElement;
    this.#renameInput.addEventListener('change', () => this.#onRenameChange());

    this.#deleteSetBtn = h('button', {
      type: 'button',
      className: 'icon-btn danger',
      innerHTML: '&times;',
      title: 'Delete this sound set',
    });
    this.#deleteSetBtn.addEventListener('click', () => this.#onDeleteSetClick());

    this.#soundListEl = h('div', { className: 'sound-list' });
    this.#emptyMsg = h('div', {
      className: 'empty-msg',
      innerText: 'No sounds in this set yet. Design one below and click "Save".',
    });

    this.#nameInput = h('input', {
      type: 'text',
      placeholder: 'name this sound, e.g. jumpUp',
    }) as HTMLInputElement;
    this.#nameInput.addEventListener('input', () => this.#renderStatus());

    this.#saveBtn = h('button', { type: 'button', className: 'btn primary', innerText: 'SAVE' });
    this.#saveBtn.addEventListener('click', () => this.#onSaveClick());

    this.#statusEl = h('div', { className: 'status neutral' });

    this.#saveAsSelect = h('select', { ariaLabel: 'Save into which set' }) as HTMLSelectElement;
    const saveAsConfirmBtn = h('button', {
      type: 'button',
      className: 'btn primary',
      innerText: 'SAVE HERE',
    });
    saveAsConfirmBtn.addEventListener('click', () => this.#confirmSaveAs());
    const saveAsCancelBtn = h('button', { type: 'button', className: 'btn', innerText: 'CANCEL' });
    saveAsCancelBtn.addEventListener('click', () => this.#closeSaveAs());
    this.#saveAsRow = h('div', { className: 'save-as-row', hidden: true }, [
      this.#saveAsSelect,
      saveAsConfirmBtn,
      saveAsCancelBtn,
    ]);

    this.#confirmationModal = h('confirmation-modal', {});
    this.#confirmationModal.addEventListener('confirm', () => {
      const action = this.#pendingConfirmAction;
      this.#pendingConfirmAction = null;
      action?.();
    });
    this.#confirmationModal.addEventListener('cancel', () => {
      this.#pendingConfirmAction = null;
    });

    root.replaceChildren(
      h('style', { innerHTML: CSS }),
      h('div', { className: 'panel' }, [
        ...panelScrews(),
        moduleLabel('SOUND SETS'),
        h('div', { className: 'set-row' }, [this.#setSelect, this.#newSetBtn]),
        h('div', { className: 'set-meta-row' }, [this.#renameInput, this.#deleteSetBtn]),
        this.#soundListEl,
        this.#emptyMsg,
        h('div', { className: 'current-sound' }, [
          h('div', { className: 'current-sound-row' }, [this.#nameInput, this.#saveBtn]),
          this.#statusEl,
          this.#saveAsRow,
        ]),
        this.#confirmationModal as Node,
      ])
    );
  }

  // Reacts to a real 'change' event from dataStore — i.e. authoritative
  // data, safe to validate the persisted activeSetId/activeSoundId against
  // and fall back (persisting that fallback) if they no longer exist.
  //
  // This is deliberately NOT called eagerly from connectedCallback(): ES
  // module imports evaluate before the importing module's own top-level
  // code, so this component can be constructed and connected (as a side
  // effect of index.ts's `import '/components/SoundSetDrawer.js'`) before
  // index.ts's own `dataStore.init()` call ever runs. Validating against
  // dataStore.items at that point would see an empty, not-yet-loaded store,
  // wrongly conclude the persisted ids are stale, and persist that wrong
  // fallback — permanently clobbering the real selection. dataStore always
  // dispatches an 'init' change event once it has actually loaded (even if
  // asynchronously), so waiting for a real event is both correct and safe.
  #onStoreChange(): void {
    this.#sets = [PRESETS, ...(dataStore.items as SoundSet[])];

    if (!this.#sets.some(s => s.id === this.#activeSetId)) {
      this.#activeSetId = BUILTIN_PRESETS_ID;
      this.#activeSoundId = null;
      this.#persistActiveSet();
      this.#persistActiveSound();
      if (this.#nameInput) this.#nameInput.value = '';
    } else {
      const active = this.#getActiveSet();
      if (this.#activeSoundId && !active?.sounds.some(s => s.id === this.#activeSoundId)) {
        this.#activeSoundId = null;
        this.#persistActiveSound();
        if (this.#nameInput) this.#nameInput.value = '';
      }
    }

    // On the very first real update after connecting (i.e. once dataStore
    // has actually loaded), replay a 'sound-load' for whatever sound was
    // persisted as active — index.ts's currentParams is deliberately NOT
    // persisted across reloads (see CLAUDE.md), so without this the editor
    // would stay on DEFAULT_PARAMS while the drawer claims a specific sound
    // is active, making the status line lie ("unsaved changes" against
    // params the user never touched). Only ever fires once: later store
    // changes (e.g. editing an unrelated set) must never clobber whatever
    // the user is actively editing.
    if (!this.#hasHydrated) {
      this.#hasHydrated = true;
      const sound = this.#getActiveSet()?.sounds.find(s => s.id === this.#activeSoundId);
      if (sound) this.#loadSound(sound);
    }

    this.#renderAll();
  }

  // Pure (re)paint from current in-memory state — no validation, no
  // localStorage writes. Safe to call before the store has loaded.
  #renderAll(): void {
    this.#renderSetPicker();
    this.#renderSoundList();
    this.#renderStatus();
    this.#emitActiveSoundSetChange();
  }

  #renderSetPicker(): void {
    if (!this.#setSelect) return;
    this.#setSelect.replaceChildren(
      ...this.#sets.map(s =>
        h('option', { value: s.id, innerText: s.name, selected: s.id === this.#activeSetId })
      )
    );
    const active = this.#getActiveSet();
    if (this.#renameInput) {
      this.#renameInput.value = active?.name ?? '';
      this.#renameInput.disabled = !!active?.readOnly;
    }
    if (this.#deleteSetBtn) this.#deleteSetBtn.disabled = !!active?.readOnly;
  }

  #renderSoundList(): void {
    if (!this.#soundListEl || !this.#emptyMsg) return;
    const active = this.#getActiveSet();
    const sounds = active?.sounds ?? [];
    this.#emptyMsg.style.display = sounds.length === 0 ? 'block' : 'none';

    this.#soundListEl.replaceChildren(
      ...sounds.map(sound => {
        const row = h('div', {
          className: 'sound-row' + (sound.id === this.#activeSoundId ? ' active' : ''),
        });
        const playBtn = h('button', {
          type: 'button',
          className: 'row-play',
          innerHTML: '&#9654;',
          title: 'Preview',
        });
        playBtn.addEventListener('click', e => {
          e.stopPropagation();
          this.#previewSound(sound);
        });
        const nameSpan = h('span', { className: 'row-name', innerText: sound.name });
        const tag = h('span', {
          className: 'row-tag',
          innerText: sound.params.waveType.slice(0, 4),
        });

        const children: Node[] = [playBtn, nameSpan, tag];
        if (active && !active.readOnly) {
          const delBtn = h('button', {
            type: 'button',
            className: 'row-del',
            innerHTML: '&times;',
            title: 'Delete',
          });
          delBtn.addEventListener('click', e => {
            e.stopPropagation();
            this.#confirmDeleteSound(active, sound);
          });
          children.push(delBtn);
        }

        row.append(...children);
        row.addEventListener('click', () => this.#loadSound(sound));
        return row;
      })
    );
  }

  #renderStatus(): void {
    if (!this.#statusEl) return;
    const active = this.#getActiveSet();
    const sound = active?.sounds.find(s => s.id === this.#activeSoundId);

    if (!sound || !active) {
      this.#statusEl.textContent = 'Not part of any Sound Set';
      this.#statusEl.className = 'status neutral';
      return;
    }

    if (active.readOnly) {
      this.#statusEl.textContent = `From built-in preset “${sound.name}” — tweak and save into a Sound Set`;
      this.#statusEl.className = 'status neutral';
      return;
    }

    const typedName = (this.#nameInput?.value.trim() || sound.name).trim();
    const sameParams = this.#params
      ? JSON.stringify(this.#params) === JSON.stringify(sound.params)
      : true;
    const sameName = typedName === sound.name;
    if (sameParams && sameName) {
      this.#statusEl.textContent = `Saved as “${sound.name}”`;
      this.#statusEl.className = 'status saved';
    } else {
      this.#statusEl.textContent = `Unsaved changes to “${sound.name}”`;
      this.#statusEl.className = 'status unsaved';
    }
  }

  #setActiveSet(id: string, opts: { clearSound?: boolean } = {}): void {
    const clearSound = opts.clearSound ?? true;
    this.#activeSetId = id;
    this.#persistActiveSet();
    if (clearSound) {
      this.#activeSoundId = null;
      this.#persistActiveSound();
      if (this.#nameInput) this.#nameInput.value = '';
    }
    this.#renderSetPicker();
    this.#renderSoundList();
    this.#renderStatus();
    this.#emitActiveSoundSetChange();
  }

  #loadSound(sound: NamedSound): void {
    this.#activeSoundId = sound.id;
    this.#persistActiveSound();
    if (this.#nameInput) this.#nameInput.value = sound.name;
    this.dispatchEvent(
      new CustomEvent('sound-load', {
        detail: { params: sound.params },
        bubbles: true,
        composed: true,
      })
    );
    this.#renderSoundList();
    this.#renderStatus();
  }

  #previewSound(sound: NamedSound): void {
    this.dispatchEvent(
      new CustomEvent('sound-preview', {
        detail: { params: sound.params },
        bubbles: true,
        composed: true,
      })
    );
  }

  #emitActiveSoundSetChange(): void {
    const soundSet = this.#getActiveSet() ?? null;
    this.dispatchEvent(
      new CustomEvent('active-soundset-change', {
        detail: { soundSet },
        bubbles: true,
        composed: true,
      })
    );
  }

  #onNewSetClick(): void {
    const newSet: SoundSet = { id: '', name: 'New Sound Set', sounds: [] };
    dataStore.addItem(newSet);
    this.#setActiveSet(newSet.id);
    this.#renameInput?.focus();
    this.#renameInput?.select();
  }

  #onRenameChange(): void {
    const active = this.#getActiveSet();
    if (!active || active.readOnly || !this.#renameInput) return;
    const name = this.#renameInput.value.trim() || active.name;
    dataStore.updateItem({ ...active, name });
  }

  #onDeleteSetClick(): void {
    const active = this.#getActiveSet();
    if (!active || active.readOnly) return;
    this.#confirm(
      `Delete the “${active.name}” sound set and all ${active.sounds.length} sound(s) in it? This cannot be undone.`,
      () => dataStore.deleteItem(active.id)
      // #onStoreChange (fired synchronously by deleteItem) falls back
      // #activeSetId to the built-in Presets set automatically.
    );
  }

  #confirmDeleteSound(set: SoundSet, sound: NamedSound): void {
    this.#confirm(`Delete “${sound.name}” from this sound set?`, () => {
      dataStore.updateItem({ ...set, sounds: set.sounds.filter(s => s.id !== sound.id) });
    });
  }

  #confirm(message: string, onConfirm: () => void): void {
    this.#pendingConfirmAction = onConfirm;
    this.#confirmationModal?.showModal(message);
  }

  #defaultSoundName(): string {
    return this.#params ? `${this.#params.waveType} sound` : 'New Sound';
  }

  #onSaveClick(): void {
    if (!this.#params) return;
    const active = this.#getActiveSet();
    const sound = active?.sounds.find(s => s.id === this.#activeSoundId);
    const rawName = this.#nameInput?.value.trim() ?? '';

    if (sound && active && !active.readOnly) {
      const name = ensureUniqueName(
        active.sounds.filter(s => s.id !== sound.id).map(s => s.name),
        rawName || sound.name
      );
      const params = { ...this.#params };
      dataStore.updateItem({
        ...active,
        sounds: active.sounds.map(s => (s.id === sound.id ? { ...s, name, params } : s)),
      });
      if (this.#nameInput) this.#nameInput.value = name;
      return;
    }

    this.#openSaveAs(rawName || this.#defaultSoundName());
  }

  #openSaveAs(name: string): void {
    if (!this.#saveAsRow || !this.#saveAsSelect) return;
    const userSets = this.#sets.filter(s => !s.readOnly);
    this.#saveAsSelect.replaceChildren(
      ...userSets.map(s => h('option', { value: s.id, innerText: s.name })),
      h('option', { value: NEW_SET_OPTION, innerText: '+ New Sound Set' })
    );
    this.#pendingSaveAsName = name;
    this.#saveAsRow.hidden = false;
  }

  #closeSaveAs(): void {
    if (this.#saveAsRow) this.#saveAsRow.hidden = true;
    this.#pendingSaveAsName = '';
  }

  #confirmSaveAs(): void {
    if (!this.#saveAsSelect || !this.#params) return;
    const choice = this.#saveAsSelect.value;
    const name = this.#pendingSaveAsName || this.#defaultSoundName();

    let targetSet: SoundSet;
    if (choice === NEW_SET_OPTION) {
      const newSet: SoundSet = { id: '', name: 'New Sound Set', sounds: [] };
      dataStore.addItem(newSet);
      targetSet = newSet;
    } else {
      const found = this.#sets.find(s => s.id === choice);
      if (!found) return;
      targetSet = found;
    }

    const soundName = ensureUniqueName(
      targetSet.sounds.map(s => s.name),
      name
    );
    const newSound: NamedSound = {
      id: v4WithTimestamp(),
      name: soundName,
      params: { ...this.#params },
    };
    const updated: SoundSet = { ...targetSet, sounds: [...targetSet.sounds, newSound] };
    dataStore.updateItem(updated);

    this.#setActiveSet(updated.id, { clearSound: false });
    this.#activeSoundId = newSound.id;
    this.#persistActiveSound();
    if (this.#nameInput) this.#nameInput.value = soundName;
    this.#closeSaveAs();
    this.#renderSoundList();
    this.#renderStatus();
  }

  set params(p: SynthParams) {
    this.#params = p;
    this.#renderStatus();
  }

  get params(): SynthParams | null {
    return this.#params;
  }
}

customElements.define('sound-set-drawer', SoundSetDrawer);

declare global {
  interface HTMLElementTagNameMap {
    'sound-set-drawer': SoundSetDrawer;
  }
}

export default SoundSetDrawer;
