# TONEBENCH build — session handoff

**`TaskList`/`TaskGet` do NOT persist across sessions/`/clear`** — confirmed
the hard way: a session that started fresh found `TaskList` completely
empty despite this file (written by the *previous* session) claiming tasks
#1-8 existed with #1-3 done. Don't treat the task tracker as durable
storage for planning across sessions; this file (and CLAUDE.md) are the
only things that survive. Feel free to use `TaskCreate` for *within-session*
tracking, but re-derive the plan from this file + CLAUDE.md + the code, not
from an assumption that old task IDs still resolve.

## Decisions already made (don't re-ask)

- App slug `tone-bench`, deployed at `https://tonebench.facerix.com/`.
- Core synth engine is a **vendored library**: `src/engine/tonebenchEngine.ts`
  has zero imports from DataStore/domUtils/components, touches only
  `BaseAudioContext` + standard globals. Never add app-specific imports to it.
- Beyond the prototype's 8 fixed presets, we're adding persisted **sound
  sets** (DataStore-backed, `SoundSet { id, name, presets: SoundSetPreset[] }`)
  with save/load/delete, plus an "Export Set" feature.
- Export Set format: **two sequential downloads** — the vendored engine
  source file + `<setname>.soundset.json`. No zip lib (not approved).
- Code-out panel fetches the **real served engine source** at runtime
  (not a hand-maintained curated snippet) to preserve "what you see is
  what runs" parity with the prototype's function-as-string trick.
- Icons: real assets already supplied by Rylee, already in place — no
  placeholder work needed.
- Node 24's test runner has no `localStorage` global — DataStore CRUD tests
  need an in-memory stub defined *inside the test file only*, not in
  `DataStore.ts` itself.
- `OfflineAudioContext`/real `AudioContext` don't exist in Node at all —
  `playSound`/`renderToWav` are not unit-testable; covered by manual
  browser verification only (`run`/`verify` skills). `bufferToWav` is
  unit-testable because it's typed against a narrow `WavSourceBuffer`
  structural interface, not the concrete DOM `AudioBuffer` type.

## Full plan

The original step-by-step plan (sections A-F: template setup, engine API,
component decomposition, DataStore schema, test plan, milestones) was
drafted by a Plan subagent early on, but only ever lived in the task
tracker — which, per the note above, doesn't survive. Treat it as lost;
this file + CLAUDE.md are what's authoritative now.

## State of the repo right now

- Template identity pass done: package.json/manifest.json/LICENSE updated,
  `CLAUDE.md` created (domain writeup), `AGENTS.md` given a domain section,
  amber/dark rack palette (`--amber #ffb020`, `--bg-deep #14110d`, etc.) +
  Space Mono/IBM Plex Mono fonts ported into `main.css` and both HTML
  `<head>`s, service worker renamed (`tonebench-cache-` prefix,
  `[TONEBENCH]` log prefix throughout `sw.js`/`sw-dev.js`/`sw-core.js`/
  `ServiceWorkerManager.ts`), DataStore's localStorage key renamed
  `items` → `soundSets`.
- `src/engine/tonebenchEngine.ts` implemented and tested (15 tests):
  `SynthParams`/`WaveType`/`FilterType` types, `playSound`, `getDuration`,
  `sliderToFreq`/`freqToSlider` (+ `FREQ_MIN/MAX`, `CUTOFF_MIN/MAX`),
  `bufferToWav`/`renderToWav`, `mutate` (returns new object, clamps bounds).
- `src/presets.ts` implemented and tested (4 tests): the 8 fixed presets
  ported verbatim from `docs/prototype.html`.
