import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getDuration, type SynthParams } from '../../../src/engine/tonebenchEngine.ts';

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

test('getDuration sums attack + decay + sustainTime + release', () => {
  assert.ok(Math.abs(getDuration(BASE) - 0.36) < 1e-9);
});

test('getDuration is zero when all ADSR fields are zero', () => {
  const p: SynthParams = { ...BASE, attack: 0, decay: 0, sustainTime: 0, release: 0 };
  assert.equal(getDuration(p), 0);
});

test('getDuration ignores non-ADSR fields', () => {
  const p: SynthParams = { ...BASE, filterCutoff: 99999, reverbDecay: 4 };
  assert.ok(Math.abs(getDuration(p) - 0.36) < 1e-9);
});
