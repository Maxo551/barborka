// GLITCH RIG — DCTL kernels for the Resolve/Fusion version, ported from the
// panel's GLSL shaders. Each entry: { params: <C struct body>, code: <kernel> }.
// The kernel name is the key, the parameter struct is `<key>Params`. build.js
// embeds them into .fuse files; test/harness.js compiles them for the CPU.
'use strict';

const font = require('./font');

// glyph index constants for the HUD text
const F = font.build();
const gdef = (name, ch) => `#define ${name} ${F.index.get(ch)}`;
const HUD_DEFS = [
  ...'0123456789'.split('').map((d) => gdef('GR_G_' + d, d)),
  gdef('GR_G_COLON', ':'), gdef('GR_G_R', 'R'), gdef('GR_G_E', 'E'), gdef('GR_G_C', 'C'),
  gdef('GR_G_N', 'N'), gdef('GR_G_V', 'V'),
].join('\n');

const GLYPH_FNS = font.dctl() + `
${HUD_DEFS}
// coverage of glyph g at local coords (fx, fy) in 0..1 (bottom-up), scaled about the centre
__DEVICE__ float gr_glyphAt(int g, float fx, float fy, float scale) {
  float gx = (fx - 0.5f) / scale + 0.5f, gy = (fy - 0.5f) / scale + 0.5f;
  if (gx < 0.0f || gy < 0.0f || gx >= 1.0f || gy >= 1.0f) return 0.0f;
  int col = (int)(gx * 5.0f), row = (int)((1.0f - gy) * 7.0f);
  if (col > 4) col = 4;
  if (row > 6) row = 6;
  int b = row < 4 ? gr_glyphLo(g) : gr_glyphHi(g);
  int sh = (row < 4 ? row : row - 4) * 5 + col;
  return (float)((b >> sh) & 1);
}
// glyph g drawn with its bottom-left at (ox, oy), each font pixel sz screen pixels
__DEVICE__ float gr_textGlyph(float px, float py, float ox, float oy, float sz, int g) {
  float gx = (px - ox) / (5.0f * sz), gy = (py - oy) / (7.0f * sz);
  if (gx < 0.0f || gy < 0.0f || gx >= 1.0f || gy >= 1.0f) return 0.0f;
  return gr_glyphAt(g, gx, gy, 1.0f);
}
__DEVICE__ int gr_digit(int d) {
  switch (d) {
    case 0: return GR_G_0; case 1: return GR_G_1; case 2: return GR_G_2; case 3: return GR_G_3; case 4: return GR_G_4;
    case 5: return GR_G_5; case 6: return GR_G_6; case 7: return GR_G_7; case 8: return GR_G_8; default: return GR_G_9;
  }
}
// Camcorder HUD: corner brackets, blinking REC, NV label and a running timecode.
__DEVICE__ float gr_hud(float px, float py, float W, float H, float t, float fps, float x0, float y0, float x1, float y1) {
  float s = _fmaxf(2.0f, (_fminf(x1 - x0, y1 - y0)) * 0.0085f);
  float v = 0.0f;
  float c = _fminf(x1 - x0, y1 - y0) * 0.12f, m = s * 5.0f, lw = s * 1.2f;
  float ax = px - x0 - m, ay = py - y0 - m, bx = x1 - m - px, by = y1 - m - py;
  if ((ax >= 0.0f && ax < c && ay >= 0.0f && ay < lw) || (ay >= 0.0f && ay < c && ax >= 0.0f && ax < lw)) v = 1.0f;
  if ((bx >= 0.0f && bx < c && ay >= 0.0f && ay < lw) || (ay >= 0.0f && ay < c && bx >= 0.0f && bx < lw)) v = 1.0f;
  if ((ax >= 0.0f && ax < c && by >= 0.0f && by < lw) || (by >= 0.0f && by < c && ax >= 0.0f && ax < lw)) v = 1.0f;
  if ((bx >= 0.0f && bx < c && by >= 0.0f && by < lw) || (by >= 0.0f && by < c && bx >= 0.0f && bx < lw)) v = 1.0f;
  float tx = x0 + m * 2.4f, ty = y1 - m * 2.6f;
  v = _fmaxf(v, gr_textGlyph(px, py, tx, ty, s, GR_G_R));
  v = _fmaxf(v, gr_textGlyph(px, py, tx + 6.0f * s, ty, s, GR_G_E));
  v = _fmaxf(v, gr_textGlyph(px, py, tx + 12.0f * s, ty, s, GR_G_C));
  float rx = x1 - m * 2.4f - 11.0f * s;
  v = _fmaxf(v, gr_textGlyph(px, py, rx, ty, s, GR_G_N));
  v = _fmaxf(v, gr_textGlyph(px, py, rx + 6.0f * s, ty, s, GR_G_V));
  int fr = (int)(gr_fract(t) * fps), sec = (int)t;
  int ds[8];
  ds[0] = 0; ds[1] = (sec / 3600) % 10; ds[2] = (sec / 600) % 6; ds[3] = (sec / 60) % 10;
  ds[4] = (sec / 10) % 6; ds[5] = sec % 10; ds[6] = (fr / 10) % 10; ds[7] = fr % 10;
  float cx = x0 + m * 2.4f, cy = y0 + m * 1.6f;
  for (int i = 0; i < 8; i++) {
    v = _fmaxf(v, gr_textGlyph(px, py, cx, cy, s, gr_digit(ds[i])));
    cx += 6.0f * s;
    if (i == 1 || i == 3 || i == 5) { v = _fmaxf(v, gr_textGlyph(px, py, cx, cy, s, GR_G_COLON)); cx += 6.0f * s; }
  }
  return v;
}
__DEVICE__ float gr_recDot(float px, float py, float x0, float y1, float t, float W, float H) {
  float s = _fmaxf(2.0f, _fminf(W, H) * 0.0085f), m = s * 5.0f;
  float d = gr_len(px - (x0 + m * 1.6f), py - (y1 - m * 2.6f + 3.5f * s));
  return gr_fract(t) < 0.5f ? 1.0f - gr_smooth(s * 1.6f, s * 2.0f, d) : 0.0f;
}
`;

