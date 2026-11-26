#!/usr/bin/env node
// Builds the DaVinci Resolve version of Glitch Rig from the panel's catalogue:
//   Fuses/GlitchRig/*.fuse                     GPU tools (Lua + DCTL kernels)
//   Templates/Edit/{Effects,Transitions,Titles}/Glitch Rig/*.setting
// Run: node resolve/build.js
'use strict';
const fs = require('fs');
const path = require('path');
const { K, GLYPH_FNS } = require('./src/kernels');
const font = require('./src/font');
const GR = require('./src/catalog-node').load();

const ROOT = __dirname;
const OUT_FUSES = path.join(ROOT, 'Fuses', 'GlitchRig');
const OUT_TPL = path.join(ROOT, 'Templates', 'Edit');
const PRELUDE = fs.readFileSync(path.join(ROOT, 'src', 'prelude.dctl'), 'utf8');
const RUNTIME = fs.readFileSync(path.join(ROOT, 'src', 'lua-runtime.lua'), 'utf8');

const COLOR_NAMES = {
  '#ffffff': 'WHITE', '#ff3045': 'RED', '#ff9a1f': 'ORANGE', '#ffe14a': 'YELLOW', '#3dff7a': 'GREEN',
  '#3de0ff': 'CYAN', '#ff4ff0': 'MAGENTA', '#a6ff3d': 'LIME', '#2bd9ff': 'SKY', '#3d6bff': 'BLUE', '#a6ffb0': 'MINT',
};
const hex = (h) => { const n = parseInt(String(h || '#000000').replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const luaStr = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const num = (v) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(6)));

// ------------------------------------------------------------------ controls
// Controls a fuse exposes: user controls come from the catalogue; recipe
// controls hold the fixed part of each look and are set by the templates.
const S = (id, label, def, extra) => Object.assign({ id, label, kind: 'slider', def: def == null ? 0.5 : def }, extra || {});
const C = (id, label, options, def) => ({ id, label, kind: 'combo', options, def: def || 0 });
const B = (id, label, def) => ({ id, label, kind: 'check', def: def ? 1 : 0 });
const T = (id, label, def) => ({ id, label, kind: 'text', def: def || '' });
const colorRecipe = (pfx, label) => [S(pfx + 'R', label + ' R', 0), S(pfx + 'G', label + ' G', 0), S(pfx + 'B', label + ' B', 0)];

// which catalogue params don't apply in Resolve (length is the clip/transition length there)
const SKIP = new Set(['length', 'duration', 'moshLength', 'size@title']);

function userControls(effect) {
  const seen = new Map();
  for (const card of GR.catalog.cards.filter((c) => c.effect === effect)) {
    for (const p of card.params) {
      if (SKIP.has(p.id) || SKIP.has(p.id + '@' + effect) || seen.has(p.id)) continue;
      if (p.type === 'range') seen.set(p.id, S(p.id, p.label, p.default));
      else if (p.type === 'choice') seen.set(p.id, C(p.id, p.label, p.options, p.default));
      else seen.set(p.id, C(p.id, p.label, p.options.map((h) => COLOR_NAMES[h.toLowerCase()] || h), p.default));
    }
  }
  return [...seen.values()];
}

const PROGRESS = [B('autoProgress', 'AUTO PROGRESS', 1), S('progress', 'PROGRESS', 0)];

