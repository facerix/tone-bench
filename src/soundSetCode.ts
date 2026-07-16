// Pure, DOM-free code-generation helpers for exporting a single sound or a
// whole SoundSet as a portable JS snippet. Deliberately kept out of
// CodeOutPanel.ts (a Web Component that calls customElements.define() at
// module scope) so this logic can be unit-tested under node:test, which has
// no DOM/customElements global — see tsconfig.tests.json.

import type { SynthParams } from '/src/engine/tonebenchEngine.js';
import type { SoundSet } from '/src/DataStore.js';

/**
 * Turns an arbitrary display string into a valid camelCase JS identifier:
 * strips everything but letters/digits (treating runs of anything else,
 * including underscores, as word separators), camelCases the remaining
 * words, and prefixes a leading digit. Falls back to "sound" if nothing
 * usable is left.
 */
export function sanitizeIdentifier(raw: string): string {
  let s = String(raw || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (!s) s = 'sound';
  const words = s.split(' ').filter(Boolean);
  let out = words
    .map((w, i) => {
      const lw = w.toLowerCase();
      return i === 0 ? lw : lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join('');
  if (/^[0-9]/.test(out)) out = '_' + out;
  return out || 'sound';
}

/**
 * Returns `name` unchanged if it doesn't collide with anything in
 * `existingNames`, otherwise suffixes an incrementing number (name2, name3,
 * ...) until it's unique. Used both for keeping sound display names unique
 * within a SoundSet and for deduping sanitized identifiers at export time.
 */
export function ensureUniqueName(existingNames: string[], name: string): string {
  let candidate = name;
  let n = 2;
  while (existingNames.includes(candidate)) {
    candidate = `${name}${n}`;
    n++;
  }
  return candidate;
}

/** Portable single-sound snippet: the engine source once, this sound's
 * params, and a three-line usage example. */
export function buildSoundSnippet(engineSource: string, params: SynthParams): string {
  const paramsJson = JSON.stringify(params, null, 2);
  return [
    '// 1. Paste this file into your project as tonebenchEngine.js — it is',
    '//    dependency-free and safe to drop into any Web Audio project as-is.',
    engineSource.trimEnd(),
    '',
    '// 2. This object is your current TONEBENCH settings.',
    `const params = ${paramsJson};`,
    '',
    '// 3. Play it through any AudioContext.',
    "import { playSound } from './tonebenchEngine.js';",
    'const audioCtx = new AudioContext();',
    'playSound(audioCtx, params);',
  ].join('\n');
}

/**
 * Portable whole-set snippet: the engine source once, a `{varName}Defs`
 * object keyed by sanitized+deduped sound names, a `createSoundPack`
 * factory wrapping each definition with a `.play()` method, and sample
 * usage lines (`varName.soundName.play()`). The exported variable name is
 * always derived from the set's name — there is no separate, persisted
 * "varName" field to keep in sync (see CLAUDE.md).
 */
export function buildSoundSetSnippet(engineSource: string, soundSet: SoundSet): string {
  if (soundSet.sounds.length === 0) {
    return [
      `// The "${soundSet.name}" sound set has no sounds yet.`,
      '// Design a sound and save it into this set to generate its code.',
    ].join('\n');
  }

  const varName = sanitizeIdentifier(soundSet.name);
  const usedIdentifiers: string[] = [];
  const defsObj: Record<string, SynthParams> = {};
  soundSet.sounds.forEach(sound => {
    const identifier = ensureUniqueName(usedIdentifiers, sanitizeIdentifier(sound.name));
    usedIdentifiers.push(identifier);
    defsObj[identifier] = sound.params;
  });
  const defsJson = JSON.stringify(defsObj, null, 2);
  const usageLines = Object.keys(defsObj)
    .slice(0, 3)
    .map(name => `${varName}.${name}.play();`);

  return [
    '// 1. Paste this file into your project as tonebenchEngine.js — it is',
    '//    dependency-free and safe to drop into any Web Audio project as-is.',
    engineSource.trimEnd(),
    '',
    `// 2. Sound definitions for the "${soundSet.name}" set.`,
    `const ${varName}Defs = ${defsJson};`,
    '',
    '// 3. Factory that wraps each definition with a play() method.',
    "import { playSound } from './tonebenchEngine.js';",
    'function createSoundPack(ctx, defs) {',
    '  const pack = {};',
    '  Object.keys(defs).forEach(function (name) {',
    '    pack[name] = {',
    '      params: defs[name],',
    '      play: function (when) { return playSound(ctx, defs[name], when); },',
    '    };',
    '  });',
    '  return pack;',
    '}',
    '',
    '// 4. Create your set once, then call .play() by name anywhere in your app.',
    'const audioCtx = new AudioContext();',
    `const ${varName} = createSoundPack(audioCtx, ${varName}Defs);`,
    '',
    usageLines.join('\n'),
  ].join('\n');
}