const COMMON = `int width; int height; int compOrder; float iTime; float scale;`;

const K = {};

// ------------------------------------------------------------------ DOT MATRIX
K.GRDot = {
  params: COMMON + `
  float cell; int mode; int pmode; int chars; int invert;
  float dotSize; float depth; float darkDetail; float brighten; float shadows;
  float bg; float keep; float rain; float rainSpeed; float sparkle; float sparkleSize;
  float c0[3]; float c1[3]; float c2[3];
  int words[32]; int wordCount;`,
  code: `
__DEVICE__ float3 gr_palette(int pm, float L, float3 sc, float px, float py, float t, float3 c0, float3 c1, float3 c2, float keep) {
  float3 col;
  if (pm == 0) {
    float m = _fmaxf(_fmaxf(sc.x, sc.y), _fmaxf(sc.z, 0.05f));
    col = gr_scale3(gr_saturate(gr_scale3(sc, 1.0f / m), 1.25f), 0.08f + L);
  } else if (pm == 1) col = gr_mix3(c0, c1, L);
  else if (pm == 2) {
    float h = gr_fract(L * 0.55f + px * 0.55f + py * 0.35f + t * 0.02f);
    col = gr_scale3(gr_mix3(c0, gr_hsv2rgb(h, 0.55f, 1.0f), 0.7f), 0.2f + L * 1.35f);
  } else if (pm == 3) col = gr_scale3(gr_hsv2rgb(gr_fract(px * 0.9f + py * 0.35f + t * 0.04f + L * 0.25f), 0.75f, 1.0f), 0.1f + L);
  else if (pm == 4) col = gr_heat(L);
  else col = gr_ramp3(L, c0, c1, c2);
  return gr_mix3(col, gr_scale3(sc, 0.35f + L), keep);
}

__DEVICE__ float gr_sparkles(__TEXTURE2D__ src, float fx, float fy, float W, float H, float t, float size, float k) {
  float gsz = gr_mix(26.0f, 80.0f, size) * k;
  float gix = _floor(fx / gsz), giy = _floor(fy / gsz);
  float s = 0.0f;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      float gx = gix + (float)i, gy = giy + (float)j;
      float2 h = gr_hash22(gx, gy);
      float on = gr_step(0.45f, gr_hash21(gx + 3.7f, gy + 3.7f));
      float px = (gx + h.x) * gsz, py = (gy + h.y) * gsz;
      float ph = gr_hash21(gx + 7.1f, gy + 7.1f);
      float tw = _powf(_fmaxf(_sinf(t * (1.2f + ph * 3.0f) + ph * 6.283f), 0.0f), 6.0f) * on;
      tw *= gr_smooth(0.2f, 0.65f, gr_luma(gr_tex(src, px / W, py / H)));
      float dx = _fabs(fx - px), dy = _fabs(fy - py);
      float sz = gsz * gr_mix(0.18f, 0.55f, size);
      float star = _expf(-dx / (sz * 0.05f)) * _expf(-dy / sz) + _expf(-dy / (sz * 0.05f)) * _expf(-dx / sz);
      star += _expf(-gr_len(dx, dy) / (sz * 0.1f));
      s += star * tw;
    }
  }
  return s;
}

__KERNEL__ void GRDot(__CONSTANTREF__ GRDotParams* params, __TEXTURE2D__ src, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height, t = params->iTime;
  float fx = (float)x + 0.5f, fy = (float)y + 0.5f;
  float cs = params->cell;
  float cix = _floor(fx / cs), ciy = _floor(fy / cs);
  float fu = fx / cs - cix, fv = fy / cs - ciy;
  float cu = (cix + 0.5f) * cs / W, cv = (ciy + 0.5f) * cs / H;
  float eu = cs / W, ev = cs / H;
  float3 sc = gr_scale3(gr_add3(gr_add3(gr_scale3(gr_tex(src, cu, cv), 2.0f), gr_tex(src, cu + eu * 0.25f, cv + ev * 0.25f)), gr_tex(src, cu - eu * 0.25f, cv - ev * 0.25f)), 0.25f);
  float L = gr_luma(sc);
  float lx = gr_luma(gr_tex(src, cu + eu, cv)) - gr_luma(gr_tex(src, cu - eu, cv));
  float ly = gr_luma(gr_tex(src, cu, cv + ev)) - gr_luma(gr_tex(src, cu, cv - ev));
  float edge = gr_sat(gr_len(lx, ly) * 2.5f);
  if (params->invert != 0) L = 1.0f - L;
  L = _powf(gr_sat(L), gr_mix(1.25f, 0.45f, params->darkDetail));
  L *= 0.75f + params->brighten * 1.1f;
  L = gr_mix(L, _fmaxf(L, edge * 1.2f), params->depth);
  float floorL = params->shadows * 0.22f;
  L = gr_sat((L - floorL) / (1.0f - floorL));

  float rain = params->rain, rainSpeed = params->rainSpeed;
  float colSeed = gr_hash11(cix * 1.731f + 3.1f);
  float speed = (0.35f + colSeed) * (0.15f + rainSpeed * 1.6f);
  float yTop = 1.0f - (ciy + 0.5f) * cs / H;
  float head = gr_fract(t * speed * 0.35f + colSeed * 9.13f);
  float dist = head - yTop;
  if (dist < 0.0f) dist += 1.0f;
  float trail = _expf(-dist * 7.0f);
  float isHead = 1.0f - gr_smooth(0.0f, cs / H * 1.5f, dist);
  float flickRate = 3.0f + rainSpeed * 14.0f;
  float gscale = gr_mix(0.7f, 1.08f, params->dotSize);

  int mode = params->mode, set = params->chars;
  int count = set == 8 ? params->wordCount : gr_setCount(set);
  if (count < 1) count = 1;
  float A = 0.0f, V = L;
  if (mode == 0) {
    float r = gr_mix(0.18f, 0.6f, params->dotSize) * (0.4f + 0.6f * _sqrtf(L));
    A = 1.0f - gr_smooth(r - 0.14f, r, gr_len(fu - 0.5f, fv - 0.5f));
  } else if (mode == 1) {
    float r = _fmaxf(gr_mix(0.2f, 0.56f, params->dotSize) * (0.35f + 0.65f * _sqrtf(L)), 0.001f);
    float qx = (fu - 0.5f) / r, qy = (fv - 0.5f) / r;
    float d = qx * qx + qy * qy;
    float nz = _sqrtf(_fmaxf(1.0f - d, 0.0f));
    float lxn = -0.45113f, lyn = 0.55138f, lzn = 0.70175f;
    float ndl = qx * lxn + qy * lyn + nz * lzn;
    float lit = 0.25f + 0.75f * _fmaxf(ndl, 0.0f);
    float spec = _powf(_fmaxf(-lzn + 2.0f * ndl * nz, 0.0f), 18.0f);
    A = (1.0f - gr_smooth(0.8f, 1.0f, d)) * (lit + spec * 1.2f);
    V = gr_sat(L * 0.8f + spec * 0.5f);
  } else if (mode == 2) {
    int gi = (int)_floor((0.12f + 0.88f * L) * (float)(count - 1) + 0.5f);
    int g = set == 8 ? params->words[gi % count] : gr_setGlyph(set, gi);
    A = gr_glyphAt(g, fu, fv, gscale);
    V = 0.3f + 0.8f * L;
  } else if (mode == 3) {
    float k = _floor(t * flickRate * (0.3f + gr_hash21(ciy, cix)));
    int gi = (int)(gr_hash21(cix + k, ciy + k) * (float)count);
    int g = set == 8 ? params->words[gi % count] : gr_setGlyph(set, gi);
    A = gr_glyphAt(g, fu, fv, gscale);
    V = gr_sat(L * 1.35f * (1.0f - rain * 0.3f + rain * trail * 1.2f) + isHead * rain * 0.7f);
  } else if (mode == 4) {
    int gi = ((int)(cix + ciy * 7.0f + _floor(t * (1.0f + rainSpeed * 6.0f)))) % count;
    int g = set == 8 ? params->words[gi] : gr_setGlyph(set, gi);
    A = gr_glyphAt(g, fu, fv, gscale);
    V = 0.2f + 0.8f * L;
  } else {
    float qx = _fabs(fu - 0.5f), qy = _fabs(fv - 0.5f);
    A = gr_step(_fmaxf(qx, qy), gr_mix(0.2f, 0.47f, params->dotSize)) * (0.35f + 0.65f * gr_step(0.08f, L));
  }
  float3 c0 = to_float3(params->c0[0], params->c0[1], params->c0[2]);
  float3 c1 = to_float3(params->c1[0], params->c1[1], params->c1[2]);
  float3 c2 = to_float3(params->c2[0], params->c2[1], params->c2[2]);
  float u = fx / W, v = fy / H;
  // the 5x7 pixel font carries more ink than the panel's antialiased atlas
  float gain = (mode >= 2 && mode <= 4) ? 1.1f : 1.0f;
  float3 col = gr_scale3(gr_palette(params->pmode, V, sc, u, v, t, c0, c1, c2, params->keep), A * gain);
  if (mode == 3) col = gr_add3(col, gr_scale3(gr_v3(0.75f, 0.75f, 0.75f), isHead * rain * A));
  if (!(mode == 2 || mode == 3 || mode == 4) && rain > 0.0f) {
    float k = _floor(t * flickRate);
    int gi = (int)(gr_hash21(cix + 11.0f + k, ciy + 11.0f + k) * (float)count);
    int g = set == 8 ? params->words[gi % count] : gr_setGlyph(set, gi);
    float rg = gr_glyphAt(g, fu, fv, 0.85f) * trail * rain;
    float3 rc = gr_add3(gr_scale3(gr_palette(params->pmode, 1.0f, sc, u, v, t, c0, c1, c2, params->keep), 0.8f), gr_v3(isHead * 0.6f, isHead * 0.6f, isHead * 0.6f));
    col = gr_add3(col, gr_scale3(rc, rg * (0.3f + 0.7f * L)));
  }
  col = gr_add3(col, gr_scale3(sc, params->bg * 0.35f * (1.0f - gr_sat(A))));
  float sp = gr_sparkles(src, fx, fy, W, H, t, params->sparkleSize, params->scale) * params->sparkle * 1.4f;
  col = gr_add3(col, gr_v3(sp, sp * 0.97f, sp * 0.92f));
  _tex2DVec4Write(dst, x, y, to_float4(col.x, col.y, col.z, 1.0f));
}
`,
};