const FUSES = {
  GR_DotMatrix: {
    effect: 'dotmatrix', desc: 'Dot matrix, glyph and code-rain looks', icon: 'GRd', inputs: ['Input'], glyphs: true,
    kernels: ['GRDot', 'GRExtract', 'GRBlur', 'GRStreak', 'GRComposite'],
    recipe: [
      C('mode', 'CELL', ['DOTS', 'ORBS', 'GLYPH DENSITY', 'GLYPH RAIN', 'WORDS', 'LED']),
      C('pmode', 'PALETTE', ['SOURCE', 'DUOTONE', 'HOLO', 'PRISM', 'HEAT', 'TRITONE']),
      ...colorRecipe('c0', 'COLOR 1'), ...colorRecipe('c1', 'COLOR 2'), ...colorRecipe('c2', 'COLOR 3'),
      S('bg', 'BACKGROUND', 0.3), S('keep', 'KEEP COLOR', 0), B('invert', 'INVERT', 0),
      S('stR', 'STREAK R', 0.8), S('stG', 'STREAK G', 0.9), S('stB', 'STREAK B', 1),
    ],
    extra: [T('words', 'WORDS', 'GLITCH RIG')],
  },
  GR_Grade: {
    effect: 'grade', desc: 'Colour looks: night vision, thermal, VHS, CRT...', icon: 'GRc', inputs: ['Input'], glyphs: true,
    kernels: ['GRGrade', 'GRExtract', 'GRBlur', 'GRStreak', 'GRComposite'],
    recipe: [
      C('mode', 'LOOK', ['NIGHT VISION', 'THERMAL', 'INFRARED', 'XEROX', 'BLACKLIGHT', 'CRT', 'BITCRUSH', 'VHS', 'CORRUPTED', 'TRITONE', 'SOLARIZE', 'MODULATION']),
      ...colorRecipe('c0', 'COLOR 1'), ...colorRecipe('c1', 'COLOR 2'), ...colorRecipe('c2', 'COLOR 3'),
      B('hasHud', 'CAMERA HUD', 0),
    ],
  },
  GR_Trip: {
    effect: 'trip', desc: 'Trip: warp, melt, patterns and tracers', icon: 'GRt', inputs: ['Input'],
    kernels: ['GRTrip', 'GRExtract', 'GRBlur', 'GRStreak', 'GRComposite'],
    recipe: [C('variant', 'VARIANT', ['FULL TRIP', 'ACID MELT', 'ACID WARP', 'ACID TRIP'])],
  },
  GR_Echo: {
    effect: 'clones', desc: 'Clone trail and chroma echo', icon: 'GRe', inputs: ['Input'],
    kernels: ['GREcho', 'GRExtract', 'GRBlur', 'GRStreak', 'GRComposite'],
    recipe: [C('variant', 'VARIANT', ['CLONE TRAIL', 'CHROMA ECHO'])],
  },
  GR_Transition: {
    effect: 'transition', desc: 'Glitch transitions', icon: 'GRx', inputs: ['Background', 'Foreground'],
    kernels: ['GRTrans', 'GRExtract', 'GRBlur', 'GRStreak', 'GRComposite'],
    recipe: [C('mode', 'TRANSITION', ['FLASH CUT', 'STATIC', 'STROBE', 'MOSAIC', 'PULSE RING', 'CHROMA SPLIT', 'WHIP PAN', 'ZOOM PUNCH', 'SLICE TEAR', 'RIPPLE', 'HYPERDRIVE', 'PHANTOM SHIFT', 'FILM BURN', 'GLITCH BLOCKS'])],
    extra: PROGRESS,
  },
  GR_Datamosh: {
    effect: 'mosh', desc: 'Datamosh transitions (block motion smear)', icon: 'GRm', inputs: ['Background', 'Foreground'],
    kernels: ['GRMoshMatch', 'GRMoshAdvect', 'GRMoshLook', 'GRExtract', 'GRBlur', 'GRStreak', 'GRComposite'],
    recipe: [C('variant', 'VARIANT', ['MELT', 'BLOOM', 'NEON', 'ACID']), B('drip', 'DRIP', 0)],
    extra: PROGRESS,
  },
  GR_Title: {
    effect: 'title', desc: 'Title styles for a Text+ input', icon: 'GRT', inputs: ['Input'],
    kernels: ['GRTitle'],
    recipe: [C('style', 'STYLE', ['FUZZ', 'LIQUID METAL', 'NEON SIGN', 'INTERLACE', 'BRIAR', 'SMOKE', 'ICE', 'GOTHIC', 'CANDY', 'TAPE GLOW'])],
  },
};
SKIP.add('size@title');

