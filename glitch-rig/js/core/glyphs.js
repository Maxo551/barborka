// Glyph atlases for the dot-matrix family: a 16x16 grid of white glyphs on
// black, uploaded with mipmaps. Density sets are sorted by ink coverage so a
// glyph index can stand in for brightness.
(function () {
  'use strict';
  const GR = window.GR;

  const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ';
  const SETS = {
    symbols: '!#$%&*+-=<>?@^~/\\|{}[]();:,.·×÷±§¤°',
    letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    numbers: '0123456789',
    binary: '01',
    kana: KATAKANA,
    code: '0123456789ABCDEF<>{}[]();=+-*/#$&!?',
    blocks: '░▒▓█▀▄▌▐■□▪▫◆◇●○',
    ascii: ' .`\':-~=+*xo#%&@',
  };
  const CHOICES = ['SYMBOLS', 'LETTERS', 'NUMBERS', 'BINARY', 'KANA', 'CODE', 'BLOCKS', 'ASCII', 'WORDS'];

  const FONT_MONO = '"Share Tech Mono", "Consolas", "Menlo", "Courier New", monospace';
  const FONT_KANA = '"DotGothic16", "Hiragino Kaku Gothic ProN", "MS Gothic", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

  function coverage(ch, font) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.font = 'bold 28px ' + font;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(ch, 16, 17);
    const d = x.getImageData(0, 0, 32, 32).data;
    let s = 0;
    for (let i = 3; i < d.length; i += 4) s += d[i];
    return s;
  }

  const cache = new Map();

  // set: key of SETS, or 'words' with a phrase. Returns {tex, count}.
  function atlas(engine, set, phrase) {
    const key = set + '|' + (set === 'words' ? phrase : '');
    let entry = cache.get(engine);
    if (!entry) cache.set(engine, (entry = new Map()));
    if (entry.has(key)) return entry.get(key);

    let chars;
    const font = set === 'kana' ? FONT_KANA : FONT_MONO;
    if (set === 'words') {
      const p = String(phrase || 'GLITCH RIG').toUpperCase().replace(/\s+/g, ' ').trim() || 'GLITCH RIG';
      chars = Array.from(p + ' ').slice(0, 256);
    } else {
      chars = Array.from(SETS[set] || SETS.symbols);
      const sortable = set === 'ascii' || set === 'blocks';
      // density sets: darkest -> brightest so index = brightness
      if (sortable || set === 'symbols' || set === 'letters' || set === 'numbers' || set === 'code' || set === 'kana') {
        const cov = new Map(chars.map((ch) => [ch, coverage(ch, font)]));
        chars.sort((a, b) => cov.get(a) - cov.get(b));
      }
    }

    const cell = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = cell * 16;
    const x = cv.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, cv.width, cv.height);
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = 'bold 54px ' + font;
    chars.forEach((ch, i) => {
      const gx = i % 16, gy = Math.floor(i / 16);
      x.fillText(ch, gx * cell + cell / 2, gy * cell + cell / 2 + 3);
    });
    const tex = engine.texture({ w: cv.width, h: cv.height, mipmap: true });
    engine.upload(tex, cv);
    const out = { tex: tex.tex, w: tex.w, h: tex.h, count: chars.length };
    entry.set(key, out);
    return out;
  }

  // Wait for the display fonts used by the atlases (best effort, never throws).
  async function ready() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      const titleFonts = (GR.TITLE_FONTS || []).map((f) => document.fonts.load('400 60px ' + f, 'GLITCH').catch(() => null));
      await Promise.race([
        Promise.all([
          document.fonts.load('54px "DotGothic16"', 'アイウ'),
          document.fonts.load('bold 54px "Share Tech Mono"', 'A0#'),
          document.fonts.load('900 60px "Orbitron"', 'GLITCH'),
        ].concat(titleFonts)),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (e) { /* offline: fall back to system fonts */ }
  }

  function clear() { cache.clear(); }

  GR.Glyphs = { SETS, CHOICES, atlas, ready, clear };
})();