// ------------------------------------------------------------------ FINISH (glow, streaks, grade, CRT)
K.GRExtract = {
  params: COMMON + ` float thresh;`,
  code: `
__KERNEL__ void GRExtract(__CONSTANTREF__ GRExtractParams* params, __TEXTURE2D__ src, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height;
  float u = ((float)x + 0.5f) / W, v = ((float)y + 0.5f) / H;
  float du = 1.5f * params->scale / W, dv = 1.5f * params->scale / H;
  float3 c = gr_add3(gr_add3(gr_tex(src, u - du, v - dv), gr_tex(src, u + du, v - dv)), gr_add3(gr_tex(src, u - du, v + dv), gr_tex(src, u + du, v + dv)));
  c = gr_scale3(c, 0.25f);
  float l = _fmaxf(c.x, _fmaxf(c.y, c.z));
  c = gr_scale3(c, gr_smooth(params->thresh, params->thresh + 0.3f, l));
  _tex2DVec4Write(dst, x, y, to_float4(c.x, c.y, c.z, 1.0f));
}
`,
};

K.GRBlur = {
  params: COMMON + ` float dx; float dy;`,
  code: `
__KERNEL__ void GRBlur(__CONSTANTREF__ GRBlurParams* params, __TEXTURE2D__ src, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height;
  float u = ((float)x + 0.5f) / W, v = ((float)y + 0.5f) / H;
  float pu = params->dx / W, pv = params->dy / H;
  float3 s = gr_scale3(gr_tex(src, u, v), 0.227027f);
  s = gr_add3(s, gr_scale3(gr_add3(gr_tex(src, u + pu * 1.3846f, v + pv * 1.3846f), gr_tex(src, u - pu * 1.3846f, v - pv * 1.3846f)), 0.316216f));
  s = gr_add3(s, gr_scale3(gr_add3(gr_tex(src, u + pu * 3.2307f, v + pv * 3.2307f), gr_tex(src, u - pu * 3.2307f, v - pv * 3.2307f)), 0.070270f));
  _tex2DVec4Write(dst, x, y, to_float4(s.x, s.y, s.z, 1.0f));
}
`,
};