// ------------------------------------------------------------------ Process() bodies (Lua twin of src/mapping.js)
const PROCESS = {
  GR_DotMatrix: `
  local src = GR_IMG.Input:GetValue(req)
  local W, H = grSize(src)
  local rs = grRange(self)
  local t = (req.Time - rs) / grFps(self)
  local P = grValues(req)
  local mode = grRound(P.mode)
  local glyphy = mode >= 2 and mode <= 4
  local cell = math.max(3, grRound(math.min(W, H) * grM(P.size, 0.004, 0.034) * (glyphy and 1.45 or 1)))
  local words = {}
  for ch in string.upper(P.words or ""):gmatch(".") do words[#words + 1] = GR_CHARS[ch] or GR_CHARS[" "] end
  local img = grRun(req, self.Comp, "GRDot", GR_K.GRDot, GR_P.GRDot, function(p)
    grCommon(p, W, H, t, H / 540)
    p.cell = cell
    p.mode = mode
    p.pmode = grRound(P.pmode)
    p.chars = grRound(P.chars)
    p.invert = grRound(P.invert)
    p.dotSize = P.dotSize
    p.depth = P.depth
    p.darkDetail = P.darkDetail
    p.brighten = P.brighten
    p.shadows = P.shadows
    p.bg = P.bg
    p.keep = P.keep
    p.rain = P.rain
    p.rainSpeed = P.rainSpeed
    p.sparkle = P.sparkle
    p.sparkleSize = P.sparkleSize
    p.c0[0] = P.c0R; p.c0[1] = P.c0G; p.c0[2] = P.c0B
    p.c1[0] = P.c1R; p.c1[1] = P.c1G; p.c1[2] = P.c1B
    p.c2[0] = P.c2R; p.c2[1] = P.c2G; p.c2[2] = P.c2B
    for i = 0, 31 do p.words[i] = words[i + 1] or GR_CHARS[" "] end
    p.wordCount = math.max(1, math.min(32, #words))
  end, { { "src", src } }, src)
  OutImage:Set(req, grFinish(req, self.Comp, img, t, {
    glow = P.glow, streaks = P.streaks, thresh = 0.6, rgb = P.rgb, scanline = P.scanLine, scanlines = P.scanlines,
    grain = P.grain, vignette = P.vignette, flicker = P.flicker, hue = P.lookColour - 0.5, streakTint = { P.stR, P.stG, P.stB },
  }) or src)`,

  GR_Grade: `
  local src = GR_IMG.Input:GetValue(req)
  local W, H = grSize(src)
  local rs = grRange(self)
  local fps = grFps(self)
  local t = (req.Time - rs) / fps
  local P = grValues(req)
  local mode = grRound(P.mode)
  local img = grRun(req, self.Comp, "GRGrade", GR_K.GRGrade, GR_P.GRGrade, function(p)
    grCommon(p, W, H, t, H / 540)
    p.mode = mode
    p.amount = P.amount
    p.glitch = P.glitch
    p.noiseAmt = P.noise
    p.contrastK = grM(P.contrast, 0.5, 1.8)
    p.brightK = grM(P.brightness, 0.4, 1.8)
    p.hueK = P.colour - 0.5
    p.c0[0] = P.c0R; p.c0[1] = P.c0G; p.c0[2] = P.c0B
    p.c1[0] = P.c1R; p.c1[1] = P.c1G; p.c1[2] = P.c1B
    p.c2[0] = P.c2R; p.c2[1] = P.c2G; p.c2[2] = P.c2B
    p.hud = (grRound(P.hasHud) == 1 and grRound(P.hud) == 0) and 1 or 0
    p.fps = fps
    p.hudColor[0] = 0.784; p.hudColor[1] = 1.0; p.hudColor[2] = 0.784
  end, { { "src", src } }, src)
  OutImage:Set(req, grFinish(req, self.Comp, img, t, {
    glow = P.glow, thresh = 0.5, rgb = P.rgb, scanlines = P.scanlines, grain = mode == 0 and P.noise * 0.6 or 0, vignette = P.vignette,
  }) or src)`,

  GR_Trip: `
  local src = GR_IMG.Input:GetValue(req)
  local W, H = grSize(src)
  local rs = grRange(self)
  local t = (req.Time - rs) / grFps(self)
  local P = grValues(req)
  local function smooth(x) x = math.max(0, math.min(1, x)) return x * x * (3 - 2 * x) end
  local start, up, peak, down = grM(P.startsAfter, 0, 3), grM(P.comeUp, 0.2, 4), grM(P.peak, 0.5, 6), grM(P.comeDown, 0.2, 6)
  local tt, env = t - start, 0
  if tt >= 0 and tt < up then env = smooth(tt / up)
  elseif tt >= up and tt < up + peak then env = 1
  elseif tt >= up + peak and tt < up + peak + down then env = 1 - smooth((tt - up - peak) / down) end
  env = env * grM(P.dose, 0.15, 1.2)
  local h1 = grAt(GR_IMG.Input, req, req.Time - 2) or src
  local h2 = grAt(GR_IMG.Input, req, req.Time - 4) or h1
  local h3 = grAt(GR_IMG.Input, req, req.Time - 6) or h2
  local img = grRun(req, self.Comp, "GRTrip", GR_K.GRTrip, GR_P.GRTrip, function(p)
    grCommon(p, W, H, t, H / 540)
    p.env = env
    p.warp = P.warp
    p.tracers = P.tracers
    p.patSpeed = P.patternSpeed
    p.patCol = grRound(P.patternColours)
    p.colMode = grRound(P.colours)
    p.variant = grRound(P.variant)
    p.seed = P.variation * 7
    p.hasHist = 1
  end, { { "src", src }, { "h1", h1 }, { "h2", h2 }, { "h3", h3 } }, src)
  OutImage:Set(req, grFinish(req, self.Comp, img, t, { glow = 0.15 + P.dose * 0.25, thresh = 0.6, vignette = 0.25 }) or src)`,

  GR_Echo: `
  local src = GR_IMG.Input:GetValue(req)
  local W, H = grSize(src)
  local rs = grRange(self)
  local t = (req.Time - rs) / grFps(self)
  local P = grValues(req)
  local delay = math.max(1, grRound(grM(P.delay, 1, 10)))
  local h = {}
  for k = 1, 6 do h[k] = grAt(GR_IMG.Input, req, req.Time - k * delay) or h[k - 1] or src end
  local img = grRun(req, self.Comp, "GREcho", GR_K.GREcho, GR_P.GREcho, function(p)
    grCommon(p, W, H, t, H / 540)
    p.n = grRound(grM(P.clones, 1, 6))
    p.fade = P.fade
    p.blendMode = grRound(P.blend)
    p.tintMode = grRound(P.tint)
    p.matte = grRound(P.matte)
    p.offset = grM(P.drift, -1, 1)
    p.variant = grRound(P.variant)
  end, { { "src", src }, { "h1", h[1] }, { "h2", h[2] }, { "h3", h[3] }, { "h4", h[4] }, { "h5", h[5] }, { "h6", h[6] } }, src)
  OutImage:Set(req, grFinish(req, self.Comp, img, t, { glow = P.glow, thresh = 0.55, rgb = P.rgb }) or src)`,

  GR_Transition: `
  local A = GR_IMG.Background:GetValue(req)
  local Bi = GR_IMG.Foreground:GetValue(req)
  if not Bi then OutImage:Set(req, A) return end
  if not A then OutImage:Set(req, Bi) return end
  local W, H = grSize(A)
  local rs, re = grRange(self)
  local t = (req.Time - rs) / grFps(self)
  local P = grValues(req)
  local prog = P.progress
  if grRound(P.autoProgress) == 1 then prog = (req.Time - rs) / math.max(1, re - rs) end
  if prog <= 0 then OutImage:Set(req, A) return end
  if prog >= 1 then OutImage:Set(req, Bi) return end
  local env = math.sin(prog * math.pi)
  local dirs = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }
  local d = dirs[grRound(P.direction) + 1] or dirs[1]
  local tint = GR_SWATCH[grRound(P.colour) + 1] or { 1, 1, 1 }
  local img = grRun(req, self.Comp, "GRTrans", GR_K.GRTrans, GR_P.GRTrans, function(p)
    grCommon(p, W, H, t, H / 540)
    p.p = prog
    p.mode = grRound(P.mode)
    p.intensity = grM(P.intensity, 0.2, 1.4)
    p.flash = grRound(P.flash) == 0 and 1 or 0
    p.dirx = d[1]
    p.diry = d[2]
    p.tint[0] = tint[1]; p.tint[1] = tint[2]; p.tint[2] = tint[3]
  end, { { "A", A }, { "B", Bi } }, A)
  OutImage:Set(req, grFinish(req, self.Comp, img, t, { glow = P.glow * env, thresh = 0.6, rgb = P.rgb * env, grain = P.grain * env }) or A)`,

  GR_Datamosh: `
  local A = GR_IMG.Background:GetValue(req)
  local Bi = GR_IMG.Foreground:GetValue(req)
  if not Bi then OutImage:Set(req, A) return end
  if not A then OutImage:Set(req, Bi) return end
  local W, H = grSize(A)
  local rs, re = grRange(self)
  local fps = grFps(self)
  local P = grValues(req)
  local span = math.max(1, re - rs)
  local function progAt(time)
    if grRound(P.autoProgress) == 1 then return (time - rs) / span end
    return P.progress
  end
  local prog = progAt(req.Time)
  if prog <= 0 then OutImage:Set(req, A) return end
  if prog >= 1 then OutImage:Set(req, Bi) return end
  local short = math.min(W, H)
  local bsf = ({ 0.012, 0.022, 0.04 })[grRound(P.blockSize) + 1] or 0.022
  local bs = math.max(4, grRound(short * bsf))
  local R = math.max(4, short * 0.03)
  local bw, bh = math.ceil(W / bs), math.ceil(H / bs)
  local intensity = grM(P.intensity, 0.5, 4) * (grRound(P.drip) == 1 and 1.2 or 1)
  local s = H / 540

  -- one datamosh step: estimate B's block motion and push the plate with it
  local function step(st, time, Bf)
    st.frame = st.frame + 1
    local fr = st.frame
    local frames = grRound(P.frames)
    local hold = (frames == 1 and fr % 2 == 1) or (frames == 2 and math.floor(fr / 3) % 2 == 1)
    if not hold then
      local tt = (time - rs) / fps
      local flow = grRun(req, self.Comp, "GRMoshMatch", GR_K.GRMoshMatch, GR_P.GRMoshMatch, function(p)
        grCommon(p, bw, bh, tt, s)
        p.bs = bs; p.R = R; p.fullW = W; p.fullH = H
      end, { { "cur", Bf }, { "prev", st.prevB } }, Bf, bw, bh)
      if flow then
        local fw, fh = grSize(flow)
        local moved = grRun(req, self.Comp, "GRMoshAdvect", GR_K.GRMoshAdvect, GR_P.GRMoshAdvect, function(p)
          grCommon(p, W, H, tt, s)
          p.flowW = fw; p.flowH = fh; p.bs = bs; p.R = R; p.intensity = intensity; p.blend = P.blend
          p.prog = progAt(time); p.motion = grRound(P.motion); p.frameSeed = fr * 0.37
        end, { { "mosh", st.mosh }, { "flow", flow }, { "curB", Bf } }, Bf)
        if moved then st.mosh = moved end
      end
      st.prevB = Bf
    end
    st.time = time
    return st
  end

  -- the plate is the outgoing clip at the start of the transition; frames are
  -- built in order and cached, so playback costs one step per frame
  GR_MOSH = GR_MOSH or {}
  local st = GR_MOSH.state
  if not st or st.time ~= req.Time - 1 or st.rs ~= rs then
    local plate = grAt(GR_IMG.Background, req, rs) or A
    st = { time = rs, rs = rs, mosh = plate, prevB = grAt(GR_IMG.Foreground, req, rs) or Bi, frame = 0 }
    for f = rs + 1, req.Time - 1 do
      local Bf = grAt(GR_IMG.Foreground, req, f)
      if Bf then st = step(st, f, Bf) end
    end
  end
  st = step(st, req.Time, Bi)
  GR_MOSH.state = st
  local t = (req.Time - rs) / fps
  local look = grRun(req, self.Comp, "GRMoshLook", GR_K.GRMoshLook, GR_P.GRMoshLook, function(p)
    grCommon(p, W, H, t, s)
    p.variant = grRound(P.variant); p.prog = prog; p.colorSpeed = P.colourSpeed
    p.flashes = grRound(P.flashes) == 0 and 1 or 0; p.frameSeed = st.frame
  end, { { "mosh", st.mosh }, { "curB", Bi } }, A)
  local v = grRound(P.variant)
  OutImage:Set(req, grFinish(req, self.Comp, look, t, { glow = v == 1 and 0.6 or (v == 2 and 0.35 or 0.1), thresh = 0.55 }) or A)`,

  GR_Title: `
  local src = GR_IMG.Input:GetValue(req)
  local W, H = grSize(src)
  local rs, re = grRange(self)
  local fps = grFps(self)
  local t = (req.Time - rs) / fps
  local dur = math.max(1, re - rs) / fps
  local P = grValues(req)
  local anim = 0
  if t < 0.35 then anim = 1 - t / 0.35 elseif t > dur - 0.3 then anim = (t - (dur - 0.3)) / 0.3 end
  local col = GR_TITLE_COLOURS[grRound(P.colour) + 1] or { 1, 1, 1 }
  OutImage:Set(req, grRun(req, self.Comp, "GRTitle", GR_K.GRTitle, GR_P.GRTitle, function(p)
    grCommon(p, W, H, t, H / 540)
    p.style = grRound(P.style)
    p.amount = grM(P.amount, 0.1, 1.6)
    p.blurK = P.blur
    p.hueK = P.hue - 0.5
    p.satK = grM(P.saturation, 0, 2)
    p.brightK = grM(P.brightness, 0.3, 1.9)
    p.contrastK = grM(P.contrast, 0.5, 1.6)
    p.tintK = P.tint
    p.anim = math.max(0, math.min(1, anim))
    p.colour[0] = col[1]; p.colour[1] = col[2]; p.colour[2] = col[3]
  end, { { "T", src } }, src) or src)`,
};

