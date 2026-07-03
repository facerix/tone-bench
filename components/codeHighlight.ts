const WEB_AUDIO_METHODS = [
  'createGain',
  'createOscillator',
  'createBiquadFilter',
  'createBufferSource',
  'createBuffer',
  'createWaveShaper',
  'createDelay',
  'createConvolver',
  'connect',
  'start',
  'stop',
  'setValueAtTime',
  'linearRampToValueAtTime',
  'exponentialRampToValueAtTime',
  'getChannelData',
  'getByteTimeDomainData',
];

const KEYWORDS = new Set([
  'async',
  'await',
  'class',
  'const',
  'else',
  'export',
  'for',
  'from',
  'function',
  'if',
  'import',
  'let',
  'new',
  'return',
  'var',
]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function span(className: string, text: string): string {
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

function readQuoted(src: string, start: number): number {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2;
    } else if (src[i] === quote) {
      return i + 1;
    } else {
      i += 1;
    }
  }
  return src.length;
}

function readWord(src: string, start: number): number {
  let i = start + 1;
  while (i < src.length && /[A-Za-z0-9_$]/.test(src[i]!)) i += 1;
  return i;
}

function readNumber(src: string, start: number): number {
  let i = start + 1;
  while (i < src.length && /[0-9.]/.test(src[i]!)) i += 1;
  return i;
}

export function highlightJs(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('//', i)) {
      const end = src.indexOf('\n', i);
      const commentEnd = end === -1 ? src.length : end;
      out += span('com', src.slice(i, commentEnd));
      i = commentEnd;
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const end = readQuoted(src, i);
      out += span('str', src.slice(i, end));
      i = end;
    } else if (/[A-Za-z_$]/.test(src[i]!)) {
      const end = readWord(src, i);
      const word = src.slice(i, end);
      const whitespaceLength = src.slice(end).match(/^\s*/)?.[0].length ?? 0;
      if (WEB_AUDIO_METHODS.includes(word) && src[end + whitespaceLength] === '(') {
        out += span('fn', word);
      } else if (KEYWORDS.has(word)) {
        out += span('kw', word);
      } else {
        out += escapeHtml(word);
      }
      i = end;
    } else if (/\d/.test(src[i]!)) {
      const end = readNumber(src, i);
      out += span('num', src.slice(i, end));
      i = end;
    } else {
      out += escapeHtml(src[i]!);
      i += 1;
    }
  }
  return out;
}
