import { serviceWorkerManager } from '/src/ServiceWorkerManager.js';
import { h } from '/src/domUtils.js';
import '/components/UpdateNotification.js';
import '/components/PresetRow.js';
import '/components/OscilloscopePanel.js';
import '/components/CodeOutPanel.js';
import '/components/SourcePanel.js';
import '/components/EnvelopePanel.js';
import '/components/FilterPanel.js';
import '/components/SpacePanel.js';
import { playSound, renderToWav, mutate, type SynthParams } from '/src/engine/tonebenchEngine.js';

const whenLoaded = customElements.whenDefined('update-notification');

whenLoaded.then(async () => {
  const updateNotification = document.querySelector('update-notification');

  window.addEventListener('sw-update-available', event => {
    console.log('Service worker update available, showing notification');
    updateNotification?.show(event.detail.pendingWorker);
  });

  await serviceWorkerManager.register();
});

// ---------------------------------------------------------------------------
// TONEBENCH rack — current sound state + AudioContext orchestration.
// This is transient in-memory editing state, distinct from persisted sound
// sets (which go through DataStore); see CLAUDE.md's "Presets vs. sound
// sets" section.
// ---------------------------------------------------------------------------

const DEFAULT_PARAMS: SynthParams = {
  waveType: 'square',
  freqStart: 440,
  freqEnd: 440,
  attack: 0.01,
  decay: 0.1,
  sustainLevel: 0.6,
  sustainTime: 0.05,
  release: 0.2,
  filterType: 'lowpass',
  filterCutoff: 2000,
  filterQ: 1.0,
  distortion: 0,
  delayTime: 0.2,
  delayFeedback: 0.3,
  delayMix: 0,
  reverbDecay: 1.5,
  reverbMix: 0,
  volume: 0.8,
};

let currentParams: SynthParams = { ...DEFAULT_PARAMS };

const rack = document.getElementById('rack');
const scopePanel = document.querySelector('oscilloscope-panel');
const codeOutPanel = document.querySelector('code-out-panel');
const codeOutDialog = document.getElementById('codeOutDialog') as HTMLDialogElement | null;
const codeOutCloseBtn = document.getElementById('codeOutCloseBtn');
const sourcePanel = document.querySelector('source-panel');
const envelopePanel = document.querySelector('envelope-panel');
const filterPanel = document.querySelector('filter-panel');
const spacePanel = document.querySelector('space-panel');
const presetRow = document.querySelector('preset-row');
const mutateBtn = document.getElementById('mutateBtn');
const audioLed = document.getElementById('audioLed');
const audioStatus = document.getElementById('audioStatus');

function syncAllPanels(): void {
  if (sourcePanel) sourcePanel.params = currentParams;
  if (envelopePanel) envelopePanel.params = currentParams;
  if (filterPanel) filterPanel.params = currentParams;
  if (spacePanel) spacePanel.params = currentParams;
  if (codeOutPanel) codeOutPanel.params = currentParams;
}

// --- AudioContext, created lazily on first trigger (browsers require a
// user gesture before audio can play) ---

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;

function updateAudioStatus(): void {
  if (!audioLed || !audioStatus) return;
  if (!ctx) {
    audioLed.classList.remove('on');
    audioStatus.textContent = 'CONTEXT SUSPENDED';
    return;
  }
  audioLed.classList.toggle('on', ctx.state === 'running');
  audioStatus.textContent = `CONTEXT ${ctx.state.toUpperCase()}`;
}

function ensureContext(): AudioContext {
  if (ctx) return ctx;
  ctx = new AudioContext();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  const analyserOutGain = ctx.createGain();
  analyserOutGain.gain.value = 1;
  analyser.connect(analyserOutGain);
  analyserOutGain.connect(ctx.destination);
  if (scopePanel) scopePanel.analyser = analyser;
  ctx.onstatechange = updateAudioStatus;
  updateAudioStatus();
  return ctx;
}

function trigger(): void {
  const audioCtx = ensureContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  if (analyser) playSound(audioCtx, currentParams, audioCtx.currentTime, analyser);
}

async function exportWav(): Promise<void> {
  ensureContext();
  const wavData = await renderToWav(currentParams);
  const blob = new Blob([wavData], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `tonebench-${Date.now()}.wav` });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// --- wiring ---

rack?.addEventListener('params-change', e => {
  const { patch, commit } = (e as CustomEvent<{ patch: Partial<SynthParams>; commit: boolean }>)
    .detail;
  currentParams = { ...currentParams, ...patch };
  if (codeOutPanel) codeOutPanel.params = currentParams;
  if (commit) trigger();
});

presetRow?.addEventListener('preset-select', e => {
  const { params } = (e as CustomEvent<{ name: string; params: SynthParams }>).detail;
  currentParams = { ...params };
  syncAllPanels();
  trigger();
});

scopePanel?.addEventListener('trigger-request', () => trigger());
scopePanel?.addEventListener('export-request', () => void exportWav());
scopePanel?.addEventListener('code-out-request', () => {
  if (!codeOutDialog) return;
  if (!codeOutDialog.open) codeOutDialog.showModal();
});

codeOutCloseBtn?.addEventListener('click', () => codeOutDialog?.close());
codeOutDialog?.addEventListener('click', event => {
  if (event.target === codeOutDialog) codeOutDialog.close();
});

mutateBtn?.addEventListener('click', () => {
  currentParams = mutate(currentParams);
  syncAllPanels();
  trigger();
});

syncAllPanels();
updateAudioStatus();