// ------------------------------------------------------------------ .fuse writer
function controlsOf(name) {
  const f = FUSES[name];
  return f.recipe.concat(userControls(f.effect), f.extra || []);
}

function luaInput(c) {
  const lines = [`  GR_IN[${luaStr(c.id)}] = self:AddInput(${luaStr(c.label)}, ${luaStr(c.id)}, {`];
  if (c.kind === 'text') {
    lines.push('    LINKID_DataType = "Text",', '    INPID_InputControl = "TextEditControl",', '    TEC_Lines = 1,', `    INP_Default = ${luaStr(c.def)},`);
  } else if (c.kind === 'combo') {
    lines.push('    LINKID_DataType = "Number",', '    INPID_InputControl = "ComboControl",', `    INP_Default = ${c.def},`, '    INP_Integer = true,', '    ICD_Width = 1,');
    c.options.forEach((o) => lines.push(`    { CCS_AddString = ${luaStr(o)} },`));
  } else if (c.kind === 'check') {
    lines.push('    LINKID_DataType = "Number",', '    INPID_InputControl = "CheckboxControl",', `    INP_Default = ${c.def},`, '    INP_Integer = true,');
  } else {
    lines.push('    LINKID_DataType = "Number",', '    INPID_InputControl = "SliderControl",', `    INP_Default = ${num(c.def)},`, '    INP_MinScale = 0,', '    INP_MaxScale = 1,');
  }
  lines.push('  })');
  return lines.join('\n');
}

