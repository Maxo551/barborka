// GLITCH RIG — the rest of the DCTL kernels: colour looks, trip, echo,
// transitions, datamosh and titles. Ported from js/effects/*.js.
'use strict';

module.exports = function (K, COMMON) {

  // ---------------------------------------------------------------- COLOUR LOOKS
  K.GRGrade = {
    params: COMMON + `
  int mode; float amount; float glitch; float noiseAmt; float contrastK; float brightK; float hueK;
  float c0[3]; float c1[3]; float c2[3]; int hud; float fps; float hudColor[3];`,
    code: `
__DEVICE__ float gr_bayer(int x, int y) {
  switch ((x & 3) * 4 + (y & 3)) {
    case 0: return 0.0f; case 1: return 8.0f; case 2: return 2.0f; case 3: return 10.0f;
    case 4: return 12.0f; case 5: return 4.0f; case 6: return 14.0f; case 7: return 6.0f;
    case 8: return 3.0f; case 9: return 11.0f; case 10: return 1.0f; case 11: return 9.0f;
    case 12: return 15.0f; case 13: return 7.0f; case 14: return 13.0f; default: return 5.0f;
  }
}
__DEVICE__ float2 gr_glitchUV(float u, float v, float glitch, float t) {
  if (glitch <= 0.0f) return to_float2(u, v);
  float tt = _floor(t * 12.0f);
  float band = _floor(v * (8.0f + gr_hash11(tt) * 30.0f));
  float on = gr_step(1.0f - glitch * 0.35f, gr_hash21(band, tt));
  u += (gr_hash21(band, tt + 1.0f) - 0.5f) * 0.18f * on * glitch;
  float bx = _floor(u * 12.0f), by = _floor(v * 8.0f);
  if (gr_hash21(bx + tt * 3.1f, by + tt * 3.1f) > 1.0f - glitch * 0.12f) {
    float2 hh = gr_hash22(bx + tt, by + tt);
    u += (hh.x - 0.5f) * 0.08f;
    v += (hh.y - 0.5f) * 0.08f;
  }
  return to_float2(u, v);
}

__KERNEL__ void GRGrade(__CONSTANTREF__ GRGradeParams* params, __TEXTURE2D__ src, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height, t = params->iTime, k = params->scale;
  float fx = (float)x + 0.5f, fy = (float)y + 0.5f, u = fx / W, v = fy / H;
  float2 p = gr_glitchUV(u, v, params->glitch, t);
  float3 orig = gr_tex(src, u, v);
  float3 c = gr_tex(src, p.x, p.y);
  float L = gr_luma(c);
  float3 r = c;
  float fr = gr_fract(t * 13.7f) * 91.0f;
  float n = gr_hash21(_floor(fx) + fr, _floor(fy) + fr) - 0.5f;
  int mode = params->mode;
  float3 c0 = to_float3(params->c0[0], params->c0[1], params->c0[2]);
  float3 c1 = to_float3(params->c1[0], params->c1[1], params->c1[2]);
  float3 c2 = to_float3(params->c2[0], params->c2[1], params->c2[2]);

  if (mode == 0) {
    float l = _powf(gr_sat(L * 1.9f + n * 0.25f * params->noiseAmt), 0.75f);
    r = gr_ramp3(l, gr_v3(0.0f, 0.03f, 0.01f), gr_v3(0.16f, 0.82f, 0.22f), gr_v3(0.82f, 1.0f, 0.78f));
    r = gr_scale3(r, 0.9f + 0.1f * _sinf(fy / k * 1.6f));
  } else if (mode == 1) {
    float pu = 2.0f * k / W, pv = 2.0f * k / H;
    float b = (L + gr_luma(gr_tex(src, p.x + pu, p.y + pv)) + gr_luma(gr_tex(src, p.x - pu, p.y - pv))
             + gr_luma(gr_tex(src, p.x + pu, p.y - pv)) + gr_luma(gr_tex(src, p.x - pu, p.y + pv))) / 5.0f;
    r = gr_heat(_floor(_powf(b, 0.9f) * 18.0f) / 18.0f);
  } else if (mode == 2) {
    r = gr_scale3(gr_saturate(gr_v3(c.y * 1.3f + c.x * 0.25f, c.x * 0.4f + c.z * 0.2f, c.z * 0.85f + c.y * 0.35f), 1.5f), 1.1f);
  } else if (mode == 3) {
    float th = 0.45f + (gr_fbm(u * 3.0f + t * 0.2f, v * 3.0f + t * 0.2f) - 0.5f) * 0.25f;
    float ink = gr_step(L + n * 0.35f * (0.3f + params->noiseAmt), th);
    float streak = gr_smooth(0.97f, 1.0f, gr_hash11(_floor(u * 220.0f) + _floor(t * 6.0f))) * 0.5f;
    float m = gr_sat(ink + streak * gr_step(0.5f, gr_hash21(fx, fy)));
    r = gr_mix3(gr_v3(0.94f, 0.92f, 0.86f), gr_v3(0.06f, 0.05f, 0.07f), m);
    float sp = gr_step(0.995f, gr_hash21(_floor(fx / 2.0f) + _floor(t * 8.0f), _floor(fy / 2.0f) + _floor(t * 8.0f))) * 0.8f;
    r = gr_sub3(r, gr_v3(sp, sp, sp));
  } else if (mode == 4) {
    r = gr_mix3(gr_v3(0.03f, 0.0f, 0.09f), gr_v3(0.42f, 0.05f, 0.95f), gr_smooth(0.0f, 0.6f, L));
    float l3 = _powf(L, 2.5f), bl = _fmaxf(c.z - c.x, 0.0f);
    r = gr_add3(r, gr_v3(l3 * 0.3f + bl * 0.2f, l3 * 1.2f + bl * 0.4f, l3 * 0.9f + bl * 1.0f));
  } else if (mode == 5) {
    float qx = u * 2.0f - 1.0f, qy = v * 2.0f - 1.0f;
    float d = 1.0f + (qx * qx + qy * qy) * 0.08f;
    qx *= d; qy *= d;
    float2 pq = gr_glitchUV(qx * 0.5f + 0.5f, qy * 0.5f + 0.5f, params->glitch, t);
    if (pq.x < 0.0f || pq.y < 0.0f || pq.x > 1.0f || pq.y > 1.0f) {
      _tex2DVec4Write(dst, x, y, to_float4(0.0f, 0.0f, 0.0f, 1.0f));
      return;
    }
    float3 cc = gr_v3(gr_tex(src, pq.x + 0.0015f, pq.y).x, gr_tex(src, pq.x, pq.y).y, gr_tex(src, pq.x - 0.0015f, pq.y).z);
    float mk = gr_mod(_floor(fx / k), 3.0f);
    float3 m = mk < 1.0f ? gr_v3(1.0f, 0.55f, 0.55f) : (mk < 2.0f ? gr_v3(0.55f, 1.0f, 0.55f) : gr_v3(0.55f, 0.55f, 1.0f));
    r = gr_scale3(gr_mul3(cc, m), 1.45f * (0.75f + 0.25f * _sinf(pq.y * H / k * GR_PI)));
    r = gr_scale3(r, 1.0f - gr_smooth(0.75f, 1.05f, gr_len(qx * 0.9f, qy)));
  } else if (mode == 6) {
    float px = (6.0f + params->amount * 6.0f) * k;
    float gx = (_floor(fx / px) + 0.5f) * px / W, gy = (_floor(fy / px) + 0.5f) * px / H;
    float2 g = gr_glitchUV(gx, gy, params->glitch, t);
    float3 cc = gr_tex(src, g.x, g.y);
    float dd = (gr_bayer((int)_floor(fx / px), (int)_floor(fy / px)) / 16.0f - 0.5f) * 0.25f;
    r = gr_v3(_floor((cc.x + dd) * 4.0f + 0.5f) / 4.0f, _floor((cc.y + dd) * 4.0f + 0.5f) / 4.0f, _floor((cc.z + dd) * 4.0f + 0.5f) / 4.0f);
  } else if (mode == 7) {
    float line = _floor(fy / k / 2.0f);
    float jit = (gr_hash11(line + _floor(t * 24.0f) * 7.0f) - 0.5f) * 0.004f * (1.0f + params->glitch * 4.0f);
    float track = 1.0f - gr_smooth(0.0f, 0.06f, _fabs(v - gr_fract(t * 0.11f + 0.05f)));
    float qu = p.x + jit + track * 0.03f * _sinf(v * 400.0f), qv = p.y;
    float yy = gr_luma(gr_tex(src, qu, qv));
    float3 ch = gr_v3(0.0f, 0.0f, 0.0f);
    for (int i = 0; i < 6; i++) ch = gr_add3(ch, gr_tex(src, qu - (float)i * 0.004f, qv));
    ch = gr_scale3(ch, 1.0f / 6.0f);
    float cl = gr_luma(ch);
    r = gr_v3(yy + (ch.x - cl) * 1.3f, yy + (ch.y - cl) * 1.3f, yy + (ch.z - cl) * 1.3f);
    r = gr_mix3(r, gr_mul3(r, gr_v3(1.08f, 0.9f, 1.1f)), 0.6f);
    float tn = track * (n + 0.5f) * 0.5f;
    r = gr_add3(r, gr_v3(tn, tn, tn));
    float hs = (1.0f - gr_smooth(0.0f, 0.03f, v)) * (gr_hash21(u * 200.0f, t) - 0.2f);
    r = gr_add3(r, gr_v3(hs, hs, hs));
  } else if (mode == 8) {
    float tt = _floor(t * 8.0f);
    float sc = 1.0f + gr_hash11(tt) * 2.0f;
    float bx = _floor(u * 16.0f * sc), by = _floor(v * 9.0f * sc);
    float hb = gr_hash21(bx + tt, by + tt);
    float qu = p.x, qv = p.y;
    if (hb > 0.8f) { float2 o = gr_hash22(bx * 1.3f + tt, by * 1.3f + tt); qu += (o.x - 0.5f) * 0.25f; qv += (o.y - 0.5f) * 0.25f; }
    float3 cc = gr_tex(src, qu, qv);
    if (hb > 0.9f) cc = gr_v3(cc.z, cc.x, cc.y);
    if (hb > 0.95f) cc = gr_v3(_floor(cc.x * 3.0f) / 3.0f, _floor(cc.y * 3.0f) / 3.0f, _floor(cc.z * 3.0f) / 3.0f);
    if (hb < 0.05f) cc = gr_v3(1.0f - cc.x, 1.0f - cc.y, 1.0f - cc.z);
    r = cc;
  } else if (mode == 9) {
    r = gr_ramp3(gr_smooth(0.02f, 0.95f, L), c0, c1, c2);
  } else if (mode == 10) {
    float l = 0.5f - 0.5f * _cosf(gr_sat(L * 1.25f) * GR_PI * 3.0f);
    r = gr_scale3(gr_ramp3(l, c0, c1, c2), 0.35f + 0.65f * gr_smooth(0.0f, 0.25f, L));
  } else {
    float w = _sinf(v * 60.0f + t * 6.0f) * 0.012f + _sinf(v * 7.0f - t * 2.0f) * 0.02f;
    float il = gr_mod(_floor(fy / k / 2.0f), 2.0f);
    float3 cc = gr_v3(gr_tex(src, p.x + w * 1.4f, p.y).x, gr_tex(src, p.x + w * (il > 0.5f ? -1.0f : 1.0f), p.y).y, gr_tex(src, p.x - w * 1.4f, p.y).z);
    r = gr_scale3(cc, (0.85f + 0.15f * il) * 1.1f);
  }

  r = gr_hueShift(gr_clamp3(r, 0.0f, 4.0f), params->hueK);
  r = gr_add3(gr_scale3(gr_sub3(r, gr_v3(0.5f, 0.5f, 0.5f)), params->contrastK), gr_v3(0.5f, 0.5f, 0.5f));
  r = gr_scale3(r, params->brightK);
  if (mode >= 1) { float nn = n * params->noiseAmt * 0.18f; r = gr_add3(r, gr_v3(nn, nn, nn)); }
  r = gr_mix3(orig, gr_max3(r, gr_v3(0.0f, 0.0f, 0.0f)), params->amount);
  if (params->hud != 0) {
    float hv = gr_hud(fx, fy, W, H, t, params->fps, 0.0f, 0.0f, W, H) * 0.85f;
    r = gr_mix3(r, to_float3(params->hudColor[0], params->hudColor[1], params->hudColor[2]), hv);
    float rd = gr_recDot(fx, fy, 0.0f, H, t, W, H);
    r = gr_mix3(r, gr_v3(1.0f, 0.17f, 0.17f), rd);
  }
  _tex2DVec4Write(dst, x, y, to_float4(r.x, r.y, r.z, 1.0f));
}
`,
  };

  // ---------------------------------------------------------------- TRIP
  K.GRTrip = {
    params: COMMON + `
  float env; float warp; float tracers; float patSpeed; int patCol; int colMode; int variant; float seed; int hasHist;`,
    code: `
__DEVICE__ float gr_flower(float px, float py) {
  float rx = 1.0f, ry = 1.7320508f, hx = 0.5f, hy = 0.8660254f;
  float ax = gr_mod(px, rx) - hx, ay = gr_mod(py, ry) - hy;
  float bx = gr_mod(px - hx, rx) - hx, by = gr_mod(py - hy, ry) - hy;
  float gx = ax, gy = ay;
  if (bx * bx + by * by < ax * ax + ay * ay) { gx = bx; gy = by; }
  float d = gr_len(gx, gy);
  float ring = (1.0f - gr_smooth(0.0f, 0.05f, _fabs(d - 0.5f))) + (1.0f - gr_smooth(0.0f, 0.04f, _fabs(d - 0.25f))) * 0.6f;
  float ang = _atan2f(gy, gx);
  float petals = 1.0f - gr_smooth(0.0f, 0.06f, _fabs(d - (0.32f + 0.08f * _cosf(ang * 6.0f))));
  return gr_sat(ring + petals);
}
__DEVICE__ float gr_kaleido(float px, float py, float t) {
  float a = _atan2f(py, px), r = gr_len(px, py), kk = 8.0f;
  a = gr_mod(a + t * 0.1f, 2.0f * GR_PI / kk);
  a = _fabs(a - GR_PI / kk);
  float qx = _cosf(a) * r, qy = _sinf(a) * r;
  return 1.0f - gr_smooth(0.0f, 0.06f, _fabs(_sinf(qx * 9.0f - t) * 0.5f + _sinf(qy * 14.0f + t * 0.7f) * 0.3f));
}

__KERNEL__ void GRTrip(__CONSTANTREF__ GRTripParams* params, __TEXTURE2D__ src, __TEXTURE2D__ h1, __TEXTURE2D__ h2, __TEXTURE2D__ h3, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height, t = params->iTime;
  float u = ((float)x + 0.5f) / W, v = ((float)y + 0.5f) / H;
  float e = params->env, seed = params->seed;
  int variant = params->variant;
  float px = u, py = v;
  float qx = px * 2.6f + t * 0.12f + seed * 13.0f, qy = py * 2.6f - t * 0.09f + seed * 13.0f;
  float dx = gr_fbm(qx, qy) - 0.5f, dy = gr_fbm(qx + 5.2f, qy + 5.2f) - 0.5f;
  float wa = params->warp * e * (variant == 2 ? 0.14f : 0.055f);
  px += dx * wa; py += dy * wa;
  float z = 1.0f - 0.035f * e * _sinf(t * 1.3f);
  px = (px - 0.5f) * z + 0.5f; py = (py - 0.5f) * z + 0.5f;
  if (variant == 0 || variant == 1) {
    float drip = gr_fbm(px * 9.0f + seed, t * 0.25f);
    float melt = e * params->warp * (variant == 1 ? 0.16f : 0.07f);
    py += melt * drip * gr_smooth(0.0f, 1.0f, v);
    px += _sinf(py * 30.0f + t * 2.0f) * melt * 0.05f;
  }
  float3 c = gr_tex(src, px, py);
  float pu = 1.5f * params->scale / W, pv = 1.5f * params->scale / H;
  float edge = gr_len(gr_luma(gr_tex(src, px + pu, py)) - gr_luma(gr_tex(src, px - pu, py)),
                      gr_luma(gr_tex(src, px, py + pv)) - gr_luma(gr_tex(src, px, py - pv)));
  float L = gr_luma(c);
  int cm = params->colMode;
  if (cm == 0) c = gr_saturate(gr_hueShift(c, e * 0.08f * _sinf(t * 0.4f)), 1.0f + e * 0.6f);
  else if (cm == 1) c = gr_saturate(gr_hueShift(c, t * 0.12f * e + L * e * 0.8f), 1.0f + e);
  else if (cm == 2) c = gr_mix3(c, gr_scale3(gr_hsv2rgb(gr_fract(L * 1.5f + t * 0.1f), 1.0f, 1.0f), 0.2f + L * 1.4f), e * 0.75f);
  else { float3 hs = gr_hueShift(c, t * 0.1f); c = gr_mix3(c, gr_v3(1.0f - hs.x, 1.0f - hs.y, 1.0f - hs.z), e * 0.7f); }

  float gx = (u - 0.5f) * W / H, gy = v - 0.5f;
  float ps = t * (0.05f + params->patSpeed * 0.6f);
  float zz = 5.0f + 1.5f * _sinf(ps * 0.7f);
  float gpx = gx * zz, gpy = gy * zz;
  float ca = _cosf(ps * 0.3f), sa = _sinf(ps * 0.3f);
  float rx = ca * gpx - sa * gpy + dx * 2.0f, ry = sa * gpx + ca * gpy + dy * 2.0f;
  float pat = variant == 3 ? _fmaxf(gr_flower(rx, ry), gr_kaleido(gx * 1.2f, gy * 1.2f, ps * 4.0f)) : gr_flower(rx, ry);
  float flatArea = 1.0f - gr_sat(edge * 6.0f);
  float pm = gr_sat(e * pat * gr_smooth(0.12f, 0.45f, L) * flatArea * 0.7f);
  float3 pc;
  if (params->patCol == 0) pc = gr_add3(gr_scale3(c, 1.7f), gr_v3(0.05f, 0.05f, 0.05f));
  else if (params->patCol == 1) pc = gr_hsv2rgb(gr_fract(rx * 0.05f + ry * 0.05f + t * 0.1f), 0.9f, 1.0f);
  else pc = gr_scale3(gr_v3(1.0f, 0.8f, 0.3f), 0.4f + L);
  c = gr_mix3(c, pc, pm);

  if (params->hasHist != 0) {
    float k = params->tracers * e * 0.9f;
    float3 p1 = gr_hueShift(gr_tex(h1, u, v), 0.12f * e);
    float3 p2 = gr_hueShift(gr_tex(h2, u, v), 0.24f * e);
    float3 p3 = gr_hueShift(gr_tex(h3, u, v), 0.36f * e);
    c = gr_max3(c, gr_scale3(p1, k * 0.97f));
    c = gr_max3(c, gr_scale3(p2, k * k * 0.97f));
    c = gr_max3(c, gr_scale3(p3, k * k * k * 0.97f));
  }
  _tex2DVec4Write(dst, x, y, to_float4(c.x, c.y, c.z, 1.0f));
}
`,
  };

  // ---------------------------------------------------------------- ECHO (clone trail / chroma echo)
  K.GREcho = {
    params: COMMON + ` int n; float fade; int blendMode; int tintMode; int matte; float offset; int variant;`,
    code: `
__DEVICE__ float3 gr_tintFor(int mode, float i, float t) {
  if (mode == 0) return gr_v3(1.0f, 1.0f, 1.0f);
  if (mode == 1) return gr_hsv2rgb(gr_fract(i * 0.17f + t * 0.15f), 0.85f, 1.0f);
  if (mode == 2) return gr_fract(i * 0.5f) < 0.25f ? gr_v3(0.25f, 1.0f, 1.0f) : gr_v3(1.0f, 0.25f, 1.0f);
  if (mode == 3) return gr_mix3(gr_v3(1.0f, 0.85f, 0.3f), gr_v3(1.0f, 0.25f, 0.1f), i / 6.0f);
  return gr_scale3(gr_v3(0.35f, 0.55f, 1.0f), 1.2f - i * 0.1f);
}
__DEVICE__ float3 gr_echoComp(float3 acc, float3 c, float3 k, float i, float n, float fade, int blendMode, int tintMode, int matte, float t) {
  if (i > n) return acc;
  float m = matte == 0 ? gr_smooth(0.06f, 0.28f, gr_dist3(k, c)) : (matte == 1 ? gr_smooth(0.3f, 0.75f, gr_luma(k)) : 1.0f);
  float w = _powf(1.0f - i / (n + 1.0f), 0.5f + fade * 2.5f) * m;
  float3 vv = gr_scale3(gr_mul3(k, gr_tintFor(tintMode, i, t)), w);
  if (blendMode == 0) return gr_max3(acc, vv);
  if (blendMode == 1) return gr_v3(1.0f - (1.0f - acc.x) * (1.0f - vv.x), 1.0f - (1.0f - acc.y) * (1.0f - vv.y), 1.0f - (1.0f - acc.z) * (1.0f - vv.z));
  if (blendMode == 2) return gr_add3(acc, gr_scale3(vv, 0.55f));
  return gr_abs3(gr_sub3(acc, vv));
}

__KERNEL__ void GREcho(__CONSTANTREF__ GREchoParams* params, __TEXTURE2D__ src, __TEXTURE2D__ h1, __TEXTURE2D__ h2, __TEXTURE2D__ h3,
                       __TEXTURE2D__ h4, __TEXTURE2D__ h5, __TEXTURE2D__ h6, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height, t = params->iTime;
  float u = ((float)x + 0.5f) / W, v = ((float)y + 0.5f) / H;
  float3 c = gr_tex(src, u, v);
  float off = params->offset;
  if (params->variant == 1) {
    float g = gr_tex(h2, u + off * 0.01f, v).y, b = gr_tex(h4, u + off * 0.02f, v).z;
    float3 e = gr_v3(c.x, g, b);
    c = gr_mix3(c, e, 0.5f + params->fade * 0.5f);
    _tex2DVec4Write(dst, x, y, to_float4(c.x, c.y, c.z, 1.0f));
    return;
  }
  float n = (float)params->n;
  float3 acc = c;
  float sh;
  sh = 6.0f; acc = gr_echoComp(acc, c, gr_tex(h6, u - off * 0.025f * sh, v - off * 0.006f * sh * _sinf(t + sh)), sh, n, params->fade, params->blendMode, params->tintMode, params->matte, t);
  sh = 5.0f; acc = gr_echoComp(acc, c, gr_tex(h5, u - off * 0.025f * sh, v - off * 0.006f * sh * _sinf(t + sh)), sh, n, params->fade, params->blendMode, params->tintMode, params->matte, t);
  sh = 4.0f; acc = gr_echoComp(acc, c, gr_tex(h4, u - off * 0.025f * sh, v - off * 0.006f * sh * _sinf(t + sh)), sh, n, params->fade, params->blendMode, params->tintMode, params->matte, t);
  sh = 3.0f; acc = gr_echoComp(acc, c, gr_tex(h3, u - off * 0.025f * sh, v - off * 0.006f * sh * _sinf(t + sh)), sh, n, params->fade, params->blendMode, params->tintMode, params->matte, t);
  sh = 2.0f; acc = gr_echoComp(acc, c, gr_tex(h2, u - off * 0.025f * sh, v - off * 0.006f * sh * _sinf(t + sh)), sh, n, params->fade, params->blendMode, params->tintMode, params->matte, t);
  sh = 1.0f; acc = gr_echoComp(acc, c, gr_tex(h1, u - off * 0.025f * sh, v - off * 0.006f * sh * _sinf(t + sh)), sh, n, params->fade, params->blendMode, params->tintMode, params->matte, t);
  _tex2DVec4Write(dst, x, y, to_float4(acc.x, acc.y, acc.z, 1.0f));
}
`,
  };

  // ---------------------------------------------------------------- SHADER TRANSITIONS
  K.GRTrans = {
    params: COMMON + ` float p; int mode; float intensity; int flash; float dirx; float diry; float tint[3];`,
    code: `
__DEVICE__ float gr_ease(float x) { return x * x * (3.0f - 2.0f * x); }
__DEVICE__ float3 gr_pick(__TEXTURE2D__ A, __TEXTURE2D__ B, float u, float v, float side) { return side < 0.5f ? gr_tex(A, u, v) : gr_tex(B, u, v); }

__KERNEL__ void GRTrans(__CONSTANTREF__ GRTransParams* params, __TEXTURE2D__ A, __TEXTURE2D__ B, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height, t = params->iTime;
  float u = ((float)x + 0.5f) / W, v = ((float)y + 0.5f) / H;
  float p = params->p, k = params->intensity;
  float env = _sinf(gr_sat(p) * GR_PI);
  float side = gr_step(0.5f, p);
  float3 tint = to_float3(params->tint[0], params->tint[1], params->tint[2]);
  float dxr = params->dirx, dyr = params->diry;
  int mode = params->mode;
  float3 c;
  if (mode == 0) {
    c = gr_pick(A, B, u, v, side);
    float f = _expf(-_fabs(p - 0.5f) * (6.0f + 10.0f * (1.0f - k)));
    c = gr_add3(gr_scale3(c, 1.0f + f * 4.0f * k), gr_v3(f * k * 1.2f, f * k * 1.2f, f * k * 1.2f));
  } else if (mode == 1) {
    float j = (gr_hash11(_floor(v * 90.0f) + _floor(t * 40.0f)) - 0.5f) * 0.08f * env * k;
    c = gr_pick(A, B, u + j, v, side);
    float nn = gr_hash21(_floor((float)x / 2.0f) + _floor(t * 60.0f) * 3.1f, _floor((float)y / 2.0f) + _floor(t * 60.0f) * 3.1f);
    float bars = 0.5f + 0.5f * _sinf(v * 40.0f + t * 30.0f);
    float m = nn * (0.6f + 0.4f * bars);
    c = gr_mix3(c, gr_v3(m, m, m), gr_sat(_powf(env, 0.6f) * k * 1.1f));
  } else if (mode == 2) {
    float st = _floor(p * (8.0f + k * 14.0f));
    float m = st - 4.0f * _floor(st / 4.0f);
    if (m < 1.0f) c = gr_tex(A, u, v);
    else if (m < 2.0f) c = gr_v3(1.0f, 1.0f, 1.0f);
    else if (m < 3.0f) c = gr_tex(B, u, v);
    else c = gr_v3(0.0f, 0.0f, 0.0f);
    if (p > 0.85f) c = gr_tex(B, u, v);
    if (p < 0.08f) c = gr_tex(A, u, v);
  } else if (mode == 3) {
    float px = (1.0f + env * env * k * 90.0f) * params->scale;
    float gx = (_floor((float)x / px) + 0.5f) * px / W, gy = (_floor((float)y / px) + 0.5f) * px / H;
    c = gr_mix3(gr_tex(A, gx, gy), gr_tex(B, gx, gy), gr_smooth(0.4f, 0.6f, p));
  } else if (mode == 4) {
    float dx = (u - 0.5f) * W / H, dy = v - 0.5f;
    float r = gr_len(dx, dy);
    float rad = gr_ease(p) * 1.4f;
    float ring = 1.0f - gr_smooth(0.0f, 0.12f, _fabs(r - rad));
    float nx = dx / (r + 1e-5f), ny = dy / (r + 1e-5f);
    float ox = nx * ring * 0.06f * k, oy = ny * ring * 0.06f * k;
    // textures cannot be stored in variables on OpenCL, so sample both and pick
    float3 ca = gr_v3(gr_tex(A, u - ox * 1.2f, v - oy * 1.2f).x, gr_tex(A, u - ox, v - oy).y, gr_tex(A, u - ox * 0.8f, v - oy * 0.8f).z);
    float3 cb = gr_v3(gr_tex(B, u - ox * 1.2f, v - oy * 1.2f).x, gr_tex(B, u - ox, v - oy).y, gr_tex(B, u - ox * 0.8f, v - oy * 0.8f).z);
    c = r < rad ? cb : ca;
    c = gr_add3(c, gr_scale3(tint, ring * env * 0.6f));
  } else if (mode == 5) {
    float ox = dxr * env * 0.12f * k, oy = dyr * env * 0.12f * k;
    float pr = gr_smooth(0.0f, 0.7f, p), pg = gr_smooth(0.15f, 0.85f, p), pb = gr_smooth(0.3f, 1.0f, p);
    c.x = gr_mix(gr_tex(A, u + ox, v + oy).x, gr_tex(B, u + ox, v + oy).x, pr);
    c.y = gr_mix(gr_tex(A, u, v).y, gr_tex(B, u, v).y, pg);
    c.z = gr_mix(gr_tex(A, u - ox, v - oy).z, gr_tex(B, u - ox, v - oy).z, pb);
  } else if (mode == 6) {
    float e = gr_ease(p);
    float spd = env * k * 0.18f;
    float3 s = gr_v3(0.0f, 0.0f, 0.0f);
    for (int i = 0; i < 16; i++) {
      float f = ((float)i / 15.0f - 0.5f) * spd;
      float qx = u + dxr * (e + f), qy = v + dyr * (e + f);
      int inA = (qx >= 0.0f && qx <= 1.0f && qy >= 0.0f && qy <= 1.0f) ? 1 : 0;
      s = gr_add3(s, inA ? gr_tex(A, qx, qy) : gr_tex(B, qx - dxr, qy - dyr));
    }
    c = gr_scale3(s, 1.0f / 16.0f);
  } else if (mode == 7) {
    float z = p < 0.5f ? 1.0f + gr_ease(p * 2.0f) * 2.5f * k : 1.0f + (1.0f - gr_ease((p - 0.5f) * 2.0f)) * 2.5f * k;
    float3 s = gr_v3(0.0f, 0.0f, 0.0f);
    float bl = env * 0.25f * k;
    for (int i = 0; i < 14; i++) {
      float f = 1.0f - bl * (float)i / 13.0f;
      s = gr_add3(s, gr_pick(A, B, 0.5f + (u - 0.5f) / (z * f), 0.5f + (v - 0.5f) / (z * f), side));
    }
    c = gr_scale3(s, 1.0f / 14.0f);
  } else if (mode == 8) {
    float rows = 18.0f + 40.0f * k;
    float row = _floor(v * rows);
    float sw = gr_step(gr_hash11(row * 1.7f), p * 1.2f - 0.1f);
    float sh = (gr_hash11(row + _floor(t * 20.0f)) - 0.5f) * env * 0.35f * k;
    float qx = u + sh;
    c = sw > 0.5f ? gr_tex(B, qx, v) : gr_tex(A, qx, v);
    c.x = (sw > 0.5f ? gr_tex(B, qx + 0.01f * env, v) : gr_tex(A, qx + 0.01f * env, v)).x;
    c = gr_add3(c, gr_scale3(tint, gr_step(0.96f, gr_hash21(row, _floor(t * 25.0f))) * env));
  } else if (mode == 9) {
    float dx = u - 0.5f, dy = v - 0.5f, r = gr_len(dx, dy);
    float w = _sinf(r * 60.0f - t * 12.0f) * 0.02f * env * k;
    float ox = dx / (r + 1e-5f) * w, oy = dy / (r + 1e-5f) * w;
    c = gr_mix3(gr_tex(A, u + ox, v + oy), gr_tex(B, u + ox, v + oy), gr_smooth(0.35f, 0.65f, p));
  } else if (mode == 10) {
    float dx = u - 0.5f, dy = v - 0.5f;
    float3 s = gr_v3(0.0f, 0.0f, 0.0f);
    float st = env * 0.5f * k;
    for (int i = 0; i < 18; i++) {
      float f = 1.0f - st * (float)i / 17.0f;
      s = gr_add3(s, gr_pick(A, B, 0.5f + dx * f, 0.5f + dy * f, side));
    }
    c = gr_scale3(s, 1.0f / 18.0f);
    c = gr_add3(c, gr_scale3(tint, _expf(-gr_len(dx, dy) * 6.0f) * env * env * 2.0f));
  } else if (mode == 11) {
    float3 s = gr_v3(0.0f, 0.0f, 0.0f);
    for (int i = 0; i < 5; i++) {
      float fi = (float)i;
      float ox = _sinf(t * 3.0f + fi * 1.7f) * 0.03f * env * k * fi, oy = _cosf(t * 2.3f + fi) * 0.03f * env * k * fi;
      float sp = gr_sat(p * 1.4f - fi * 0.1f);
      s = gr_add3(s, gr_scale3(gr_mix3(gr_tex(A, u + ox, v + oy), gr_tex(B, u + ox, v + oy), gr_smooth(0.3f, 0.7f, sp)), i == 0 ? 1.0f : 0.5f));
    }
    c = gr_scale3(s, 1.0f / 3.0f);
    c = gr_mix3(c, gr_mul3(c, gr_v3(0.7f, 1.0f, 1.15f)), env);
  } else if (mode == 12) {
    float nn = gr_fbm(u * 4.0f + t * 0.2f, v * 4.0f + t * 0.2f);
    float th = p * 1.3f - 0.15f;
    float l = gr_luma(gr_tex(A, u, v)) * 0.5f + nn * 0.5f;
    float burn = 1.0f - gr_smooth(th - 0.08f, th, l);
    float edge = 1.0f - gr_smooth(0.0f, 0.09f, _fabs(l - th));
    c = gr_mix3(gr_tex(A, u, v), gr_tex(B, u, v), burn);
    c = gr_add3(c, gr_scale3(gr_add3(gr_v3(2.0f, 1.1f, 0.2f), gr_scale3(tint, 0.5f)), edge * k));
  } else {
    float tt = _floor(t * 15.0f);
    float m = 1.0f + _floor(gr_hash11(tt) * 3.0f);
    float bx = _floor(u * 8.0f * m), by = _floor(v * 6.0f * m);
    float h = gr_hash21(bx, by);
    float sw = gr_step(h, p);
    float2 oo = gr_hash22(bx + tt, by + tt);
    float on = gr_step(0.7f, gr_hash21(bx + tt * 1.3f, by + tt * 1.3f));
    float ox = (oo.x - 0.5f) * 0.12f * env * k * on, oy = (oo.y - 0.5f) * 0.12f * env * k * on;
    c = sw > 0.5f ? gr_tex(B, u + ox, v + oy) : gr_tex(A, u + ox, v + oy);
    if (gr_hash21(bx + tt * 2.0f, by + tt * 2.0f) > 1.0f - env * 0.25f) c = gr_v3(c.y, c.z, c.x);
  }
  if (params->flash != 0) { float f = _expf(-_fabs(p - 0.5f) * 30.0f) * 0.9f; c = gr_add3(c, gr_v3(f, f, f)); }
  _tex2DVec4Write(dst, x, y, to_float4(c.x, c.y, c.z, 1.0f));
}
`,
  };

  // ---------------------------------------------------------------- DATAMOSH
  K.GRMoshMatch = {
    params: COMMON + ` float bs; float R; float fullW; float fullH;`,
    code: `
__KERNEL__ void GRMoshMatch(__CONSTANTREF__ GRMoshMatchParams* params, __TEXTURE2D__ cur, __TEXTURE2D__ prev, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float bs = params->bs, R = params->R, FW = params->fullW, FH = params->fullH;
  float bcx = ((float)x + 0.5f) * bs, bcy = ((float)y + 0.5f) * bs;
  float best = 1e9f, bvx = 0.0f, bvy = 0.0f;
  for (int dy = -3; dy <= 3; dy++) {
    for (int dx = -3; dx <= 3; dx++) {
      float ddx = (float)dx * R / 3.0f, ddy = (float)dy * R / 3.0f;
      float sad = 0.0f;
      for (int j = 0; j < 3; j++) {
        for (int i = 0; i < 3; i++) {
          float sx = bcx + ((float)i - 1.0f) * bs * 0.33f, sy = bcy + ((float)j - 1.0f) * bs * 0.33f;
          sad += _fabs(gr_luma(gr_tex(cur, sx / FW, sy / FH)) - gr_luma(gr_tex(prev, (sx - ddx) / FW, (sy - ddy) / FH)));
        }
      }
      sad += gr_len(ddx, ddy) * 0.0015f;
      if (sad < best) { best = sad; bvx = ddx; bvy = ddy; }
    }
  }
  _tex2DVec4Write(dst, x, y, to_float4(0.5f + bvx / (2.0f * R), 0.5f + bvy / (2.0f * R), 0.0f, 1.0f));
}
`,
  };

  K.GRMoshAdvect = {
    params: COMMON + ` float flowW; float flowH; float bs; float R; float intensity; float blend; float prog; int motion; float frameSeed;`,
    code: `
__KERNEL__ void GRMoshAdvect(__CONSTANTREF__ GRMoshAdvectParams* params, __TEXTURE2D__ mosh, __TEXTURE2D__ flow, __TEXTURE2D__ curB, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height, t = params->iTime;
  float fx = (float)x + 0.5f, fy = (float)y + 0.5f;
  float bs = params->bs, R = params->R;
  float bx = _floor(fx / bs), by = _floor(fy / bs);
  float dx, dy;
  if (params->motion == 0) {
    float3 f = gr_tex(flow, (bx + 0.5f) / params->flowW, (by + 0.5f) / params->flowH);
    dx = (f.x - 0.5f) * 2.0f * R; dy = (f.y - 0.5f) * 2.0f * R;
  } else if (params->motion == 1) {
    float a = gr_fbm((bx + 0.5f) / params->flowW * 3.0f + t * 0.2f, (by + 0.5f) / params->flowH * 3.0f + t * 0.2f) * 6.283f;
    dx = _cosf(a) * R * 0.6f; dy = _sinf(a) * R * 0.6f;
  } else {
    float2 h = gr_hash22(bx + params->frameSeed, by + params->frameSeed);
    float on = gr_step(0.6f, gr_hash21(bx * 1.7f + params->frameSeed, by * 1.7f + params->frameSeed));
    dx = (h.x - 0.5f) * R * 1.4f * on; dy = (h.y - 0.5f) * R * 1.4f * on;
  }
  dx *= params->intensity; dy *= params->intensity;
  float3 m = gr_tex(mosh, (fx - dx) / W, (fy - dy) / H);
  float3 b = gr_tex(curB, fx / W, fy / H);
  float refresh = params->blend * 0.05f * (0.5f + params->prog);
  float r = gr_step(gr_hash21(bx + params->frameSeed * 1.31f, by + params->frameSeed * 1.31f), refresh);
  float endMix = gr_smooth(0.78f, 1.0f, params->prog);
  m = gr_mix3(m, b, _fmaxf(r, endMix));
  _tex2DVec4Write(dst, x, y, to_float4(m.x, m.y, m.z, 1.0f));
}
`,
  };

  K.GRMoshLook = {
    params: COMMON + ` int variant; float prog; float colorSpeed; int flashes; float frameSeed;`,
    code: `
__KERNEL__ void GRMoshLook(__CONSTANTREF__ GRMoshLookParams* params, __TEXTURE2D__ mosh, __TEXTURE2D__ curB, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height, t = params->iTime;
  float u = ((float)x + 0.5f) / W, v = ((float)y + 0.5f) / H;
  float3 c = gr_tex(mosh, u, v);
  float prog = params->prog, cs = params->colorSpeed;
  float env = _sinf(gr_sat(prog) * GR_PI);
  int variant = params->variant;
  if (variant == 1) {
    float l3 = _powf(gr_luma(c), 3.0f) * env * 0.8f;
    c = gr_add3(gr_scale3(c, 1.0f + env * 0.9f), gr_v3(l3, l3, l3));
  } else if (variant == 2) {
    float pu = 1.5f * params->scale / W, pv = 1.5f * params->scale / H;
    float ed = gr_len(gr_luma(gr_tex(mosh, u + pu, v)) - gr_luma(gr_tex(mosh, u - pu, v)), gr_luma(gr_tex(mosh, u, v + pv)) - gr_luma(gr_tex(mosh, u, v - pv)));
    float3 h = gr_hueShift(gr_saturate(c, 1.8f), gr_fract(t * (0.1f + cs * 1.2f) + v * 0.3f));
    float3 neon = gr_add3(gr_scale3(h, 1.2f), gr_scale3(gr_hsv2rgb(gr_fract(t * cs + u), 1.0f, 1.0f), ed * 4.0f));
    c = gr_mix3(c, neon, env);
  } else if (variant == 3) {
    float l = gr_luma(c);
    float3 acid = gr_scale3(gr_hsv2rgb(gr_fract(l * 2.2f + t * (0.1f + cs)), 0.9f, 1.0f), 0.25f + l * 1.3f);
    float qx = (u - 0.5f) * W / H, qy = v - 0.5f;
    float s = 0.2f + env * 0.55f;
    float tri = _fmaxf(_fabs(qx) * 0.866f + qy * 0.5f, -qy) - s * 0.5f;
    float3 inside = gr_hueShift(gr_scale3(gr_tex(curB, u, v), 1.3f), gr_fract(t * cs));
    c = gr_mix3(c, acid, env * 0.85f);
    c = gr_mix3(c, inside, (1.0f - gr_smooth(-0.01f, 0.01f, tri)) * env);
  }
  if (params->flashes != 0) {
    float f = _expf(-prog * 40.0f) * 1.5f + gr_step(0.93f, gr_hash11(params->frameSeed)) * env * 0.8f;
    c = gr_add3(c, gr_v3(f, f, f));
  }
  _tex2DVec4Write(dst, x, y, to_float4(c.x, c.y, c.z, 1.0f));
}
`,
  };

  // ---------------------------------------------------------------- TITLES
  K.GRTitle = {
    params: COMMON + ` int style; float amount; float blurK; float hueK; float satK; float brightK; float contrastK; float tintK; float anim; float colour[3];`,
    code: `
__DEVICE__ float gr_mk(__TEXTURE2D__ T, float u, float v) { return _tex2DVecN(T, u, v, 15).w; }
__DEVICE__ float gr_glowM(__TEXTURE2D__ T, float u, float v, float r, float asp) {
  float s = 0.0f;
  for (int i = 0; i < 20; i++) {
    float a = (float)i * 2.39996f, rr = r * _sqrtf(((float)i + 0.5f) / 20.0f);
    s += gr_mk(T, u + _cosf(a) * rr * asp, v + _sinf(a) * rr);
  }
  return s / 20.0f;
}
__DEVICE__ float gr_dil(__TEXTURE2D__ T, float u, float v, float r, float asp) {
  float m = gr_mk(T, u, v);
  for (int i = 0; i < 12; i++) { float a = (float)i * 0.5236f; m = _fmaxf(m, gr_mk(T, u + _cosf(a) * r * asp, v + _sinf(a) * r)); }
  return m;
}
__DEVICE__ float gr_ero(__TEXTURE2D__ T, float u, float v, float r, float asp) {
  float m = gr_mk(T, u, v);
  for (int i = 0; i < 12; i++) { float a = (float)i * 0.5236f; m = _fminf(m, gr_mk(T, u + _cosf(a) * r * asp, v + _sinf(a) * r)); }
  return m;
}

__KERNEL__ void GRTitle(__CONSTANTREF__ GRTitleParams* params, __TEXTURE2D__ T, __TEXTURE2D_WRITE__ dst) {
  DEFINE_KERNEL_ITERATORS_XY(x, y);
  if (x >= params->width || y >= params->height) return;
  float W = (float)params->width, H = (float)params->height, t = params->iTime;
  float u = ((float)x + 0.5f) / W, v = ((float)y + 0.5f) / H, asp = H / W;
  float fx = (float)x / params->scale, fy = (float)y / params->scale;
  float am = params->amount * (1.0f + params->anim * 3.0f);
  float3 colour = to_float3(params->colour[0], params->colour[1], params->colour[2]);
  float qu = u, qv = v;
  if (params->anim > 0.0f) qu += (gr_hash11(_floor(v * 30.0f) + _floor(t * 30.0f)) - 0.5f) * params->anim * 0.3f;
  float3 col = gr_v3(0.0f, 0.0f, 0.0f);
  float a = 0.0f;
  int style = params->style;
  if (style == 0) {
    float tt = _floor(t * 18.0f);
    float2 jj = gr_hash22(_floor(fx / 2.0f) + tt, _floor(fy / 2.0f) + tt);
    float jx = (jj.x - 0.5f) * 0.012f * am, jy = (jj.y - 0.5f) * 0.012f * am;
    float row = _floor(v * 60.0f);
    qu += (gr_hash11(row + tt) - 0.5f) * 0.02f * am * gr_step(0.7f, gr_hash11(row * 3.0f + tt));
    float smear = 0.0f;
    float dl = gr_hash21(_floor(u * 160.0f), 1.0f);
    for (int i = 0; i < 6; i++) smear = _fmaxf(smear, gr_mk(T, qu + jx, qv + jy + (float)i * 0.006f * am * dl));
    float off = 0.006f * am;
    float r = _fmaxf(gr_mk(T, qu + jx + off, qv + jy), smear * 0.6f);
    float g = _fmaxf(gr_mk(T, qu + jx, qv + jy), smear * 0.6f);
    float b = _fmaxf(gr_mk(T, qu + jx - off, qv + jy), smear * 0.6f);
    float speck = gr_step(0.35f, gr_hash21(_floor(fx) + tt, _floor(fy) + tt));
    float3 base = gr_mix3(gr_v3(0.75f, 0.8f, 0.85f), colour, 0.45f);
    col = gr_scale3(gr_mul3(gr_v3(r * 1.1f, g * 0.9f, b * 1.15f), base), 0.55f + 0.45f * speck);
    a = _fmaxf(r, _fmaxf(g, b)) * (0.6f + 0.4f * speck);
  } else if (style == 1) {
    float colN = gr_noise(u * 55.0f, 3.0f);
    float len = colN * colN * colN * 0.18f * am;
    float drip = 0.0f;
    for (int i = 0; i < 10; i++) drip = _fmaxf(drip, gr_mk(T, qu, qv + (float)i / 9.0f * len) * (1.0f - (float)i / 12.0f));
    float lane = 1.0f - gr_smooth(0.0f, 0.02f, _fabs(gr_fract(u * 55.0f) - 0.5f) - 0.25f);
    float m = _fmaxf(gr_mk(T, qu, qv), drip * lane);
    float bands = _sinf((v + gr_fbm(u * 8.0f, v * 8.0f) * 0.05f) * 40.0f) * 0.5f + 0.5f;
    float3 chrome = gr_mix3(gr_v3(0.12f, 0.13f, 0.16f), gr_v3(0.95f, 0.97f, 1.0f), bands);
    chrome = gr_mix3(chrome, gr_scale3(gr_mul3(chrome, colour), 1.4f), 0.25f);
    float out1 = gr_dil(T, qu, qv, 0.006f, asp) - gr_mk(T, qu, qv);
    float b12 = _powf(bands, 12.0f) * 0.8f;
    chrome = gr_add3(chrome, gr_v3(b12, b12, b12));
    col = gr_add3(gr_scale3(chrome, m), gr_v3(0.02f * out1, 0.02f * out1, 0.02f * out1));
    a = _fmaxf(m, out1);
  } else if (style == 2) {
    float m = gr_mk(T, qu, qv);
    float rim = m - gr_ero(T, qu, qv, 0.006f, asp);
    float flick = gr_step(0.08f, gr_hash11(_floor(u * 7.0f) + _floor(t * 12.0f))) * 0.7f + 0.3f;
    float halo = gr_glowM(T, qu, qv, 0.05f, asp);
    col = gr_scale3(colour, (rim * 2.0f + m * 0.25f) * flick + halo * 1.4f * flick);
    col = gr_add3(col, gr_v3(rim * 0.6f * flick, rim * 0.6f * flick, rim * 0.6f * flick));
    a = gr_sat(rim + m * 0.3f + halo * 1.2f);
  } else if (style == 3) {
    float ln = _floor(fy / 3.0f);
    float odd = ln - 2.0f * _floor(ln / 2.0f);
    qu += (odd - 0.5f) * 0.02f * am * _sinf(t * 3.0f + ln * 0.2f);
    float m = gr_mk(T, qu, qv) * gr_step(0.34f, gr_fract(fy / 3.0f));
    col = gr_scale3(gr_mix3(colour, gr_v3(1.0f, 1.0f, 1.0f), gr_smooth(0.3f, 0.7f, v)), m);
    a = m;
  } else if (style == 4) {
    float nx = gr_noise(u * 90.0f + 3.0f, v * 90.0f + 3.0f) - 0.5f, ny = gr_noise(u * 90.0f + 9.0f, v * 90.0f + 9.0f) - 0.5f;
    float near = gr_smooth(0.0f, 0.6f, gr_glowM(T, u, v, 0.01f, asp));
    qu += nx * 0.02f * am * near; qv += ny * 0.02f * am * near;
    float m = gr_mk(T, qu, qv);
    float halo = gr_glowM(T, qu, qv, 0.06f, asp);
    col = gr_add3(gr_scale3(gr_mix3(gr_v3(0.04f, 0.0f, 0.03f), gr_scale3(colour, 0.3f), m), m), gr_scale3(colour, halo * 1.6f));
    col = gr_add3(col, gr_scale3(colour, (m - gr_ero(T, qu, qv, 0.004f, asp)) * 1.8f));
    a = gr_sat(m + halo * 1.3f);
  } else if (style == 5) {
    float wx = gr_fbm(u * 6.0f, v * 6.0f - t * 0.4f) - 0.5f, wy = gr_fbm(u * 6.0f + 4.0f, v * 6.0f + 4.0f - t * 0.4f) - 0.5f;
    float m = gr_mk(T, qu + wx * 0.025f * am, qv + wy * 0.025f * am);
    float rise = gr_glowM(T, qu + wx * 0.06f, qv - 0.03f - 0.04f * am + wy * 0.06f, 0.04f, asp);
    float diss = gr_smooth(0.25f, 0.6f, gr_fbm(u * 5.0f, v * 5.0f - t * 0.6f) + 0.2f);
    float f9 = gr_fbm(u * 9.0f - t * 0.3f, v * 9.0f - t * 0.3f);
    col = gr_scale3(gr_mix3(gr_v3(0.9f, 0.9f, 0.9f), colour, 0.3f), m * diss + rise * 0.55f * f9);
    a = gr_sat(m * diss + rise * 0.6f);
  } else if (style == 6) {
    float m = gr_mk(T, qu, qv);
    float3 g = gr_ramp3(v, gr_v3(0.05f, 0.2f, 0.6f), gr_v3(0.35f, 0.85f, 1.0f), gr_v3(1.0f, 1.0f, 1.0f));
    float cry = gr_hash21(_floor(u * 70.0f), _floor(v * 70.0f));
    float fx2 = gr_fract(u * 70.0f) - 0.5f, fy2 = gr_fract(v * 70.0f) - 0.5f;
    float facet = 1.0f - gr_smooth(0.1f, 0.5f, _fabs(fx2 + fy2 * (cry - 0.5f) * 2.0f));
    float sp = _powf(_fmaxf(_sinf(t * 4.0f + cry * 30.0f), 0.0f), 20.0f) * gr_step(0.85f, cry);
    float dm = gr_dil(T, qu, qv, 0.004f, asp);
    col = gr_add3(gr_scale3(gr_add3(gr_scale3(g, 0.75f + 0.35f * facet), gr_v3(sp, sp, sp)), m), gr_scale3(gr_v3(0.9f, 1.0f, 1.0f), dm - m));
    col = gr_mix3(col, gr_scale3(gr_mul3(col, colour), 1.3f), 0.15f);
    a = _fmaxf(m, dm);
  } else if (style == 7) {
    float m = gr_mk(T, qu, qv);
    float halo = gr_glowM(T, qu, qv, 0.045f, asp);
    float gn = gr_hash21(_floor(fx) + _floor(t * 12.0f), _floor(fy)) * 0.06f;
    float3 fill = gr_add3(gr_mix3(gr_v3(0.02f, 0.02f, 0.02f), gr_v3(0.35f, 0.02f, 0.04f), v), gr_v3(gn, gn, gn));
    col = gr_add3(gr_add3(gr_scale3(fill, m), gr_scale3(colour, 0.8f * halo * (1.0f - m))), gr_scale3(gr_v3(0.6f, 0.1f, 0.1f), m - gr_ero(T, qu, qv, 0.003f, asp)));
    a = gr_sat(m + halo);
  } else if (style == 8) {
    float bounce = 1.0f + 0.04f * _sinf(t * 6.0f) * am;
    qu = 0.5f + (qu - 0.5f) / bounce; qv = 0.5f + (qv - 0.5f) / bounce;
    float m = gr_mk(T, qu, qv);
    float outl = gr_dil(T, qu, qv, 0.012f, asp);
    float sh = gr_dil(T, qu - 0.008f, qv + 0.012f, 0.012f, asp);
    float stripe = gr_step(0.5f, gr_fract((u + v) * 14.0f - t * 0.8f));
    float3 candy = gr_mix3(gr_mix3(gr_v3(1.0f, 0.45f, 0.75f), gr_v3(1.0f, 0.92f, 0.4f), stripe), colour, 0.25f);
    col = gr_add3(gr_add3(gr_scale3(candy, m), gr_v3(outl - m, outl - m, outl - m)), gr_scale3(gr_v3(0.25f, 0.0f, 0.2f), (sh - outl) * gr_step(outl, 0.5f)));
    a = _fmaxf(_fmaxf(m, outl), sh * 0.8f);
  } else {
    float row = _floor(fy / 2.0f);
    qu += (gr_hash11(row + _floor(t * 24.0f)) - 0.5f) * 0.006f * am;
    float m = gr_glowM(T, qu, qv, 0.004f + 0.006f * am, asp);
    float halo = gr_glowM(T, qu, qv, 0.04f, asp);
    float3 c2 = gr_mix3(colour, gr_v3(0.3f, 0.45f, 1.0f), 0.6f);
    col = gr_add3(gr_scale3(c2, m * 1.3f), gr_scale3(c2, halo * 0.9f));
    col = gr_scale3(col, 0.85f + 0.15f * _sinf(fy * 1.5f));
    a = gr_sat(m + halo * 0.8f);
  }
  if (params->blurK > 0.0f) {
    float g = gr_glowM(T, qu, qv, 0.03f * params->blurK, asp);
    col = gr_add3(col, gr_scale3(colour, g * params->blurK * 0.8f));
    a = gr_sat(a + g * params->blurK * 0.7f);
  }
  col = gr_mix3(col, gr_scale3(gr_mul3(col, colour), 1.5f), params->tintK);
  col = gr_hueShift(gr_clamp3(col, 0.0f, 4.0f), params->hueK);
  col = gr_saturate(col, params->satK);
  col = gr_add3(gr_scale3(gr_sub3(col, gr_v3(0.5f, 0.5f, 0.5f)), params->contrastK), gr_v3(0.5f, 0.5f, 0.5f));
  col = gr_max3(gr_scale3(col, params->brightK), gr_v3(0.0f, 0.0f, 0.0f));
  // Fusion works premultiplied, and col already scales with coverage
  _tex2DVec4Write(dst, x, y, to_float4(col.x, col.y, col.z, a));
}
`,
  };
};
