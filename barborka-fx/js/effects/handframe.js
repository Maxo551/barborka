// HAND FRAME: the space between your hands becomes a camcorder viewfinder
// with its own look (night vision, infrared, thermal...). Hands are found with
// MediaPipe's hand landmarker when it can load; otherwise the frame follows
// movement (AUTO) or sits in the middle with a hand-held drift (CENTER).
(function () {
  'use strict';
  const BFX = window.BFX;
  const M = BFX.map;

  // ------------------------------------------------------------ hand landmarker
  const Hands = {
    state: 'idle', // idle | loading | ready | failed
    lm: null,
    lastTs: -1,
    canvas: null,
    async load() {
      if (this.state !== 'idle') return;
      this.state = 'loading';
      try {
        const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
        const vision = await import(base + '/vision_bundle.mjs');
        const fileset = await vision.FilesetResolver.forVisionTasks(base + '/wasm');
        this.lm = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        this.state = 'ready';
      } catch (err) {
        console.warn('[BFX] hand tracking unavailable, using AUTO frame:', err && err.message);
        this.state = 'failed';
      }
    },
    // source: anything drawable. Returns array of hands (21 landmarks, x/y in 0..1 top-left origin) or null.
    detect(source, w, h, tsMs) {
      if (this.state !== 'ready') return null;
      if (!this.canvas) this.canvas = document.createElement('canvas');
      const c = this.canvas;
      const sw = 320, sh = Math.max(1, Math.round((320 * h) / w));
      if (c.width !== sw || c.height !== sh) { c.width = sw; c.height = sh; }
      c.getContext('2d').drawImage(source, 0, 0, sw, sh);
      const ts = Math.max(this.lastTs + 1, Math.round(tsMs));
      this.lastTs = ts;
      try {
        const r = this.lm.detectForVideo(c, ts);
        return r && r.landmarks ? r.landmarks : [];
      } catch (e) {
        return null;
      }
    },
  };
  BFX.Hands = Hands;

  const FRAG = BFX.GLSL_INSIDE + `
uniform sampler2D src, over;
uniform vec4 rect;      // x0, y0, x1, y1 in uv (bottom-left origin)
uniform float vis, inside, outside, zoom, rgb;
void main(){
  vec3 c = texture(src, uv).rgb;
  vec2 lo = rect.xy, hi = rect.zw;
  float feather = 1.5 / res.y;
  float m = smoothstep(lo.x - feather, lo.x + feather, uv.x) * smoothstep(hi.x + feather, hi.x - feather, uv.x)
          * smoothstep(lo.y - feather, lo.y + feather, uv.y) * smoothstep(hi.y + feather, hi.y - feather, uv.y);
  m *= vis;
  vec3 outC = c;
  if (outside > .5 && outside < 1.5) outC = c * .4;
  else if (outside > 1.5 && outside < 2.5) outC = vec3(luma(c));
  else if (outside > 2.5) { vec3 s = vec3(0.); for (int i = 0; i < 9; i++) { vec2 k = vec2(float(i % 3) - 1., float(i / 3) - 1.) * 6. / res; s += texture(src, uv + k).rgb; } outC = s / 9. * .8; }
  vec2 ctr = (lo + hi) * .5;
  vec2 q = ctr + (uv - ctr) / zoom;
  vec3 ic;
  if (rgb > 0.) {
    vec2 off = vec2(rgb * .006, 0.);
    ic = vec3(texture(src, q + off).r, texture(src, q).g, texture(src, q - off).b);
  } else ic = texture(src, q).rgb;
  ic = insideLook(inside, ic, q, src);
  vec3 col = mix(outC, ic, m);
  vec4 v = texture(over, uv);
  o = vec4(mix(col, v.rgb, v.a), 1.);
}`;

  const COLORS = ['#ffffff', '#a6ffb0', '#ff3045', '#ffe14a', '#3de0ff', '#ff4ff0'];
  const LABELS = ['NV · IR', 'IR', 'THERMAL', 'B/W', 'NEG', 'POSTER'];

  BFX.registerEffect('handframe', {
    create(e) {
      const overlay = new BFX.Overlay(e);
      const post = new BFX.Post(e);
      const tmp = e.target(4, 4);
      let rect = null, vis = 0, lastSeen = -10, prevL = null;
      const reset = () => { rect = null; vis = 0; prevL = null; lastSeen = -10; };
      return {
        reset,
        render(ctx) {
          const P = ctx.params;
          const W = ctx.w, H = ctx.h;
          e.resize(tmp, W, H);
          let target = null; // [x0,y0,x1,y1] in 0..1, top-left origin
          const pad = M(P.padding, -0.02, 0.08);
          if (P.tracking === 0) {
            Hands.load();
            if (ctx.srcEl && Hands.state === 'ready') {
              const hands = Hands.detect(ctx.srcEl, ctx.srcW || W, ctx.srcH || H, ctx.t * 1000);
              if (hands && hands.length >= 2) {
                const pts = [];
                hands.slice(0, 2).forEach((h) => [4, 8, 12].forEach((i) => pts.push(h[i])));
                target = bbox(pts, pad);
              } else if (hands && hands.length === 1) {
                target = bbox(hands[0], pad + 0.04);
              }
            }
          }
          if (!target && (P.tracking === 1 || (P.tracking === 0 && Hands.state !== 'ready'))) {
            target = motionBox(e, ctx, prevL, (L) => (prevL = L), pad);
          }
          if (!target && P.tracking === 2 || (!target && Hands.state === 'failed')) {
            const sz = M(P.padding, 0.35, 0.7);
            const dx = Math.sin(ctx.t * 0.9) * 0.02 + Math.sin(ctx.t * 2.3) * 0.008;
            const dy = Math.cos(ctx.t * 0.7) * 0.015;
            target = [0.5 - sz / 2 + dx, 0.5 - sz / 2 + dy, 0.5 + sz / 2 + dx, 0.5 + sz / 2 + dy];
          }
          if (target) {
            lastSeen = ctx.t;
            const k = P.smooth >= 0.99 ? 0.05 : M(P.smooth, 0.9, 0.08);
            if (!rect || !ctx.live && ctx.frame === 0) rect = target.slice();
            else for (let i = 0; i < 4; i++) rect[i] += (target[i] - rect[i]) * k;
            vis = Math.min(1, vis + 0.25);
          } else if (ctx.t - lastSeen > 0.4) vis = Math.max(0, vis - 0.15);
          const r = rect || [0.3, 0.3, 0.7, 0.7];
          const col = COLORS[P.colour] || '#ffffff';
          const x = overlay.begin(W, H);
          if (vis > 0.01) {
            x.globalAlpha = vis;
            const pr = [r[0] * W, r[1] * H, r[2] * W, r[3] * H];
            if (P.frame === 1) {
              x.strokeStyle = col; x.lineWidth = Math.max(2, H * 0.004);
              if (P.glow > 0) { x.shadowColor = col; x.shadowBlur = H * 0.02 * P.glow; }
              x.strokeRect(pr[0], pr[1], pr[2] - pr[0], pr[3] - pr[1]);
              x.shadowBlur = 0;
            }
            if (P.hud !== 2) {
              BFX.drawHud(x, pr, ctx.t, {
                color: col,
                glow: P.glow > 0.3,
                corners: P.frame === 0,
                label: P.hud === 0 ? LABELS[P.inside] : null,
                timecode: P.hud === 0,
                battery: P.hud === 0,
                cross: P.hud === 0,
              });
            } else if (P.frame === 0) {
              BFX.drawHud(x, pr, ctx.t, { color: col, rec: false, timecode: false, battery: false });
            }
          }
          const overTex = overlay.commit();
          e.draw(e.program('handframe', FRAG), {
            src: ctx.src,
            over: overTex,
            rect: [r[0], 1 - r[3], r[2], 1 - r[1]],
            vis,
            inside: P.inside,
            outside: P.outside,
            zoom: M(P.zoom, 1, 2.5),
            rgb: P.rgb,
          }, tmp);
          post.run(tmp, { glow: P.glow * 0.5, thresh: 0.6, grain: 0.15 }, ctx.out);
        },
      };
    },
  });

  function bbox(pts, pad) {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    if (x1 - x0 < 0.05 || y1 - y0 < 0.05) return null;
    return [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(1, x1 + pad), Math.min(1, y1 + pad)];
  }

  // Bounding box of where the picture moves (weighted mean +- spread).
  function motionBox(e, ctx, prevL, keep, pad) {
    const AW = 96, AH = 54;
    const px = e.readSmall(ctx.src, AW, AH);
    const L = new Float32Array(AW * AH);
    for (let i = 0; i < L.length; i++) L[i] = px[i * 4 + 1] / 255;
    keep(L);
    if (!prevL) return null;
    let sw = 0, sx = 0, sy = 0, sxx = 0, syy = 0;
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const i = y * AW + x;
      const d = Math.abs(L[i] - prevL[i]);
      if (d < 0.04) continue;
      const u = (x + 0.5) / AW, v = 1 - (y + 0.5) / AH; // to top-left origin
      sw += d; sx += u * d; sy += v * d; sxx += u * u * d; syy += v * v * d;
    }
    if (sw < 2) return null;
    const mx = sx / sw, my = sy / sw;
    const dx = Math.sqrt(Math.max(0, sxx / sw - mx * mx)) * 1.6 + 0.08;
    const dy = Math.sqrt(Math.max(0, syy / sw - my * my)) * 1.6 + 0.08;
    return [Math.max(0, mx - dx - pad), Math.max(0, my - dy - pad), Math.min(1, mx + dx + pad), Math.min(1, my + dy + pad)];
  }
})();
