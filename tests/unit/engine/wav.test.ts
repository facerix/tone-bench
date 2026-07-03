import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bufferToWav, type WavSourceBuffer } from '../../../src/engine/tonebenchEngine.ts';

function readStr(view: DataView, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

function makeFakeBuffer(channels: number[][], sampleRate = 44100): WavSourceBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length,
    getChannelData: (ch: number) => Float32Array.from(channels[ch]),
  };
}

test('bufferToWav writes correct RIFF/WAVE/fmt/data headers', () => {
  const buffer = makeFakeBuffer([[0, 0.5, -0.5]], 44100);
  const wav = bufferToWav(buffer);
  const view = new DataView(wav);

  assert.equal(readStr(view, 0, 4), 'RIFF');
  assert.equal(readStr(view, 8, 4), 'WAVE');
  assert.equal(readStr(view, 12, 4), 'fmt ');
  assert.equal(readStr(view, 36, 4), 'data');

  const numChannels = 1;
  const bytesPerSample = 2;
  const numSamples = 3;
  const dataSize = numSamples * numChannels * bytesPerSample;

  assert.equal(view.getUint32(4, true), 36 + dataSize);
  assert.equal(view.getUint16(20, true), 1); // PCM format tag
  assert.equal(view.getUint16(22, true), numChannels);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint16(34, true), 16); // bit depth
  assert.equal(view.getUint32(40, true), dataSize);
  assert.equal(wav.byteLength, 44 + dataSize);
});

test('bufferToWav encodes samples as clamped 16-bit PCM, little-endian', () => {
  // 1.0 -> 0x7FFF, -1.0 -> -0x8000, 0 -> 0, out-of-range clamps to the same bounds
  const buffer = makeFakeBuffer([[1.0, -1.0, 0, 1.5, -1.5]]);
  const wav = bufferToWav(buffer);
  const view = new DataView(wav);

  const readSample = (i: number): number => view.getInt16(44 + i * 2, true);

  assert.equal(readSample(0), 0x7fff);
  assert.equal(readSample(1), -0x8000);
  assert.equal(readSample(2), 0);
  assert.equal(readSample(3), 0x7fff); // clamped
  assert.equal(readSample(4), -0x8000); // clamped
});

test('bufferToWav interleaves multiple channels', () => {
  const left = [1, 0, -1];
  const right = [-1, 0, 1];
  const buffer = makeFakeBuffer([left, right]);
  const wav = bufferToWav(buffer);
  const view = new DataView(wav);

  const readSample = (i: number): number => view.getInt16(44 + i * 2, true);

  // interleaved: L0 R0 L1 R1 L2 R2
  assert.equal(readSample(0), 0x7fff);
  assert.equal(readSample(1), -0x8000);
  assert.equal(readSample(2), 0);
  assert.equal(readSample(3), 0);
  assert.equal(readSample(4), -0x8000);
  assert.equal(readSample(5), 0x7fff);
});

test('bufferToWav handles an empty (zero-length) buffer', () => {
  const buffer = makeFakeBuffer([[]]);
  const wav = bufferToWav(buffer);
  assert.equal(wav.byteLength, 44);
  const view = new DataView(wav);
  assert.equal(view.getUint32(40, true), 0);
});
