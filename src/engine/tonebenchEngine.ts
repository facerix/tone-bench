// TONEBENCH synthesis engine
//
// This file is a deliberately self-contained, dependency-free "vendored
// library": it imports nothing from the rest of the app (no DataStore, no
// domUtils, no components) and touches only `BaseAudioContext` plus standard
// JS/DOM globals. It is designed to be copied wholesale into an unrelated
// project. Do not add app-specific imports here — see CLAUDE.md.

export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
export type FilterType = 'none' | 'lowpass' | 'highpass' | 'bandpass';

export const WAVE_TYPES: WaveType[] = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];

export interface SynthParams {
  waveType: WaveType;
  freqStart: number;
  freqEnd: number;
  attack: number;
  decay: number;
  sustainLevel: number;
  sustainTime: number;
  release: number;
  filterType: FilterType;
  filterCutoff: number;
  filterQ: number;
  distortion: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  reverbDecay: number;
  reverbMix: number;
  volume: number;
}

export interface PlaySoundResult {
  source: AudioScheduledSourceNode;
  duration: number;
}

export const FREQ_MIN = 20;
export const FREQ_MAX = 4000;
export const CUTOFF_MIN = 40;
export const CUTOFF_MAX = 14000;

/** Maps a linear 0-100 slider position onto an exponential (log-scale) frequency range. */
export function sliderToFreq(v: number, min: number, max: number): number {
  return min * Math.pow(max / min, v / 100);
}

/** Inverse of sliderToFreq: maps a frequency back onto a 0-100 slider position. */
export function freqToSlider(f: number, min: number, max: number): number {
  return (100 * Math.log(f / min)) / Math.log(max / min);
}

/** Total time a hit takes to play out: attack + decay + sustainTime + release. */
export function getDuration(p: SynthParams): number {
  return p.attack + p.decay + p.sustainTime + p.release;
}

// ---------------------------------------------------------------------------
// playSound: builds the full signal chain and schedules playback.
// ---------------------------------------------------------------------------

function createSource(
  ctx: BaseAudioContext,
  p: SynthParams,
  duration: number,
  when: number
): AudioScheduledSourceNode {
  if (p.waveType === 'noise') {
    const len = Math.max(1, Math.ceil(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  const source = ctx.createOscillator();
  source.type = p.waveType;
  source.frequency.setValueAtTime(p.freqStart, when);
  source.frequency.exponentialRampToValueAtTime(Math.max(p.freqEnd, 1), when + duration);
  return source;
}

function applyEnvelope(ctx: BaseAudioContext, p: SynthParams, when: number): GainNode {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(1, when + p.attack);
  env.gain.linearRampToValueAtTime(p.sustainLevel, when + p.attack + p.decay);
  env.gain.setValueAtTime(p.sustainLevel, when + p.attack + p.decay + p.sustainTime);
  env.gain.linearRampToValueAtTime(0.0001, when + getDuration(p));
  return env;
}

function applyFilter(ctx: BaseAudioContext, p: SynthParams): BiquadFilterNode | null {
  if (p.filterType === 'none') return null;
  const filter = ctx.createBiquadFilter();
  filter.type = p.filterType;
  filter.frequency.value = p.filterCutoff;
  filter.Q.value = p.filterQ;
  return filter;
}

function applyDistortion(ctx: BaseAudioContext, p: SynthParams): WaveShaperNode | null {
  if (p.distortion <= 0) return null;
  const shaper = ctx.createWaveShaper();
  const k = p.distortion * 2;
  const n = 44100;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  shaper.curve = curve;
  shaper.oversample = '4x';
  return shaper;
}

function applyDelay(
  ctx: BaseAudioContext,
  p: SynthParams,
  master: GainNode,
  destination: AudioNode
): void {
  if (p.delayMix <= 0) return;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = p.delayTime;
  const feedback = ctx.createGain();
  feedback.gain.value = p.delayFeedback;
  const delayWet = ctx.createGain();
  delayWet.gain.value = p.delayMix;
  master.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(destination);
}

function applyReverb(
  ctx: BaseAudioContext,
  p: SynthParams,
  master: GainNode,
  destination: AudioNode
): void {
  if (p.reverbMix <= 0) return;
  const convolver = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * p.reverbDecay);
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
  }
  convolver.buffer = impulse;
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = p.reverbMix;
  master.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(destination);
}

/**
 * Builds the full TONEBENCH signal chain for one params object and schedules
 * it to play. Safe to call against a live `AudioContext` or an
 * `OfflineAudioContext` (see renderToWav).
 */
export function playSound(
  ctx: BaseAudioContext,
  p: SynthParams,
  when?: number,
  destination?: AudioNode
): PlaySoundResult {
  const startAt = when ?? ctx.currentTime;
  const dest = destination ?? ctx.destination;
  const duration = getDuration(p);

  const master = ctx.createGain();
  master.gain.value = p.volume;

  const source = createSource(ctx, p, duration, startAt);
  const env = applyEnvelope(ctx, p, startAt);

  let node: AudioNode = source;
  node.connect(env);
  node = env;

  const filter = applyFilter(ctx, p);
  if (filter) {
    node.connect(filter);
    node = filter;
  }

  const shaper = applyDistortion(ctx, p);
  if (shaper) {
    node.connect(shaper);
    node = shaper;
  }

  node.connect(master);
  master.connect(dest);

  applyDelay(ctx, p, master, dest);
  applyReverb(ctx, p, master, dest);

  source.start(startAt);
  source.stop(startAt + duration + 0.1);

  return { source, duration };
}

// ---------------------------------------------------------------------------
// WAV export
// ---------------------------------------------------------------------------

/**
 * The minimal structural shape `bufferToWav` needs from an `AudioBuffer`.
 * Kept as a narrow interface (rather than the concrete DOM `AudioBuffer`
 * type) specifically so it can be exercised with a hand-built fake in unit
 * tests, since Node has no real Web Audio implementation.
 */
export interface WavSourceBuffer {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

/** Encodes a rendered audio buffer as 16-bit PCM WAV bytes. */
export function bufferToWav(buffer: WavSourceBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const arr = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arr);

  function writeStr(offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch]![i]!));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return arr;
}

