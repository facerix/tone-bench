# CLAUDE.md

TONEBENCH is a procedural SFX synthesis tool: a rack-style Web Audio API sound designer that lets you shape a "hit" sound with oscillator/noise source, ADSR envelope, filter, distortion, delay, and reverb, preview it live against an oscilloscope, and export it as a WAV file or a portable code snippet.

## Domain

### Sound = SynthParams

A "sound" in TONEBENCH is nothing more than a flat, fully-serializable `SynthParams` object (see `src/engine/tonebenchEngine.ts`): wave type, start/end frequency, ADSR fields, filter type/cutoff/Q, distortion amount, delay time/feedback/mix, reverb decay/mix, and volume. There is no hidden state — the same `SynthParams` object always produces the same sound, which is what makes presets, mutation, and JSON export/import trivial.

### ADSR is time-bounded, not held

TONEBENCH synthesizes one-shot "hits," not held notes. `duration = attack + decay + sustainTime + release` — `sustainTime` is a fixed span, not "however long the key is held." Don't reach for a note-on/note-off model here.

### Frequency sliders are logarithmic

`sliderToFreq`/`freqToSlider` in the engine map a linear 0–100 slider position onto an exponential frequency range (e.g. 20 Hz–4000 Hz). The midpoint slider value is **not** the midpoint frequency. Any UI touching frequency or cutoff sliders must go through these helpers, not linear interpolation.

### The engine is a vendored library — keep it dependency-free

`src/engine/tonebenchEngine.ts` is deliberately self-contained: it imports nothing from `DataStore.ts`, `domUtils.ts`, or `/components/`, and touches only `BaseAudioContext` and standard JS/DOM globals (no `window`, `document`, or `localStorage`). This is a first-class design goal, not an accident — the file is meant to be lifted out and dropped into an unrelated project as-is. **Do not add app-specific imports to this file.** If you need engine behavior from the UI, import functions from it; never the reverse.

### Presets vs. sound sets

- **Built-in presets** (`src/presets.ts`) are a fixed, hardcoded list (LASER, EXPLOSION, JUMP, COIN, HIT, POWERUP, UI CLICK, ALARM) ported from the original prototype. They are not persisted or user-editable.
- **Sound sets** are user-created, persisted via `DataStore` (localStorage key `soundSets`): a `SoundSet` record is `{ id, name, presets: SoundSetPreset[] }`, where each `SoundSetPreset` is `{ id, name, params: SynthParams }`. Users can save/load/delete presets within a set, and export a set as a portable bundle (the engine source + the set's JSON) for use in other projects.
- The `DataStore` *class* stays domain-agnostic (per the template's design) — no SoundSet-specific methods, no generic type param. `SoundSet`/`SoundSetPreset` are declared in `DataStore.ts` as plain exported interfaces for call sites to import, which isn't the same thing. To mutate a single preset inside a set, don't add new `DataStore` methods — clone the record via `getItemById`, mutate its `presets` array, then call `updateItem` with the clone. This pattern is intentional; don't rediscover it as "DataStore is missing an API."

## Coding standards

- TypeScript compiled via `tsc` (no bundler) to `dist/`. Import specifiers use `.js`, referring to the compiled output the browser loads.
- DOM creation goes through `h()` in `src/domUtils.ts` — never `document.createElement` directly.
- UI pieces are Web Components in `/components/`: Shadow DOM, kebab-case tags, `customElements.define()` paired with an `HTMLElementTagNameMap` augmentation in the same file.
- `DataStore` is a localStorage-backed singleton emitting a `change` CustomEvent (`init | add | update | delete`). Components that care about sound-set data self-subscribe in `connectedCallback()` rather than having state pushed down from `index.ts`.
- We practice TDD: write a test that can fail before implementing behavior, especially for the engine's pure logic (frequency mapping, duration math, mutate bounds, WAV byte encoding). `DataStore.ts` itself is an unmodified, battle-tested piece of the template (reused as-is across Rylee's projects) and is intentionally not unit-tested here — test the domain logic built on top of it instead.

## Dev server

`pnpm start` — `tsc --watch` + asset-copy watcher + `live-server` on port 8082.
