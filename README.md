# TONEBENCH

Procedural SFX synthesis tool: a rack-style Web Audio API sound designer. Shape "hit" sounds with oscillator/noise source, ADSR envelope, filter, distortion, delay, and reverb — preview live with an oscilloscope, export as WAV or portable code.

Built with vanilla TypeScript, Web Components, and Service Workers — compiled with `tsc`, no bundler. Runs offline-first with full PWA support.

## Architecture

- **No frameworks, no bundler** - Pure vanilla TypeScript compiled with `tsc` to ES modules
- **Vendored synthesis engine** - `src/engine/tonebenchEngine.ts` is self-contained (zero app-specific imports), can be lifted out as-is for reuse elsewhere
- **Web Components** - Custom elements in `/components/` with Shadow DOM for rack UI panels
- **Sound sets** - Persisted via `DataStore` (localStorage): create/save/load/export user sound collections
- **DOM Creation** - Use `h()` helper from `src/domUtils.ts` for all DOM manipulation
- **Service Workers** - Offline-first caching with automatic update notifications (authored in plain JS, not compiled)

## Requirements

- **Node 24+** (see `.nvmrc`). Tests run TypeScript directly via Node's built-in type stripping, which is on by default in Node 24.

## Setup

```sh
pnpm install
git config core.hooksPath .githooks
```

This activates pre-commit hooks that run lint and format checks before each commit.

## Development

### Commands

- **`pnpm start` / `pnpm dev`** — runs three concurrent processes: `tsc --watch`, a chokidar asset-copy watcher, and live-server on port 8082 serving `dist/`
- **`pnpm build`** — one-shot `tsc` build + asset copy into `dist/`
- **`pnpm typecheck`** — type-check src and tests without emitting
- **`pnpm test`** — typecheck + run `node --test` against `.ts` files
- **`pnpm lint` / `pnpm lint:fix`** — oxlint
- **`pnpm format` / `pnpm format:check`** — prettier

### How the build works

`tsc` reads source from the repo root (`index.ts`, `about.ts`, `src/**`, `components/**`) and emits compiled `.js` into `dist/` (preserving the tree). `scripts/copy-assets.mjs` copies all static files (HTML, CSS, manifest, icons, service workers) into `dist/`. `live-server` serves `dist/` as the web root, so the absolute import paths in source (`/src/foo.js`, `/components/Foo.js`) resolve correctly.

Service workers (`sw.js`, `sw-dev.js`, `sw-core.js`) are **not** compiled by `tsc` — they're hand-authored classic-worker JavaScript and are copied verbatim into `dist/`.

## Coding Standards

- **TypeScript** - `strict: true`, `verbatimModuleSyntax: true`, `moduleResolution: "bundler"`
- **ES modules** - Always use `import`/`export`. Import paths use the `.js` extension (compiled output), e.g. `import { h } from '/src/domUtils.js'`. The test files are the one exception — they import `.ts` directly so Node can run them without a build step.
- **Private fields** - Use `#fieldName` for encapsulation
- **const > let** - Prefer `const`, avoid `var`
- **Arrow functions** - For callbacks
- **async/await** - For promises
- **Test-driven development** - Write tests that can fail before implementing behavior, especially for the synthesis engine's pure logic (frequency mapping, duration math, WAV byte encoding, preset mutations)

## Project Structure