/**
 * Renders a `SynthParams` hit through an `OfflineAudioContext` and returns
 * WAV bytes. Requires a real Web Audio implementation (browser only — not
 * callable from Node's test runner).
 */
export async function renderToWav(p: SynthParams, sampleRate = 44100): Promise<ArrayBuffer> {
  const duration = getDuration(p);
  const tail =
    Math.max(p.reverbMix > 0 ? p.reverbDecay : 0, p.delayMix > 0 ? p.delayTime * 4 : 0) + 0.3;
  const totalLen = Math.ceil((duration + tail) * sampleRate);
  const offlineCtx = new OfflineAudioContext(2, totalLen, sampleRate);
  playSound(offlineCtx, p, 0, offlineCtx.destination);
  const rendered = await offlineCtx.startRendering();
  return bufferToWav(rendered);
}

// ---------------------------------------------------------------------------
// Mutate
// ---------------------------------------------------------------------------

export interface MutateOptions {
  jitterAmount?: number;
}

function jitter(v: number, min: number, max: number, amt: number): number {
  const range = max - min;
  const nv = v + (Math.random() * 2 - 1) * range * amt;
  return Math.max(min, Math.min(max, nv));
}

/**
 * Returns a new `SynthParams` object with several fields randomly jittered
 * within their valid ranges. Does not mutate the input.
 */
export function mutate(p: SynthParams, opts?: MutateOptions): SynthParams {
  const amt = opts?.jitterAmount ?? 0.3;
  const freqAmt = opts?.jitterAmount ?? 0.4;
  return {
    ...p,
    waveType: WAVE_TYPES[Math.floor(Math.random() * WAVE_TYPES.length)]!,
    freqStart: jitter(p.freqStart, FREQ_MIN, FREQ_MAX, freqAmt),
    freqEnd: jitter(p.freqEnd, FREQ_MIN, FREQ_MAX, freqAmt),
    attack: jitter(p.attack, 0, 1, amt),
    decay: jitter(p.decay, 0, 1, amt),
    sustainLevel: jitter(p.sustainLevel, 0, 1, amt),
    sustainTime: jitter(p.sustainTime, 0, 1, amt),
    release: jitter(p.release, 0, 2, amt),
    filterCutoff: jitter(p.filterCutoff, CUTOFF_MIN, CUTOFF_MAX, freqAmt),
    filterQ: jitter(p.filterQ, 0.1, 20, amt),
    distortion: jitter(p.distortion, 0, 100, freqAmt),
    reverbMix: jitter(p.reverbMix, 0, 1, amt),
    delayMix: jitter(p.delayMix, 0, 1, amt),
  };
}
