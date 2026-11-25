// BLOB TRACK: finds interesting spots (movement, highlights, shadows or
// contrast) on a downscaled copy of each frame, keeps them as tracks with
// stable ids, then draws boxes, connecting lines and data labels on top. The
// inside of every box can get its own treatment (invert, thermal, zoom...).
(function () {
  'use strict';
  const BFX = window.BFX;
  const M = BFX.map;
  const AW = 128, AH = 72;

  const COLORS = ['#ffffff', '#ff3045', '#ff9a1f', '#ffe14a', '#3dff7a', '#3de0ff', '#ff4ff0'];
  const WORDS = ['TARGET', 'SUBJECT', 'NODE', 'SIGNAL', 'GHOST', 'ECHO', 'VOID', 'LOCK', 'TRACE', 'UNIT', 'ANGEL', 'DEMON', 'STAR', 'NOISE', 'HALO', 'RIFT'];

  const FRAG = BFX.GLSL_INSIDE + `
uniform sampler2D src, mask, over;
uniform float baseLook, boxFx;
void main(){
  vec3 c = texture(src, uv).rgb;
  vec3 b = c;
  float L = luma(c);
  if (baseLook > .5 && baseLook < 1.5) b = vec3(L);
  else if (baseLook < 2.5 && baseLook > 1.5) b = c * .45;
  else if (baseLook < 3.5 && baseLook > 2.5) b = 1. - c;
  else if (baseLook > 3.5) b = heat(L);
  vec4 m = texture(mask, uv);
  vec3 inside = b;
  if (boxFx > .5) {
    if (boxFx < 1.5) inside = 1. - b;
    else if (boxFx < 2.5) inside = heat(L * 1.1);
    else if (boxFx < 3.5) { vec2 ctr = m.gb; inside = texture(src, ctr + (uv - ctr) * .5).rgb; }
    else if (boxFx < 4.5) { vec2 g = (floor(uv * res / 10.) + .5) * 10. / res; inside = texture(src, g).rgb; }
    else inside = insideLook(0., c, uv, src);
  }
  vec3 col = mix(b, inside, m.r);
  vec4 v = texture(over, uv);
  o = vec4(mix(col, v.rgb, v.a), 1.);
}`;

  function analyse(px, prev, mode) {
    // returns score field (Float32Array AW*AH), rows bottom-up like GL
    const n = AW * AH;
    const L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = (px[i * 4] * 0.2126 + px[i * 4 + 1] * 0.7152 + px[i * 4 + 2] * 0.0722) / 255;
    const S = new Float32Array(n);
    let motionTotal = 0;
    for (let y = 1; y < AH - 1; y++) {
      for (let x = 1; x < AW - 1; x++) {
        const i = y * AW + x;
        const gx = L[i + 1] - L[i - 1], gy = L[i + AW] - L[i - AW];
        const contrast = Math.sqrt(gx * gx + gy * gy);
        const motion = prev ? Math.abs(L[i] - prev[i]) : 0;
        motionTotal += motion;
        let s;
        if (mode === 1) s = motion * 4 + contrast * 0.2;
        else if (mode === 2) s = Math.pow(L[i], 3) + contrast * 0.1;
        else if (mode === 3) s = Math.pow(1 - L[i], 3) * 0.6 + contrast * 0.2;
        else s = motion * 3 + contrast * 0.8 + Math.pow(L[i], 4) * 0.4;
        S[i] = s;
      }
    }
    return { S, L, motion: motionTotal / n };
  }

  function pickPoints(S, count, rnd) {
    const cand = [];
    const G = 8;
    for (let gy = 0; gy < AH; gy += G) {
      for (let gx = 0; gx < AW; gx += G) {
        let best = -1, bi = 0;
        for (let y = gy; y < Math.min(AH, gy + G); y++) for (let x = gx; x < Math.min(AW, gx + G); x++) {
          const v = S[y * AW + x];
          if (v > best) { best = v; bi = y * AW + x; }
        }
        // analysis rows are bottom-up, so row / AH is already the uv y
        cand.push({ x: ((bi % AW) + 0.5) / AW, y: (Math.floor(bi / AW) + 0.5) / AH, s: best + rnd() * 0.002 });
      }
    }
    cand.sort((a, b) => b.s - a.s);
    const out = [];
    for (const c of cand) {
      if (out.length >= count) break;
      if (c.s <= 0.01) break;
      if (out.every((o) => Math.hypot(o.x - c.x, (o.y - c.y) * 0.56) > 0.08)) out.push(c);
    }
    return out;
  }

  BFX.registerEffect('blob', {
    create(e) {
      const overlay = new BFX.Overlay(e);
      const mask = new BFX.Overlay(e);
      const post = new BFX.Post(e);
      const tmp = e.target(4, 4);
      let tracks = [], prevL = null, nextId = 1, frame = 0;
      const rnd = BFX.util.rand(1234);
      return {
        reset() { tracks = []; prevL = null; frame = 0; },
        render(ctx) {
          const P = ctx.params;
          const W = ctx.w, H = ctx.h;
          e.resize(tmp, W, H);
          const px = e.readSmall(ctx.src, AW, AH);
          const modeMap = [0, 1, 2, 3];
          const a = analyse(px, prevL, modeMap[P.tracks] || 0);
          prevL = a.L;
          const count = Math.round(M(P.boxes, 2, 16));
          const pts = pickPoints(a.S, count, rnd);
          const smooth = P.motion === 1 ? 0.18 : P.motion === 2 ? 1 : 0.45;
          // match points to existing tracks
          const used = new Set();
          for (const t of tracks) {
            let best = null, bd = 0.12;
            for (const p of pts) {
              if (used.has(p)) continue;
              const d = Math.hypot(p.x - t.x, (p.y - t.y) * 0.56);
              if (d < bd) { bd = d; best = p; }
            }
            if (best) {
              used.add(best);
              t.x += (best.x - t.x) * smooth; t.y += (best.y - t.y) * smooth;
              t.s = best.s; t.miss = 0;
            } else t.miss++;
          }
          for (const p of pts) if (!used.has(p) && tracks.length < count + 4) tracks.push({ id: nextId++, x: p.x, y: p.y, s: p.s, miss: 0, born: frame, seed: rnd() });
          tracks = tracks.filter((t) => t.miss < 6).slice(0, count + 4);
          frame++;

          const col = COLORS[P.colour] || '#ffffff';
          const x = overlay.begin(W, H);
          const mx = mask.begin(W, H);
          const s = Math.min(W, H);
          const boxBase = s * M(P.boxSize, 0.04, 0.22);
          const visible = tracks.filter((t) => {
            if (P.motion !== 0) return true; // flicker mode hides boxes at random
            return ((Math.floor(frame / 3) * 7 + t.id * 13) % 10) > 1;
          }).slice(0, count);
          x.strokeStyle = col;
          x.fillStyle = col;
          x.lineWidth = Math.max(1, s * 0.0022);
          if (P.glow === 1) { x.shadowColor = col; x.shadowBlur = s * 0.02; }
          // lines
          const pts2 = visible.map((t) => [t.x * W, (1 - t.y) * H]);
          x.beginPath();
          if (P.lines === 0) { // web: each to its two nearest
            pts2.forEach((p, i) => {
              const near = pts2.map((q, j) => [Math.hypot(q[0] - p[0], q[1] - p[1]), j]).filter((d) => d[1] !== i).sort((u, v) => u[0] - v[0]).slice(0, 2);
              near.forEach(([, j]) => { x.moveTo(p[0], p[1]); x.lineTo(pts2[j][0], pts2[j][1]); });
            });
          } else if (P.lines === 1) {
            pts2.forEach((p, i) => { if (i) { x.moveTo(pts2[i - 1][0], pts2[i - 1][1]); x.lineTo(p[0], p[1]); } });
          } else if (P.lines === 2 && pts2.length) {
            pts2.forEach((p) => { x.moveTo(pts2[0][0], pts2[0][1]); x.lineTo(p[0], p[1]); });
          }
          x.globalAlpha = 0.8; x.stroke(); x.globalAlpha = 1;
          // boxes
          const font = Math.max(9, Math.round(s * 0.02));
          x.font = font + 'px "Share Tech Mono", "Consolas", monospace';
          x.textBaseline = 'bottom';
          mx.fillStyle = '#fff';
          for (const t of visible) {
            const cx = t.x * W, cy = (1 - t.y) * H;
            const jitter = P.motion === 0 ? 1 + (((frame + t.id * 5) % 7) / 7 - 0.5) * 0.25 : 1;
            const bw = boxBase * (0.7 + t.seed * 0.8) * jitter, bh = bw * (0.7 + ((t.id * 37) % 10) / 20);
            const x0 = cx - bw / 2, y0 = cy - bh / 2;
            const shape = P.boxShape;
            x.beginPath();
            if (shape === 0) x.rect(x0, y0, bw, bh);
            else if (shape === 1) {
              const c = bw * 0.25;
              [[x0, y0, 1, 1], [x0 + bw, y0, -1, 1], [x0, y0 + bh, 1, -1], [x0 + bw, y0 + bh, -1, -1]].forEach(([qx, qy, dx, dy]) => {
                x.moveTo(qx, qy + c * dy); x.lineTo(qx, qy); x.lineTo(qx + c * dx, qy);
              });
            } else if (shape === 2) x.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2);
            else {
              x.moveTo(cx - bw / 2, cy); x.lineTo(cx + bw / 2, cy); x.moveTo(cx, cy - bh / 2); x.lineTo(cx, cy + bh / 2);
              x.rect(cx - 3, cy - 3, 6, 6);
            }
            x.stroke();
            if (P.boxFx > 0) {
              mx.fillStyle = 'rgb(255,' + Math.round((cx / W) * 255) + ',' + Math.round((1 - cy / H) * 255) + ')';
              if (shape === 2) { mx.beginPath(); mx.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2); mx.fill(); } else mx.fillRect(x0, y0, bw, bh);
            }
            let label = '';
            if (P.words === 0) label = '0x' + ((t.id * 2654435761) >>> 0).toString(16).slice(0, 4).toUpperCase() + ' ' + (t.s * 100).toFixed(1);
            else if (P.words === 1) label = 'X ' + t.x.toFixed(3) + ' Y ' + t.y.toFixed(3);
            else if (P.words === 2) label = WORDS[t.id % WORDS.length] + ' ' + String(t.id).padStart(2, '0');
            if (label) x.fillText(label, x0, y0 - 3);
          }
          const overTex = overlay.commit();
          const maskTex = mask.commit();
          e.draw(e.program('blob', FRAG), { src: ctx.src, mask: maskTex, over: overTex, baseLook: P.look, boxFx: P.boxFx }, tmp);
          post.run(tmp, { glow: P.glow === 1 ? 0.35 : 0, thresh: 0.7 }, ctx.out);
        },
      };
    },
  });

  BFX.BLOB_COLORS = COLORS;
})();
