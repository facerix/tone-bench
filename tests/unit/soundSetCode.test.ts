import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeIdentifier,
  ensureUniqueName,
  buildSoundSnippet,
  buildSoundSetSnippet,
} from '../../src/soundSetCode.ts';
import type { SynthParams } from '../../src/engine/tonebenchEngine.ts';
import type { SoundSet } from '../../src/DataStore.ts';

const BASE_PARAMS: SynthParams = {
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

function soundSet(overrides: Partial<SoundSet> = {}): SoundSet {
  return {
    id: 'set_1',
    name: 'My Set',
    sounds: [],
    ...overrides,
  };
}

// --- sanitizeIdentifier ---------------------------------------------------

test('sanitizeIdentifier camelCases multi-word names', () => {
  assert.equal(sanitizeIdentifier('Jump Up'), 'jumpUp');
  assert.equal(sanitizeIdentifier('My Cool Sound!'), 'myCoolSound');
});

test('sanitizeIdentifier lowercases single-word names', () => {
  assert.equal(sanitizeIdentifier('COIN'), 'coin');
  assert.equal(sanitizeIdentifier('UI CLICK'), 'uiClick');
});

test('sanitizeIdentifier treats punctuation and underscores as word separators', () => {
  assert.equal(sanitizeIdentifier('coin_pickup'), 'coinPickup');
  assert.equal(sanitizeIdentifier('level-1 (final)'), 'level1Final');
});

test('sanitizeIdentifier prefixes a leading digit', () => {
  assert.equal(sanitizeIdentifier('123abc'), '_123abc');
});

test('sanitizeIdentifier falls back to "sound" for empty or all-punctuation input', () => {
  assert.equal(sanitizeIdentifier(''), 'sound');
  assert.equal(sanitizeIdentifier('   '), 'sound');
  assert.equal(sanitizeIdentifier('!!!'), 'sound');
});

// --- ensureUniqueName ------------------------------------------------------

test('ensureUniqueName returns the name unchanged when there is no collision', () => {
  assert.equal(ensureUniqueName([], 'coin'), 'coin');
  assert.equal(ensureUniqueName(['jump'], 'coin'), 'coin');
});

test('ensureUniqueName suffixes with an incrementing number on collision', () => {
  assert.equal(ensureUniqueName(['coin'], 'coin'), 'coin2');
  assert.equal(ensureUniqueName(['coin', 'coin2'], 'coin'), 'coin3');
  assert.equal(ensureUniqueName(['coin', 'coin2', 'coin3'], 'coin'), 'coin4');
});

// --- buildSoundSnippet ------------------------------------------------------

test('buildSoundSnippet embeds the engine source and params verbatim', () => {
  const snippet = buildSoundSnippet('function playSound() { /* engine */ }', BASE_PARAMS);
  assert.match(snippet, /function playSound\(\) \{ \/\* engine \*\/ \}/);
  assert.match(snippet, /const params = \{/);
  assert.match(snippet, /"waveType": "square"/);
  assert.match(snippet, /playSound\(audioCtx, params\);/);
});

// --- buildSoundSetSnippet ---------------------------------------------------

test('buildSoundSetSnippet returns a placeholder for an empty set', () => {
  const snippet = buildSoundSetSnippet(
    'ENGINE_SOURCE',
    soundSet({ name: 'Empty Set', sounds: [] })
  );
  assert.match(snippet, /Empty Set/);
  assert.match(snippet, /no sounds yet/i);
  assert.doesNotMatch(snippet, /ENGINE_SOURCE/);
});

test('buildSoundSetSnippet embeds the engine source, defs object, factory, and usage lines', () => {
  const set = soundSet({
    name: 'My RPG SFX',
    sounds: [
      { id: 's1', name: 'Jump Up', params: BASE_PARAMS },
      { id: 's2', name: 'Coin Pickup', params: { ...BASE_PARAMS, waveType: 'sine' } },
    ],
  });
  const snippet = buildSoundSetSnippet('ENGINE_SOURCE', set);

  assert.match(snippet, /ENGINE_SOURCE/);
  assert.match(snippet, /const myRpgSfxDefs = \{/);
  assert.match(snippet, /"jumpUp": \{/);
  assert.match(snippet, /"coinPickup": \{/);
  assert.match(snippet, /function createSoundPack\(ctx, defs\)/);
  assert.match(snippet, /const myRpgSfx = createSoundPack\(audioCtx, myRpgSfxDefs\);/);
  assert.match(snippet, /myRpgSfx\.jumpUp\.play\(\);/);
  assert.match(snippet, /myRpgSfx\.coinPickup\.play\(\);/);
});

test('buildSoundSetSnippet dedupes sound names that sanitize to the same identifier', () => {
  const set = soundSet({
    name: 'Coins',
    sounds: [
      { id: 's1', name: 'Coin!', params: BASE_PARAMS },
      { id: 's2', name: 'Coin?', params: BASE_PARAMS },
    ],
  });
  const snippet = buildSoundSetSnippet('ENGINE_SOURCE', set);
  assert.match(snippet, /"coin": \{/);
  assert.match(snippet, /"coin2": \{/);
});