function fuseSource(name) {
  const f = FUSES[name];
  const kernelCode = (k) => PRELUDE + (f.glyphs && (k === 'GRDot' || k === 'GRGrade') ? GLYPH_FNS : '') + K[k].code;
  const kTable = f.kernels.map((k) => `GR_K.${k} = [==[\n${kernelCode(k)}\n]==]\nGR_P.${k} = [==[\n${K[k].params}\n]==]`).join('\n');
  const chars = font.build();
  const charMap = [...chars.index.entries()].filter(([ch]) => /^[ -~]$/.test(ch)).map(([ch, i]) => `[${luaStr(ch)}] = ${i}`).join(', ');
  const swatch = Object.keys(COLOR_NAMES).slice(0, 7).map((h) => `{ ${hex(h).map((v) => num(v)).join(', ')} }`).join(', ');
  const titleCols = ['#ff3045', '#ff9a1f', '#ffe14a', '#a6ff3d', '#2bd9ff', '#3d6bff', '#ff4ff0', '#ffffff'].map((h) => `{ ${hex(h).map((v) => num(v)).join(', ')} }`).join(', ');
  const imgInputs = f.inputs.map((id, i) => `  GR_IMG[${luaStr(id)}] = self:AddInput(${luaStr(id)}, ${luaStr(id)}, {
    LINKID_DataType = "Image",
    LINK_Main = ${i + 1},
    INP_Required = ${i === 0 ? 'true' : 'false'},
  })`).join('\n');
  return `--[[
  GLITCH RIG — ${name}: ${f.desc}
  DaVinci Resolve / Fusion Fuse with DCTL GPU kernels.
  Generated by glitch-rig/resolve/build.js from the panel's catalogue — edit the
  sources there, not this file.
]]

FuRegisterClass(${luaStr(name)}, CT_Tool, {
  REGS_Category = "Glitch Rig",
  REGS_OpIconString = ${luaStr(f.icon)},
  REGS_OpDescription = ${luaStr('Glitch Rig · ' + f.desc)},
  REG_NoObjMatCtrls = true,
  REG_NoMotionBlurCtrls = true,
  REG_OpNoMask = true,
  REG_TimeVariant = true,
  REG_Version = 1,
})

GR_K = {}
GR_P = {}
${kTable}

GR_CHARS = { ${charMap} }
GR_SWATCH = { ${swatch} }
GR_TITLE_COLOURS = { ${titleCols} }

${RUNTIME}

function Create()
  GR_IN = {}
  GR_IMG = {}
${controlsOf(name).map(luaInput).join('\n')}
${imgInputs}
  OutImage = self:AddOutput("Output", "Output", {
    LINKID_DataType = "Image",
    LINK_Main = 1,
  })
end

function Process(req)${PROCESS[name]}
end
`;
}