K.GRStreak = {
  params: COMMON + ` float stepPx;`,
  code: `
__KERNEL__ void GRStreak(__CONSTANTREF__ GRStreakParams* params, __TEXTURE2D__ src, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height;
  float u = ((float)x + 0.5f) / W, v = ((float)y + 0.5f) / H;
  float pu = params->stepPx / W;
  float3 s = gr_v3(0.0f, 0.0f, 0.0f);
  float w = 0.0f;
  for (int i = -4; i <= 4; i++) {
    float k = _powf(0.82f, _fabs((float)i));
    s = gr_add3(s, gr_scale3(gr_tex(src, u + pu * (float)i, v), k));
    w += k;
  }
  s = gr_scale3(s, 1.15f / w);
  _tex2DVec4Write(dst, x, y, to_float4(s.x, s.y, s.z, 1.0f));
}
`,
};

K.GRComposite = {
  params: COMMON + `
  float glow; float streaks; float rgb; float scanlines; float scanline; float grain; float vignette; float flicker;
  float bright; float contrast; float satur; float hue; float streakTint[3]; int useGlow;`,
  code: `
__KERNEL__ void GRComposite(__CONSTANTREF__ GRCompositeParams* params, __TEXTURE2D__ src, __TEXTURE2D__ glowT, __TEXTURE2D__ streakT, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height, t = params->iTime;
  float u = ((float)x + 0.5f) / W, v = ((float)y + 0.5f) / H;
  float du = u - 0.5f, dv = v - 0.5f;
  float4 base = gr_tex4(src, u, v);
  float3 c = to_float3(base.x, base.y, base.z);
  if (params->rgb > 0.0f) {
    float off = params->rgb * 0.014f * (0.4f + gr_len(du, dv) * 1.6f);
    c.x = gr_tex(src, u + off, v).x;
    c.z = gr_tex(src, u - off, v).z;
  }
  if (params->useGlow != 0) {
    c = gr_add3(c, gr_scale3(gr_tex(glowT, u, v), params->glow * 2.2f));
    float3 st = gr_tex(streakT, u, v);
    float k = params->streaks * 1.4f;
    c = gr_add3(c, to_float3(st.x * k * params->streakTint[0], st.y * k * params->streakTint[1], st.z * k * params->streakTint[2]));
  }
  c = gr_hueShift(gr_max3(c, gr_v3(0.0f, 0.0f, 0.0f)), params->hue);
  c = gr_add3(gr_scale3(gr_sub3(c, gr_v3(0.5f, 0.5f, 0.5f)), params->contrast), gr_v3(0.5f, 0.5f, 0.5f));
  c = gr_scale3(c, params->bright);
  c = gr_saturate(c, params->satur);
  float py = (float)y / params->scale;
  float sl = 0.5f + 0.5f * _sinf(py * GR_PI * 0.5f);
  c = gr_scale3(c, 1.0f - params->scanlines * 0.45f * (1.0f - sl));
  float sy = 1.0f - gr_fract(t * 0.22f);
  float bq = (v - sy) / 0.02f;
  float band = _expf(-bq * bq);
  float bb = params->scanline * band * 0.28f;
  c = gr_add3(c, gr_v3(bb, bb, bb));
  c = gr_scale3(c, 1.0f + params->scanline * 0.25f * _sinf(v * 900.0f + t * 30.0f) * band);
  float g = (gr_hash21((float)x + gr_fract(t * 7.13f) * 97.0f, (float)y + gr_fract(t * 7.13f) * 97.0f) - 0.5f) * params->grain * 0.3f;
  c = gr_add3(c, gr_v3(g, g, g));
  float vg = gr_smooth(0.25f, 0.95f, gr_len(du, dv * 0.9f) * 1.25f);
  c = gr_scale3(c, 1.0f - params->vignette * vg);
  c = gr_scale3(c, 1.0f - params->flicker * 0.18f * gr_hash11(_floor(t * 18.0f)));
  c = gr_max3(c, gr_v3(0.0f, 0.0f, 0.0f));
  _tex2DVec4Write(dst, x, y, to_float4(c.x, c.y, c.z, base.w));
}
`,
};

require('./kernels-more')(K, COMMON);

module.exports = { K, GLYPH_FNS, font };
