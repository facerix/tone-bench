import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, BUILTIN_PRESETS_ID } from '../../src/presets.ts';
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

test('PRESETS is the read-only built-in SoundSet, identified by BUILTIN_PRESETS_ID', () => {
  assert.equal(PRESETS.id, BUILTIN_PRESETS_ID);
  assert.equal(PRESETS.readOnly, true);
});

test('PRESETS.sounds contains exactly the 8 built-in sounds from the prototype', () => {
  assert.deepEqual(PRESETS.sounds.map(s => s.name).sort(), [
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

test('every sound has a non-empty, unique id', () => {
  const ids = PRESETS.sounds.map(s => s.id);
  assert.ok(
    ids.every(id => typeof id === 'string' && id.length > 0),
    'every sound id must be a non-empty string'
  );
  assert.deepEqual(ids, [...new Set(ids)], 'sound ids must be unique within PRESETS');
});

test('every sound conforms exactly to the SynthParams shape — no missing or extra keys', () => {
  for (const sound of PRESETS.sounds) {
    const keys = Object.keys(sound.params).sort();
    assert.deepEqual(keys, [...EXPECTED_KEYS].sort(), `sound "${sound.name}" has mismatched keys`);
  }
});

test('every sound uses a valid waveType', () => {
  for (const sound of PRESETS.sounds) {
    assert.ok(
      WAVE_TYPES.includes(sound.params.waveType),
      `sound "${sound.name}" has invalid waveType`
    );
  }
});

test('every sound uses a valid filterType', () => {
  const validFilterTypes = ['none', 'lowpass', 'highpass', 'bandpass'];
  for (const sound of PRESETS.sounds) {
    assert.ok(
      validFilterTypes.includes(sound.params.filterType),
      `sound "${sound.name}" has invalid filterType`
    );
  }
});
