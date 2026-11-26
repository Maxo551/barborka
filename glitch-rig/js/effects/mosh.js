// DATAMOSH transitions. Real datamosh drops the keyframe of the next shot so
// its motion vectors push the pixels of the previous shot around. Here the
// motion is estimated on the GPU by block matching consecutive frames of the
// incoming clip, and those block vectors smear the last frame of the outgoing
// clip, until the incoming picture bleeds through and takes over.
(function () {
  'use strict';
  const GR = window.GR;
  const M = GR.map;

  const MATCH = `uniform sampler2D cur, prev;
uniform float bs, R; uniform vec2 full;
void main(){
  vec2 bc = (floor(uv * res) + .5) * bs;
  float best = 1e9; vec2 bv = vec2(0.);
  for (int dy = -3; dy <= 3; dy++) for (int dx = -3; dx <= 3; dx++) {
    vec2 d = vec2(float(dx), float(dy)) * R / 3.;
    float sad = 0.;
    for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
      vec2 sp = bc + (vec2(float(i), float(j)) - 1.) * bs * .33;
      sad += abs(luma(texture(cur, sp / full).rgb) - luma(texture(prev, (sp - d) / full).rgb));
    }
    sad += length(d) * .0015;
    if (sad < best) { best = sad; bv = d; }
  }
  o = vec4(.5 + bv / (2. * R), 0., 1.);
}`;

  const ADVECT = `uniform sampler2D mosh, flow, curB;
uniform vec2 flowRes; uniform float bs, R, intensity, blend, prog, motion, frameSeed;
void main(){
  vec2 fc = uv * res;
  vec2 bi = floor(fc / bs);
  vec2 d;
  if (motion < .5) d = (texture(flow, (bi + .5) / flowRes).xy - .5) * 2. * R;
  else if (motion < 1.5) {
    vec2 p = (bi + .5) / flowRes;
    float a = fbm(p * 3. + time * .2) * 6.283;
    d = vec2(cos(a), sin(a)) * R * .6;
  } else d = (hash22(bi + frameSeed) - .5) * R * 1.4 * step(.6, hash21(bi * 1.7 + frameSeed));
  d *= intensity;
  vec3 m = texture(mosh, (fc - d) / res).rgb;
  vec3 b = texture(curB, uv).rgb;
  float refresh = blend * .05 * (.5 + prog);
  float r = step(hash21(bi + frameSeed * 1.31), refresh);
  float endMix = smoothstep(.78, 1., prog);
  o = vec4(mix(m, b, max(r, endMix)), 1.);
}`;

  const LOOK = `uniform sampler2D mosh, curB, curA;
uniform float variant, prog, colorSpeed, flashes, frameSeed;
void main(){
  vec3 c = texture(mosh, uv).rgb;
  float env = sin(clamp(prog, 0., 1.) * PI);
  if (variant > .5 && variant < 1.5) {            // BLOOM: bright surge
    c = c * (1. + env * .9) + pow(luma(c), 3.) * env * .8;
  } else if (variant > 1.5 && variant < 2.5) {    // NEON: hue cycling + glowing edges
    vec2 px = 1.5 / res;
    float ed = length(vec2(luma(texture(mosh, uv + vec2(px.x, 0.)).rgb) - luma(texture(mosh, uv - vec2(px.x, 0.)).rgb),
                           luma(texture(mosh, uv + vec2(0., px.y)).rgb) - luma(texture(mosh, uv - vec2(0., px.y)).rgb)));
    vec3 h = hueShift(saturateC(c, 1.8), time * (.1 + colorSpeed * 1.2) + uv.y * .3);
    c = mix(c, h * 1.2 + ed * 4. * hsv2rgb(vec3(fract(time * colorSpeed + uv.x), 1., 1.)), env);
  } else if (variant > 2.5) {                       // ACID: solarised colour cycling + prism shape
    float l = luma(c);
    vec3 acid = hsv2rgb(vec3(fract(l * 2.2 + time * (.1 + colorSpeed)), .9, 1.)) * (.25 + l * 1.3);
    vec2 q = (uv - .5) * vec2(res.x / res.y, 1.);
    float s = .2 + env * .55;
    float tri = max(abs(q.x) * .866 + q.y * .5, -q.y) - s * .5;
    vec3 inside = hueShift(texture(curB, uv).rgb * 1.3, time * colorSpeed);
    c = mix(c, acid, env * .85);
    c = mix(c, inside, smoothstep(.01, -.01, tri) * env);
  }
  if (flashes > .5) {
    float f = exp(-prog * 40.) * 1.5 + step(.93, hash11(frameSeed)) * env * .8;
    c += f;
  }
  o = vec4(c, 1.);
}`;

  GR.registerEffect('mosh', {
    create(e) {
      const post = new GR.Post(e);
      let mA = e.target(4, 4), mB = e.target(4, 4);
      const prevB = e.target(4, 4);
      const flow = e.target(4, 4, { nearest: true });
      const look = e.target(4, 4);
      let started = false, lastP = -1, frame = 0;
      return {
        reset() { started = false; lastP = -1; frame = 0; },
        render(ctx) {
          const P = ctx.params, V = ctx.card.look;
          const W = ctx.w, H = ctx.h;
          [mA, mB, prevB, look].forEach((t) => e.resize(t, W, H));
          const short = Math.min(W, H);
          const bs = Math.max(4, Math.round(short * [0.012, 0.022, 0.04][P.blockSize] || short * 0.022));
          e.resize(flow, Math.ceil(W / bs), Math.ceil(H / bs));
          const p = ctx.p;
          if (p <= 0) { // before the cut: outgoing clip untouched
            e.copy(ctx.src, ctx.out || null);
            started = false;
            lastP = p;
            return;
          }
          if (p >= 1) { e.copy(ctx.srcB, ctx.out || null); started = false; lastP = p; return; }
          if (!started || p < lastP) {
            // freeze the last frame of the outgoing clip as the mosh plate
            e.copy(ctx.src, mA);
            e.copy(ctx.srcB, prevB);
            started = true;
            frame = 0;
          }
          lastP = p;
          frame++;
          const choppy = P.frames === 1 && frame % 2 === 1;
          const stutter = P.frames === 2 && Math.floor(frame / 3) % 2 === 1;
          if (!choppy && !stutter) {
            const R = Math.max(4, short * 0.03);
            e.draw(e.program('mosh.match', MATCH), { cur: ctx.srcB, prev: prevB, bs, R, full: [W, H] }, flow);
            e.draw(e.program('mosh.advect', ADVECT), {
              mosh: mA, flow, curB: ctx.srcB, flowRes: [flow.w, flow.h], bs, R,
              intensity: M(P.intensity, 0.5, 4) * (V.drip ? 1.2 : 1),
              blend: P.blend, prog: p, motion: P.motion, frameSeed: frame * 0.37,
            }, mB);
            const s = mA; mA = mB; mB = s;
            e.copy(ctx.srcB, prevB);
          }
          e.draw(e.program('mosh.look', LOOK), {
            mosh: mA, curB: ctx.srcB, curA: ctx.src, variant: V.variant, prog: p,
            colorSpeed: P.colourSpeed, flashes: P.flashes === 0 ? 1 : 0, frameSeed: frame,
          }, look);
          post.run(look, { glow: V.variant === 1 ? 0.6 : V.variant === 2 ? 0.35 : 0.1, thresh: 0.55 }, ctx.out);
        },
      };
    },
  });
})();