```
/
├── index.html/.ts             # Main rack UI entry point
├── about.html/.ts             # About/help page
├── main.css                   # Global styles (rack layout, light/dark theme, fonts)
├── manifest.json              # PWA manifest
├── sw.js                      # Production service worker (hand-authored JS)
├── sw-dev.js                  # Development service worker (hand-authored JS)
├── sw-core.js                 # Shared service worker logic (hand-authored JS)
├── tsconfig.json              # tsc config for src/components/entries
├── tsconfig.tests.json        # type-check-only config for tests
├── components/                # Web Components (Custom Elements)
│   ├── RangeField.ts          # Reusable labeled slider input
│   ├── WaveToggle.ts          # Wave type selector (sine/square/triangle/noise)
│   ├── SourcePanel.ts         # Oscillator/noise source controls
│   ├── EnvelopePanel.ts       # ADSR envelope duration controls
│   ├── FilterPanel.ts         # Filter type/cutoff/Q controls
│   ├── SpacePanel.ts          # Distortion/delay/reverb controls
│   ├── OscilloscopePanel.ts   # Waveform display + trigger/export buttons
│   ├── CodeOutPanel.ts        # Live code snippet (fetches real engine source)
│   ├── PresetRow.ts           # Built-in preset buttons
│   ├── UpdateNotification.ts  # PWA update prompt
│   └── styles/
│       └── panelChrome.ts     # Shared shadow-DOM styles for panels
├── src/                       # Core utilities
│   ├── engine/
│   │   └── tonebenchEngine.ts # Vendored synthesis library (self-contained, reusable)
│   ├── presets.ts             # 8 built-in presets (LASER, EXPLOSION, JUMP, COIN, HIT, POWERUP, UI CLICK, ALARM)
│   ├── DataStore.ts           # Singleton data store (localStorage), includes SoundSet/SoundSetPreset types
│   ├── ServiceWorkerManager.ts # Service worker lifecycle + update notifications
│   ├── domUtils.ts            # DOM helper functions (h() function, isDevelopmentMode())
│   ├── uuid.ts                # Thin wrapper over crypto.randomUUID()
│   └── globals.d.ts           # Ambient types (window.serviceWorkerManager, custom window events)
├── scripts/
│   └── copy-assets.mjs        # Copies static files into dist/
├── tests/                     # node --test suites (TypeScript)
│   ├── engine.test.ts         # Synthesis engine tests
│   └── presets.test.ts        # Preset tests
├── images/                    # SVG/PNG assets
├── icons/                     # PWA icons (referenced from manifest.json)
├── favicon.svg                # Browser favicon (scalable)
├── favicon.ico                # Legacy favicon
├── favicon-96x96.png          # 96×96 favicon
└── apple-touch-icon.png       # 180×180 iOS home-screen icon
```

(`dist/` is git-ignored; created by `pnpm build` or `pnpm dev`.)

## Key Concepts

### Sounds as Data
A "sound" in TONEBENCH is a flat, fully-serializable `SynthParams` object: wave type, start/end frequency, ADSR fields, filter/distortion/delay/reverb settings, and volume. The same object always produces the same sound — no hidden state. This makes presets, mutation, and JSON export trivial.

### Presets & Sound Sets
- **Built-in presets** (`src/presets.ts`): 8 fixed presets (LASER, EXPLOSION, JUMP, COIN, HIT, POWERUP, UI CLICK, ALARM)
- **Sound sets** (via `DataStore`): User-created collections of presets, persisted to localStorage, can be exported as portable bundles

### ADSR Is Time-Bounded
TONEBENCH synthesizes one-shot "hits," not held notes. `duration = attack + decay + sustainTime + release` — `sustainTime` is a fixed span, not "however long the key is held."

### Frequency Sliders Are Logarithmic
Frequency and cutoff sliders use logarithmic mapping via `sliderToFreq` / `freqToSlider`, not linear interpolation. The slider midpoint is not the frequency midpoint.

### The Engine Is Reusable
`src/engine/tonebenchEngine.ts` is intentionally self-contained: zero imports from `DataStore`, `domUtils`, or `/components/`, touches only `BaseAudioContext` and standard JS/DOM globals. It's designed to be lifted out and dropped into unrelated projects as-is.

## Architecture Deep Dive

See [CLAUDE.md](CLAUDE.md) for the full domain writeup, [AGENTS.md](AGENTS.md) for agent guidance, and [SESSION_NOTES.md](.claude/SESSION_NOTES.md) for project history and design decisions.

## Credits

Created by [Rylee Corradini](https://github.com/facerix).
