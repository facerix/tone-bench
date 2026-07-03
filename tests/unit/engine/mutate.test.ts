import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mutate,
  FREQ_MIN,
  FREQ_MAX,
  CUTOFF_MIN,
  CUTOFF_MAX,
  type SynthParams,
  type WaveType,
} from '../../../src/engine/tonebenchEngine.ts';

const WAVE_TYPES: WaveType[] = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];

const BASE: SynthParams = {
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
  filterQ: 1,
  distortion: 0,
  delayTime: 0.2,
  delayFeedback: 0.3,
  delayMix: 0,
  reverbDecay: 1.5,
  reverbMix: 0,
  volume: 0.8,
};

function assertInBounds(p: SynthParams): void {
  assert.ok(WAVE_TYPES.includes(p.waveType), `waveType ${p.waveType} not valid`);
  assert.ok(p.freqStart >= FREQ_MIN && p.freqStart <= FREQ_MAX, `freqStart ${p.freqStart}`);
  assert.ok(p.freqEnd >= FREQ_MIN && p.freqEnd <= FREQ_MAX, `freqEnd ${p.freqEnd}`);
  assert.ok(p.attack >= 0 && p.attack <= 1, `attack ${p.attack}`);
  assert.ok(p.decay >= 0 && p.decay <= 1, `decay ${p.decay}`);
  assert.ok(p.sustainLevel >= 0 && p.sustainLevel <= 1, `sustainLevel ${p.sustainLevel}`);
  assert.ok(p.sustainTime >= 0 && p.sustainTime <= 1, `sustainTime ${p.sustainTime}`);
  assert.ok(p.release >= 0 && p.release <= 2, `release ${p.release}`);
  assert.ok(
    p.filterCutoff >= CUTOFF_MIN && p.filterCutoff <= CUTOFF_MAX,
    `filterCutoff ${p.filterCutoff}`
  );
  assert.ok(p.filterQ >= 0.1 && p.filterQ <= 20, `filterQ ${p.filterQ}`);
  assert.ok(p.distortion >= 0 && p.distortion <= 100, `distortion ${p.distortion}`);
  assert.ok(p.reverbMix >= 0 && p.reverbMix <= 1, `reverbMix ${p.reverbMix}`);
  assert.ok(p.delayMix >= 0 && p.delayMix <= 1, `delayMix ${p.delayMix}`);
}

test('mutate() keeps every jittered field within documented bounds over many iterations', () => {
  let current = BASE;
  for (let i = 0; i < 1000; i++) {
    current = mutate(current);
    assertInBounds(current);
  }
});

test('mutate() does not mutate the input object in place', () => {
  const input: SynthParams = { ...BASE };
  const snapshot = { ...input };
  const result = mutate(input);
  assert.deepEqual(input, snapshot);
  assert.notEqual(result, input);
});

test('mutate() does not throw or overflow bounds starting from minimum-boundary params', () => {
  const minParams: SynthParams = {
    ...BASE,
    freqStart: FREQ_MIN,
    freqEnd: FREQ_MIN,
    attack: 0,
    decay: 0,
    sustainLevel: 0,
    sustainTime: 0,
    release: 0,
    filterCutoff: CUTOFF_MIN,
    filterQ: 0.1,
    distortion: 0,
    reverbMix: 0,
    delayMix: 0,
  };
  let current = minParams;
  for (let i = 0; i < 200; i++) {
    current = mutate(current);
    assertInBounds(current);
  }
});

test('mutate() does not throw or overflow bounds starting from maximum-boundary params', () => {
  const maxParams: SynthParams = {
    ...BASE,
    freqStart: FREQ_MAX,
    freqEnd: FREQ_MAX,
    attack: 1,
    decay: 1,
    sustainLevel: 1,
    sustainTime: 1,
    release: 2,
    filterCutoff: CUTOFF_MAX,
    filterQ: 20,
    distortion: 100,
    reverbMix: 1,
    delayMix: 1,
  };
  let current = maxParams;
  for (let i = 0; i < 200; i++) {
    current = mutate(current);
    assertInBounds(current);
  }
});
