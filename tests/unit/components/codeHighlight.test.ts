import { test } from 'node:test';
import assert from 'node:assert/strict';

import { highlightJs } from '../../../components/codeHighlight.ts';

test('highlights comments without exposing span attributes as code text', () => {
  const highlighted = highlightJs('// TONEBENCH synthesis engine\nconst gain = ctx.createGain();');

  assert.match(highlighted, /<span class="com">\/\/ TONEBENCH synthesis engine<\/span>/);
  assert.match(highlighted, /<span class="kw">const<\/span>/);
  assert.match(highlighted, /<span class="fn">createGain<\/span>/);
  assert.doesNotMatch(highlighted, /class=&quot;com&quot;&gt;/);
  assert.doesNotMatch(highlighted, /class="com"&gt;/);
});

test('escapes source before wrapping highlighted tokens', () => {
  const highlighted = highlightJs("const tag = '<script>';");

  assert.match(highlighted, /&lt;script&gt;/);
  assert.doesNotMatch(highlighted, /<script>/);
});