// ------------------------------------------------------------------ .setting writer
const FUSE_FOR = { dotmatrix: 'GR_DotMatrix', grade: 'GR_Grade', trip: 'GR_Trip', clones: 'GR_Echo', transition: 'GR_Transition', mosh: 'GR_Datamosh', title: 'GR_Title' };

function recipeValues(card) {
  const L = card.look;
  const v = {};
  const col = (pfx, h) => { const c = hex(h); v[pfx + 'R'] = c[0]; v[pfx + 'G'] = c[1]; v[pfx + 'B'] = c[2]; };
  if (card.effect === 'dotmatrix') {
    v.mode = L.mode; v.pmode = L.pmode; col('c0', L.c0 || '#000000'); col('c1', L.c1 || '#ffffff'); col('c2', L.c2 || '#ffffff');
    v.bg = L.bg == null ? 0.3 : L.bg; v.keep = L.keep || 0; v.invert = L.invert ? 1 : 0;
    const st = L.streakTint || [0.8, 0.9, 1]; v.stR = st[0]; v.stG = st[1]; v.stB = st[2];
  } else if (card.effect === 'grade') {
    v.mode = L.mode; col('c0', L.c0 || '#000000'); col('c1', L.c1 || '#808080'); col('c2', L.c2 || '#ffffff'); v.hasHud = L.hud ? 1 : 0;
  } else if (card.effect === 'trip' || card.effect === 'clones') v.variant = L.variant || 0;
  else if (card.effect === 'transition') v.mode = L.mode;
  else if (card.effect === 'mosh') { v.variant = L.variant; v.drip = L.drip ? 1 : 0; }
  else if (card.effect === 'title') v.style = L.style;
  return v;
}

