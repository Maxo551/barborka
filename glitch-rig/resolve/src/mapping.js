// Panel control values (0..1 sliders, choice indices) -> kernel parameters.
// The .fuse files do the same mapping in Lua (see build.js); this JS twin feeds
// the CPU tests so they render exactly what Resolve would.
'use strict';
const M = (v, a, b) => a + (b - a) * (v == null ? 0.5 : v);
const hex = (h) => { const n = parseInt(String(h || '#000000').replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

function dot(card, P, w, h, t, wordIdx) {
  const V = card.look;
  const short = Math.min(w, h);
  const glyphy = V.mode >= 2 && V.mode <= 4;
  const words = (wordIdx || []).slice(0, 32);
  return {
    main: {
      iTime: t, cell: Math.max(3, Math.round(short * M(P.size, 0.004, 0.034) * (glyphy ? 1.45 : 1))),
      mode: V.mode, pmode: V.pmode, chars: P.chars, invert: V.invert ? 1 : 0,
      dotSize: P.dotSize, depth: P.depth, darkDetail: P.darkDetail, brighten: P.brighten, shadows: P.shadows,
      bg: V.bg == null ? 0.3 : V.bg, keep: V.keep || 0, rain: P.rain, rainSpeed: P.rainSpeed,
      sparkle: P.sparkle, sparkleSize: P.sparkleSize, c0: hex(V.c0), c1: hex(V.c1 || '#ffffff'), c2: hex(V.c2 || '#ffffff'),
      words: words.concat(new Array(32 - words.length).fill(0)), wordCount: Math.max(1, words.length),
    },
    finish: {
      iTime: t, h, glow: P.glow, streaks: P.streaks, thresh: 0.6, rgb: P.rgb, scanline: P.scanLine, scanlines: P.scanlines,
      grain: P.grain, vignette: P.vignette, flicker: P.flicker, hue: P.lookColour - 0.5, streakTint: V.streakTint || [0.8, 0.9, 1],
    },
  };
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function grade(card, P, t, fps, h) {
  const V = card.look;
  return {
    main: {
      iTime: t, mode: V.mode, amount: P.amount, glitch: P.glitch * (V.glitchBoost || 1), noiseAmt: P.noise,
      contrastK: M(P.contrast, 0.5, 1.8), brightK: M(P.brightness, 0.4, 1.8), hueK: P.colour - 0.5,
      c0: hex(V.c0 || '#000000'), c1: hex(V.c1 || '#808080'), c2: hex(V.c2 || '#ffffff'),
      hud: V.hud && P.hud === 0 ? 1 : 0, fps: fps || 30, hudColor: hex(V.hudColor || '#c8ffc8'),
    },
    finish: { iTime: t, h, glow: P.glow, thresh: 0.5, rgb: P.rgb, scanlines: P.scanlines, grain: V.mode === 0 ? P.noise * 0.6 : 0, vignette: P.vignette, flicker: V.flicker || 0 },
  };
}

// trip strength over time: starts after -> come up -> peak -> come down
function tripEnvelope(t, P) {
  const start = M(P.startsAfter, 0, 3), up = M(P.comeUp, 0.2, 4), peak = M(P.peak, 0.5, 6), down = M(P.comeDown, 0.2, 6);
  const tt = t - start;
  let v;
  if (tt < 0) v = 0;
  else if (tt < up) v = smooth(0, 1, tt / up);
  else if (tt < up + peak) v = 1;
  else if (tt < up + peak + down) v = 1 - smooth(0, 1, (tt - up - peak) / down);
  else v = 0;
  return v * M(P.dose, 0.15, 1.2);
}

function trip(card, P, t, h) {
  return {
    main: { iTime: t, env: tripEnvelope(t, P), warp: P.warp, tracers: P.tracers, patSpeed: P.patternSpeed, patCol: P.patternColours, colMode: P.colours, variant: card.look.variant, seed: P.variation * 7, hasHist: 1 },
    finish: { iTime: t, h, glow: 0.15 + P.dose * 0.25, thresh: 0.6, vignette: 0.25 },
  };
}

function echo(card, P, t, h) {
  return {
    delay: Math.max(1, Math.round(M(P.delay, 1, 10))),
    main: { iTime: t, n: Math.round(M(P.clones, 1, 6)), fade: P.fade, blendMode: P.blend, tintMode: P.tint, matte: P.matte, offset: M(P.drift, -1, 1), variant: card.look.variant || 0 },
    finish: { iTime: t, h, glow: P.glow, thresh: 0.55, rgb: P.rgb },
  };
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TINTS = ['#ffffff', '#ff3045', '#ff9a1f', '#ffe14a', '#3dff7a', '#3de0ff', '#ff4ff0'];
function trans(card, P, p, t, h) {
  const env = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
  const d = DIRS[P.direction] || [1, 0];
  return {
    main: { iTime: t, p, mode: card.look.mode, intensity: M(P.intensity, 0.2, 1.4), flash: P.flash === 0 ? 1 : 0, dirx: d[0], diry: d[1], tint: hex(TINTS[P.colour] || '#ffffff') },
    finish: { iTime: t, h, glow: P.glow * env, thresh: 0.6, rgb: P.rgb * env, grain: P.grain * env },
  };
}

function mosh(card, P, w, h) {
  const short = Math.min(w, h);
  const bs = Math.max(4, Math.round(short * ([0.012, 0.022, 0.04][P.blockSize] || 0.022)));
  return {
    bs, R: Math.max(4, short * 0.03), intensity: M(P.intensity, 0.5, 4) * (card.look.drip ? 1.2 : 1),
    blend: P.blend, motion: P.motion, variant: card.look.variant, colorSpeed: P.colourSpeed, flashes: P.flashes === 0 ? 1 : 0,
    frames: P.frames, glow: card.look.variant === 1 ? 0.6 : card.look.variant === 2 ? 0.35 : 0.1,
  };
}

const TITLE_COLOURS = ['#ff3045', '#ff9a1f', '#ffe14a', '#a6ff3d', '#2bd9ff', '#3d6bff', '#ff4ff0', '#ffffff'];
function title(card, P, t, anim) {
  return {
    iTime: t, style: card.look.style, amount: M(P.amount, 0.1, 1.6), blurK: P.blur, hueK: P.hue - 0.5, satK: M(P.saturation, 0, 2),
    brightK: M(P.brightness, 0.3, 1.9), contrastK: M(P.contrast, 0.5, 1.6), tintK: P.tint, anim: anim || 0, colour: hex(TITLE_COLOURS[P.colour] || '#ffffff'),
  };
}

module.exports = { M, hex, dot, grade, trip, tripEnvelope, echo, trans, mosh, title, TINTS, TITLE_COLOURS };
