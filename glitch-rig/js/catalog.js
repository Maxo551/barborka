// The catalogue: every card on the panel, which effect renders it, the fixed
// recipe of that look, and the controls it exposes on the display.
(function () {
  'use strict';
  const GR = window.GR;

  const R = (id, label, def) => ({ id, label, type: 'range', default: def == null ? 0.5 : def });
  const C = (id, label, options, def) => ({ id, label, type: 'choice', options, default: def || 0 });
  const S = (id, label, colors, def) => ({ id, label, type: 'swatch', options: colors, default: def || 0 });

  const LENGTHS = ['TO CLIP END', '1 SEC', '2 SEC', '3 SEC', '5 SEC', '10 SEC'];
  const LENGTH = C('length', 'LENGTH', LENGTHS, 0);
  GR.LENGTH_SECONDS = [null, 1, 2, 3, 5, 10];
  const TITLE_LENGTHS = ['2 SEC', '3 SEC', '5 SEC', '8 SEC', '10 SEC'];
  GR.TITLE_SECONDS = [2, 3, 5, 8, 10];

  const SWATCH = ['#ffffff', '#ff3045', '#ff9a1f', '#ffe14a', '#3dff7a', '#3de0ff', '#ff4ff0'];

  const PARAMS = {
    dotmatrix: [
      R('size', 'SIZE'), R('depth', 'DEPTH'), R('dotSize', 'DOT SIZE'), C('chars', 'CHARACTERS', GR.Glyphs.CHOICES, 0),
      R('rain', 'CODE RAIN', 0), R('sparkle', 'SPARKLE'), R('glow', 'GLOW'), LENGTH,
      R('streaks', 'STREAKS'), R('rgb', 'RGB SPLIT'), R('sparkleSize', 'SPARKLE SIZE'), R('shadows', 'SHADOWS'),
      R('darkDetail', 'DARK DETAIL'), R('brighten', 'BRIGHTEN'), R('scanLine', 'SCAN LINE', 0),
      R('scanlines', 'SCANLINES', 0), R('grain', 'GRAIN', 0), R('vignette', 'VIGNETTE'),
      R('flicker', 'FLICKER', 0.25), R('lookColour', 'LOOK COLOUR'), R('rainSpeed', 'RAIN SPEED'),
    ],
    grade: [
      R('amount', 'AMOUNT', 1), R('colour', 'COLOUR'), R('contrast', 'CONTRAST'), R('brightness', 'BRIGHTNESS'),
      R('noise', 'NOISE', 0.25), R('glow', 'GLOW', 0.25), R('rgb', 'RGB SPLIT', 0), R('scanlines', 'SCANLINES', 0),
      R('glitch', 'GLITCH', 0), R('vignette', 'VIGNETTE', 0.3), LENGTH,
    ],
    trip: [
      R('dose', 'DOSE'), R('comeUp', 'COME UP'), R('peak', 'PEAK'), R('comeDown', 'COME DOWN', 0),
      C('colours', 'COLOURS', ['NATURAL', 'RAINBOW', 'NEON', 'INVERT'], 0), R('tracers', 'TRACERS'),
      R('patternSpeed', 'PATTERN SPEED'), C('patternColours', 'PATTERN COLOURS', ['MATCH', 'RAINBOW', 'GOLD'], 0),
      R('warp', 'WARP'), LENGTH, R('startsAfter', 'STARTS AFTER', 0), R('variation', 'VARIATION'),
    ],
    clones: [
      R('clones', 'CLONES', 0.6), R('delay', 'DELAY', 0.3), R('fade', 'FADE'),
      C('blend', 'BLEND', ['LIGHTEN', 'SCREEN', 'ADD', 'DIFFERENCE'], 0),
      C('tint', 'TINT', ['NONE', 'RAINBOW', 'CYAN · PINK', 'FIRE', 'ICE'], 1),
      C('matte', 'MATTE', ['MOTION', 'BRIGHT', 'FULL'], 0), R('drift', 'DRIFT'), R('glow', 'GLOW', 0.25),
      R('rgb', 'RGB SPLIT', 0), LENGTH,
    ],
    blob: [
      C('look', 'LOOK', ['TRACE', 'MONO', 'DARK', 'NEGATIVE', 'THERMAL'], 0),
      C('boxFx', 'BOX EFFECT', ['NONE', 'INVERT', 'THERMAL', 'ZOOM', 'PIXEL', 'NIGHT'], 0),
      S('colour', 'COLOUR', SWATCH, 0),
      C('tracks', 'TRACKS', ['AUTO', 'MOTION', 'BRIGHT', 'DARK'], 0),
      C('lines', 'LINES', ['WEB', 'CHAIN', 'STAR', 'NONE'], 0), R('boxes', 'BOXES'),
      C('motion', 'MOTION', ['FLICKER', 'SMOOTH', 'JUMP'], 0),
      C('words', 'WORDS', ['CODES', 'COORDS', 'NAMES', 'NONE'], 0), R('boxSize', 'BOX SIZE'),
      C('boxShape', 'BOX SHAPE', ['BOX', 'CORNERS', 'CIRCLE', 'CROSS'], 0),
      C('glow', 'GLOW', ['OFF', 'ON'], 0), LENGTH,
    ],
    handframe: [
      C('tracking', 'TRACKING', ['HANDS', 'AUTO', 'CENTER'], 0),
      C('inside', 'INSIDE', ['NIGHT VISION', 'INFRARED', 'THERMAL', 'MONO', 'INVERT', 'POSTER'], 0),
      S('colour', 'COLOUR', ['#ffffff', '#a6ffb0', '#ff3045', '#ffe14a', '#3de0ff', '#ff4ff0'], 0),
      C('frame', 'FRAME', ['CORNERS', 'BOX', 'NONE'], 0), C('hud', 'HUD', ['FULL', 'REC', 'NONE'], 0),
      C('outside', 'OUTSIDE', ['NORMAL', 'DIM', 'MONO', 'BLUR'], 0),
      R('zoom', 'ZOOM', 0), R('padding', 'PADDING'), R('smooth', 'SMOOTH'),
      R('glow', 'GLOW', 0.25), R('rgb', 'RGB SPLIT', 0.25), LENGTH,
    ],
    mosh: [
      R('moshLength', 'MOSH LENGTH'), R('blend', 'BLEND', 0), C('blockSize', 'BLOCK SIZE', ['SMALL', 'MEDIUM', 'LARGE'], 1),
      R('intensity', 'INTENSITY'), C('frames', 'FRAMES', ['SMOOTH', 'CHOPPY', 'STUTTER'], 0), C('flashes', 'FLASHES', ['ON', 'OFF'], 0),
      C('motion', 'MOTION', ['OWN', 'SWIRL', 'SHAKE'], 0), R('colourSpeed', 'COLOUR SPEED'),
    ],
    transition: [
      R('duration', 'LENGTH'), R('intensity', 'INTENSITY'), S('colour', 'COLOUR', SWATCH, 0),
      C('direction', 'DIRECTION', ['LEFT', 'RIGHT', 'DOWN', 'UP'], 0), C('flash', 'FLASH', ['ON', 'OFF'], 1),
      R('glow', 'GLOW', 0.25), R('rgb', 'RGB SPLIT', 0.25), R('grain', 'GRAIN', 0),
    ],
    title: [
      R('size', 'SIZE'), R('tint', 'TINT', 0), R('saturation', 'SATURATION'),
      R('amount', 'AMOUNT'), R('blur', 'BLUR', 0), R('brightness', 'BRIGHTNESS'),
      S('colour', 'COLOUR', ['#ff3045', '#ff9a1f', '#ffe14a', '#a6ff3d', '#2bd9ff', '#3d6bff', '#ff4ff0', '#ffffff'], 7),
      R('hue', 'HUE'), R('contrast', 'CONTRAST'), C('length', 'LENGTH', TITLE_LENGTHS, 1),
    ],
  };

  const cards = [];
  const add = (tab, effect, name, look, defaults, extra) => cards.push(Object.assign({
    id: tab + ':' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    tab, effect, name, look: look || {}, defaults: defaults || {}, params: PARAMS[effect],
  }, extra || {}));

  // ---------------------------------------------------------------- LOOKS
  const D = (name, look, defaults, extra) => add('looks', 'dotmatrix', name, look, defaults, extra);
  D('HOLOGRAM', { mode: 0, pmode: 2, c0: '#1b3cff', bg: 0.35 }, { depth: 0.6 });
  D('CODE RAIN', { mode: 3, pmode: 1, c0: '#000800', c1: '#5dff7a', bg: 0.1 }, { chars: 5, rain: 0.8, size: 0.35, glow: 0.4, sparkle: 0, streaks: 0.2, rgb: 0.15 });
  D('KANA RAIN', { mode: 3, pmode: 5, c0: '#000400', c1: '#22ff55', c2: '#e8ffe8', bg: 0.1 }, { chars: 4, rain: 0.85, size: 0.4, sparkle: 0, streaks: 0.2, rgb: 0.15 });
  D('PRISM ORBS', { mode: 1, pmode: 3, bg: 0.15 }, { size: 0.45, sparkle: 0.3 });
  D('GOLD ORBS', { mode: 1, pmode: 5, c0: '#140800', c1: '#b8741a', c2: '#fff0b0', bg: 0.15, streakTint: [1, 0.8, 0.45] }, { size: 0.45 });
  D('GLITTER', { mode: 0, pmode: 5, c0: '#12001a', c1: '#ff6ad5', c2: '#fff4fb', bg: 0.2 }, { sparkle: 0.95, sparkleSize: 0.65, size: 0.3 });
  D('ASCII', { mode: 2, pmode: 0, bg: 0.05 }, { chars: 7, size: 0.3, sparkle: 0, streaks: 0, rgb: 0.1, glow: 0.3 });
  D('ASCII MONO', { mode: 2, pmode: 1, c0: '#000000', c1: '#f2f2f2', bg: 0 }, { chars: 7, size: 0.3, sparkle: 0, streaks: 0, rgb: 0, glow: 0.3 });
  D('ASCII FIRE', { mode: 2, pmode: 4, bg: 0.05 }, { chars: 7, size: 0.3, sparkle: 0.2, streaks: 0.3, glow: 0.6 });
  D('RED KANA', { mode: 2, pmode: 5, c0: '#000000', c1: '#b0001a', c2: '#ffb3a8', bg: 0.05 }, { chars: 4, size: 0.4, sparkle: 0.1 });
  D('BINARY', { mode: 3, pmode: 1, c0: '#000a12', c1: '#3de0ff', bg: 0.1 }, { chars: 3, rain: 0.6, size: 0.35, sparkle: 0 });
  D('WORD WALL', { mode: 4, pmode: 0, bg: 0.05, words: 'GLITCH RIG' }, { chars: 8, size: 0.35, sparkle: 0, streaks: 0.2 }, { textInput: true, textLabel: 'WORDS' });
  D('GOLD WORDS', { mode: 4, pmode: 5, c0: '#0a0500', c1: '#a0661a', c2: '#ffe9a8', bg: 0.05, streakTint: [1, 0.8, 0.45], words: 'LOVE' }, { chars: 8, size: 0.35, sparkle: 0.3 }, { textInput: true, textLabel: 'WORDS' });
  D('HEAT MAP', { mode: 0, pmode: 4, bg: 0.15 }, { size: 0.3, sparkle: 0, streaks: 0.2 });
  D('SCANNER', { mode: 5, pmode: 1, c0: '#000800', c1: '#7dff9a', bg: 0.05 }, { size: 0.3, scanLine: 1, scanlines: 0.6, sparkle: 0, streaks: 0 });
  D('STARDUST', { mode: 0, pmode: 5, c0: '#05001a', c1: '#7a5cff', c2: '#ffffff', bg: 0.1 }, { shadows: 0.8, sparkle: 1, size: 0.22 });
  D('GHOST ICE', { mode: 0, pmode: 5, c0: '#000814', c1: '#5fb8ff', c2: '#f0fbff', bg: 0.25 }, { glow: 0.8, sparkle: 0.3 });
  D('VOID', { mode: 2, pmode: 1, c0: '#000000', c1: '#8a8aa0', invert: true, bg: 0 }, { chars: 6, size: 0.35, sparkle: 0, shadows: 0.6 });
  D('CHROME ORBS', { mode: 1, pmode: 5, c0: '#050608', c1: '#7c8796', c2: '#ffffff', bg: 0.1 }, { size: 0.45 });
  D('LAVA ORBS', { mode: 1, pmode: 5, c0: '#100000', c1: '#e3340a', c2: '#ffd27a', bg: 0.1, streakTint: [1, 0.6, 0.3] }, { size: 0.45 });
  D('LED WALL', { mode: 5, pmode: 0, bg: 0 }, { size: 0.35, sparkle: 0, glow: 0.6, streaks: 0.2 });

  const G = (name, look, defaults) => add('looks', 'grade', name, look, defaults,
    look.hud ? { params: PARAMS.grade.concat([C('hud', 'HUD', ['ON', 'OFF'], 0)]) } : null);
  G('NIGHT VISION', { mode: 0, hud: true, hudLabel: 'NV · IR' }, { noise: 0.4, glow: 0.45, vignette: 0.7 });
  G('THERMAL', { mode: 1 }, { glow: 0.2 });
  G('INFRARED', { mode: 2 }, { glow: 0.4 });
  G('XEROX', { mode: 3 }, { noise: 0.5, glow: 0 });
  G('BLACKLIGHT', { mode: 4 }, { glow: 0.6 });
  G('CRT TV', { mode: 5 }, { glow: 0.35, vignette: 0.2 });
  G('BITCRUSH', { mode: 6 }, { amount: 1, glow: 0.1 });
  G('VHS TAPE', { mode: 7 }, { noise: 0.4, glow: 0.2, rgb: 0.3 });
  G('CORRUPTED', { mode: 8 }, { glitch: 0.5, rgb: 0.4 });
  G('TOXIC', { mode: 9, c0: '#000000', c1: '#2a9d00', c2: '#e6ff3d' }, { glow: 0.35 });
  G('CYANIDE', { mode: 9, c0: '#020414', c1: '#0a6bff', c2: '#c9fbff' }, { glow: 0.35 });
  G('SUNBURN', { mode: 9, c0: '#1a0300', c1: '#ff5a1f', c2: '#fff1c4' }, { glow: 0.5 });
  G('AMETHYST', { mode: 9, c0: '#07001a', c1: '#7b2bd6', c2: '#ffd6ff' }, { glow: 0.4 });
  G('LIQUID CHROME', { mode: 10, c0: '#05070c', c1: '#6f84a8', c2: '#f4f8ff' }, { glow: 0.2 });
  G('MODULATION', { mode: 11 }, { rgb: 0.2, glow: 0.2 });

  add('looks', 'trip', 'FULL TRIP', { variant: 0 });
  add('looks', 'trip', 'ACID MELT', { variant: 1 }, { warp: 0.65 });
  add('looks', 'trip', 'ACID WARP', { variant: 2 }, { warp: 0.6, colours: 1 });
  add('looks', 'trip', 'ACID TRIP', { variant: 3 }, { colours: 2, patternColours: 1 });
  add('looks', 'clones', 'CLONE TRAIL', { variant: 0 });
  add('looks', 'clones', 'CHROMA ECHO', { variant: 1 }, { delay: 0.2, fade: 0.6 });
  add('looks', 'blob', 'BLOB TRACK', {});
  add('looks', 'handframe', 'HAND FRAME', {});

  // ---------------------------------------------------------------- TRANSITIONS
  add('transitions', 'mosh', 'DATAMOSH MELT', { variant: 0, drip: true });
  add('transitions', 'mosh', 'DATAMOSH BLOOM', { variant: 1 });
  add('transitions', 'mosh', 'DATAMOSH NEON', { variant: 2 });
  add('transitions', 'mosh', 'DATAMOSH ACID', { variant: 3 });
  const T = (name, mode, defaults) => add('transitions', 'transition', name, { mode }, defaults);
  T('FLASH CUT', 0, { glow: 0.6 });
  T('STATIC', 1);
  T('STROBE', 2);
  T('MOSAIC', 3);
  T('PULSE RING', 4, { glow: 0.5 });
  T('CHROMA SPLIT', 5);
  T('WHIP PAN', 6);
  T('ZOOM PUNCH', 7);
  T('SLICE TEAR', 8);
  T('RIPPLE', 9);
  T('HYPERDRIVE', 10, { glow: 0.5 });
  T('PHANTOM SHIFT', 11);
  T('FILM BURN', 12, { glow: 0.5 });
  T('GLITCH BLOCKS', 13);

  // ---------------------------------------------------------------- TITLES
  const TT = (name, style, defaults) => add('titles', 'title', name, { style }, defaults, { textInput: true, textLabel: 'TYPE' });
  TT('FUZZ', 0, { colour: 7 });
  TT('LIQUID METAL', 1, { colour: 4 });
  TT('NEON SIGN', 2, { colour: 6 });
  TT('INTERLACE', 3, { colour: 4 });
  TT('BRIAR', 4, { colour: 6 });
  TT('SMOKE', 5, { colour: 7 });
  TT('ICE', 6, { colour: 4 });
  TT('GOTHIC', 7, { colour: 0 });
  TT('CANDY', 8, { colour: 6 });
  TT('TAPE GLOW', 9, { colour: 5 });

  GR.catalog = {
    cards,
    tabs: ['looks', 'transitions', 'titles'],
    byId: (id) => cards.find((c) => c.id === id),
    // Every control for a card with the card's own defaults applied.
    defaults(card) {
      const v = {};
      for (const p of card.params) v[p.id] = card.defaults[p.id] != null ? card.defaults[p.id] : p.default;
      if (card.textInput) v.text = card.look.words || 'GLITCH RIG';
      return v;
    },
    random(card, rnd) {
      const v = this.defaults(card);
      for (const p of card.params) {
        if (p.id === 'length' || p.id === 'tracking') continue;
        if (p.type === 'range') v[p.id] = Math.round(rnd() * 16) / 16;
        else v[p.id] = Math.floor(rnd() * p.options.length);
      }
      if (card.effect === 'dotmatrix') v.chars = card.defaults.chars != null ? card.defaults.chars : 0;
      return v;
    },
  };
})();