const TITLE_FONT = ['Arial Black', 'Impact', 'Arial Black', 'Courier New', 'Georgia', 'Georgia', 'Arial Black', 'Old English Text MT', 'Arial Black', 'Courier New'];
const TITLE_STYLE = ['Regular', 'Regular', 'Regular', 'Bold', 'Bold Italic', 'Italic', 'Regular', 'Regular', 'Regular', 'Bold'];

function settingSource(card) {
  const fuse = FUSE_FOR[card.effect];
  const P = GR.catalog.defaults(card);
  const user = userControls(card.effect).filter((c) => card.params.some((p) => p.id === c.id));
  const macro = 'GR_' + card.name.replace(/[^A-Z0-9]+/gi, '_');
  const inputs = [];
  const vals = Object.assign(recipeValues(card), {});
  const f = FUSES[fuse];
  if (f.inputs.length === 1 && card.effect !== 'title') inputs.push(`MainInput1 = InstanceInput { SourceOp = "Glitch", Source = "Input" }`);
  if (f.inputs.length === 2) {
    inputs.push(`MainInput1 = InstanceInput { SourceOp = "Glitch", Source = "Background" }`);
    inputs.push(`MainInput2 = InstanceInput { SourceOp = "Glitch", Source = "Foreground" }`);
  }
  let n = 1;
  if (card.effect === 'title') {
    inputs.push(`Input${n++} = InstanceInput { SourceOp = "Text", Source = "StyledText", Name = "TYPE" }`);
    inputs.push(`Input${n++} = InstanceInput { SourceOp = "Text", Source = "Font", Name = "FONT", ControlGroup = 1 }`);
    inputs.push(`Input${n++} = InstanceInput { SourceOp = "Text", Source = "Style", ControlGroup = 1 }`);
    inputs.push(`Input${n++} = InstanceInput { SourceOp = "Text", Source = "Size", Name = "SIZE", Default = 0.12 }`);
  }
  for (const c of user) {
    const def = P[c.id] != null ? P[c.id] : c.def;
    vals[c.id] = def;
    inputs.push(`Input${n++} = InstanceInput { SourceOp = "Glitch", Source = ${luaStr(c.id)}, Name = ${luaStr(c.label)}, Default = ${num(def)} }`);
  }
  if (card.effect === 'dotmatrix' && card.textInput) {
    vals.words = P.text || 'GLITCH RIG';
    inputs.push(`Input${n++} = InstanceInput { SourceOp = "Glitch", Source = "words", Name = "WORDS" }`);
  }
  const valLines = Object.entries(vals).map(([k, v]) => `\t\t\t\t\t\t${k} = Input { Value = ${typeof v === 'string' ? luaStr(v) : num(v)} },`);
  let tools = '';
  if (card.effect === 'title') {
    const st = card.look.style;
    tools += `
				Text = TextPlus {
					CtrlWZoom = false,
					Inputs = {
						UseFrameFormatSettings = Input { Value = 1 },
						Width = Input { Value = 1920 },
						Height = Input { Value = 1080 },
						StyledText = Input { Value = "GLITCH RIG" },
						Font = Input { Value = ${luaStr(TITLE_FONT[st])} },
						Style = Input { Value = ${luaStr(TITLE_STYLE[st])} },
						Size = Input { Value = 0.12 },
					},
					ViewInfo = OperatorInfo { Pos = { 0, 0 } },
				},`;
    valLines.unshift('\t\t\t\t\t\tInput = Input { SourceOp = "Text", Source = "Output" },');
  }
  tools += `
				Glitch = Fuse.${fuse} {
					CtrlWZoom = false,
					Inputs = {
${valLines.join('\n')}
					},
					ViewInfo = OperatorInfo { Pos = { 110, 0 } },
				},`;
  return `{
	Tools = ordered() {
		${macro} = MacroOperator {
			CtrlWZoom = false,
			NameSet = true,
			CustomData = { HelpPage = "https://github.com/Maxo551/barborka/tree/main/glitch-rig/resolve" },
			Inputs = ordered() {
${inputs.map((l) => '\t\t\t\t' + l + ',').join('\n')}
			},
			Outputs = {
				MainOutput1 = InstanceOutput { SourceOp = "Glitch", Source = "Output" },
			},
			ViewInfo = GroupInfo { Pos = { 0, 0 } },
			Tools = ordered() {${tools}
			},
		},
	},
	ActiveTool = ${luaStr(macro)},
}
`;
}

// ------------------------------------------------------------------ write everything
function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
rmrf(path.join(ROOT, 'Fuses'));
rmrf(path.join(ROOT, 'Templates'));
fs.mkdirSync(OUT_FUSES, { recursive: true });
for (const name of Object.keys(FUSES)) fs.writeFileSync(path.join(OUT_FUSES, name + '.fuse'), fuseSource(name));

const FOLDER = { looks: 'Effects', transitions: 'Transitions', titles: 'Titles' };
const made = { Effects: 0, Transitions: 0, Titles: 0 };
const skipped = [];
for (const card of GR.catalog.cards) {
  if (!FUSE_FOR[card.effect]) { skipped.push(card.name); continue; }
  const dir = path.join(OUT_TPL, FOLDER[card.tab], 'Glitch Rig');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, card.name + '.setting'), settingSource(card));
  made[FOLDER[card.tab]]++;
}
console.log('fuses:', Object.keys(FUSES).length, 'templates:', JSON.stringify(made), 'panel-only:', skipped.join(', '));