- 39/39 tests passing, `pnpm typecheck`/`lint`/`format` all clean.
- `index.html`/`about.html` bodies are still template placeholders —
  the real rack UI markup comes later (task #7), built from components,
  not hand-written HTML.

## Task #4 — done, checked in with Rylee

`SoundSet`/`SoundSetPreset` interfaces now live in `src/DataStore.ts`
(exported plain interfaces, not a generic `DataStore<T>` — the class itself
stays domain-agnostic). Schema confirmed as-is: `SoundSet extends DataRecord
{ name, presets: SoundSetPreset[] }`, `SoundSetPreset { id, name, params:
SynthParams }` — per-preset id/name kept separate from `params` so a preset
can be renamed without touching its sound.

**No DataStore CRUD unit tests** — Rylee's call: `DataStore.ts` is an
unmodified, reused-everywhere piece of her template, "tried and true," out
of scope for this project's TDD practice. `CLAUDE.md`'s TDD bullet has been
updated to say so explicitly. Test the domain logic built on top of it
(components, sound-set mutation helpers) instead, not the store itself.

Also worth knowing: while writing (then discarding) a CRUD test, hit a real
gap — `DataStore.ts`'s `import { v4WithTimestamp } from '/src/uuid.js'` is a
root-absolute specifier that only resolves via the browser/dev-server's path
handling (`tsconfig`'s `paths: { "/*": ["./*"] }` is typecheck-only). Node's
test runner can't resolve it, so **any file with a real (non-type-only)
`/src/...` value import can't be `import`ed directly from a Node test.**
`presets.ts` dodges this because its `/src/...` import is `import type`
(erased at runtime). Not a problem right now since DataStore isn't tested,
but if a future component or helper needs a real cross-`src` value import
and gets pulled into a Node test, expect `ERR_MODULE_NOT_FOUND` and know why.

## Rack UI built (core component decomposition — prototype parity)

The full rack UI now exists and is wired up end-to-end: trigger/scope,
export WAV, code-out, presets, mutate, all 4 control panels. Rylee
browser-verified it live and confirmed it looks good; she's doing a design
pass next (expect CSS/visual tweaks, not architecture changes).

**Components** (all in `/components/`, Shadow DOM, `h()`-built, kebab-case
tags): `<range-field>` (generic labeled slider, reused ~16x) and
`<wave-toggle>` are the two reusable primitives Rylee approved over
per-panel bespoke markup. `<source-panel>`/`<envelope-panel>`/
`<filter-panel>`/`<space-panel>` each compose those for their slice of
`SynthParams`. `<oscilloscope-panel>` owns the canvas draw loop (reads an
`AnalyserNode` property index.ts hands it) + trigger/export buttons.
`<code-out-panel>` fetches `/src/engine/tonebenchEngine.js` (the real
compiled file the browser is running) once, caches it, and rebuilds the
copyable snippet + syntax highlighting on every params change — this is
the "what you see is what runs" decision from above, implemented.
`<preset-row>` renders `src/presets.ts`'s 8 fixed presets.

**State ownership**: `index.ts` is the single source of truth for the
in-memory `SynthParams` being edited (seeded from the prototype's default
square-wave params, *not* from `src/presets.ts` — that's a separate fixed
list). Panels never hold authoritative state; they emit `'params-change'`
(`{ patch: Partial<SynthParams>; commit: boolean }`, `commit=false` on live
drag, `true` on release) and index.ts merges the patch, always pushes
`codeOutPanel.params` (so the code panel stays live during drag), and only
calls `trigger()` (plays the sound) on `commit`. `preset-select`/mutate
button both replace the whole params object and call `syncAllPanels()` to
push it to everything at once. AudioContext/AnalyserNode are created
lazily in `index.ts` on first trigger (browser autoplay-gesture
requirement), matching the prototype's suspended-until-interaction LED.

**Two things worth knowing if you touch this again:**
- `EnvelopePanel` keeps a local `#adsr` mirror of its own 4 duration-
  relevant fields and recomputes the duration readout on every drag tick
  *without* going through index.ts — it's the one panel where a readout
  depends on multiple fields within the same panel, so routing it through
  the normal patch→index.ts→push-back loop would need an extra round trip.
- Shadow DOM styles can't cross into light DOM. `components/styles/
  panelChrome.ts` (`PANEL_CHROME_CSS`) is shared across all *components*,
  but the top-level rack markup in `index.html` (the presets panel wrapper,
  rack/grid layout, status LED) is light DOM, so `main.css` has a
  near-duplicate of the same `.panel`/`.screw`/`.module-label` rules. This
  is intentional, not an oversight — see the comment above that block in
  `main.css`.

**Not built yet**: the sound-set UI (save/load/delete/export a `SoundSet`,
per `DataStore.ts`'s `SoundSet`/`SoundSetPreset` types from task #4) is
still outstanding — that's the "six Web Components on top of the schema"
mentioned earlier in this file. The current rack only knows about the 8
fixed built-in presets.
