import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sliderToFreq,
  freqToSlider,
  FREQ_MIN,
  FREQ_MAX,
  CUTOFF_MIN,
  CUTOFF_MAX,
} from '../../../src/engine/tonebenchEngine.ts';

test('sliderToFreq maps 0 to min and 100 to max', () => {
  assert.equal(sliderToFreq(0, FREQ_MIN, FREQ_MAX), FREQ_MIN);
  assert.ok(Math.abs(sliderToFreq(100, FREQ_MIN, FREQ_MAX) - FREQ_MAX) < 1e-9);
});

test('sliderToFreq is logarithmic, not linear — midpoint slider is not midpoint frequency', () => {
  const midFreq = sliderToFreq(50, FREQ_MIN, FREQ_MAX);
  const linearMid = (FREQ_MIN + FREQ_MAX) / 2;
  // geometric mean of min/max, well below the arithmetic midpoint
  assert.ok(midFreq < linearMid);
  assert.ok(Math.abs(midFreq - Math.sqrt(FREQ_MIN * FREQ_MAX)) < 1e-6);
});

test('freqToSlider is the inverse of sliderToFreq (round trip)', () => {
  for (let v = 0; v <= 100; v += 5) {
    const freq = sliderToFreq(v, FREQ_MIN, FREQ_MAX);
    const back = freqToSlider(freq, FREQ_MIN, FREQ_MAX);
    assert.ok(Math.abs(back - v) < 1e-6, `slider ${v} -> freq ${freq} -> slider ${back}`);
  }
});

test('round trip also holds for the cutoff frequency range', () => {
  for (let v = 0; v <= 100; v += 10) {
    const freq = sliderToFreq(v, CUTOFF_MIN, CUTOFF_MAX);
    const back = freqToSlider(freq, CUTOFF_MIN, CUTOFF_MAX);
    assert.ok(Math.abs(back - v) < 1e-6);
  }
});
