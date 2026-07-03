import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS } from '../../src/presets.ts';
import { WAVE_TYPES, type SynthParams } from '../../src/engine/tonebenchEngine.ts';

const EXPECTED_KEYS: (keyof SynthParams)[] = [
  'waveType',
  'freqStart',
  'freqEnd',
  'attack',
  'decay',
  'sustainLevel',
  'sustainTime',
  'release',
  'filterType',
  'filterCutoff',
  'filterQ',
  'distortion',
  'delayTime',
  'delayFeedback',
  'delayMix',
  'reverbDecay',
  'reverbMix',
  'volume',
];

test('PRESETS contains exactly the 8 built-in presets from the prototype', () => {
  assert.deepEqual(Object.keys(PRESETS).sort(), [
    'ALARM',
    'COIN',
    'EXPLOSION',
    'HIT',
    'JUMP',
    'LASER',
    'POWERUP',
    'UI CLICK',
  ]);
});

test('every preset conforms exactly to the SynthParams shape — no missing or extra keys', () => {
  for (const [name, params] of Object.entries(PRESETS)) {
    const keys = Object.keys(params).sort();
    assert.deepEqual(keys, [...EXPECTED_KEYS].sort(), `preset "${name}" has mismatched keys`);
  }
});

test('every preset uses a valid waveType', () => {
  for (const [name, params] of Object.entries(PRESETS)) {
    assert.ok(WAVE_TYPES.includes(params.waveType), `preset "${name}" has invalid waveType`);
  }
});

test('every preset uses a valid filterType', () => {
  const validFilterTypes = ['none', 'lowpass', 'highpass', 'bandpass'];
  for (const [name, params] of Object.entries(PRESETS)) {
    assert.ok(
      validFilterTypes.includes(params.filterType),
      `preset "${name}" has invalid filterType`
    );
  }
});
