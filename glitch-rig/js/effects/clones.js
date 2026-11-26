// CLONE TRAIL / CHROMA ECHO: earlier frames are kept in a small ring buffer
// and layered back over the current frame (only where things moved, or where
// they are bright), tinted and drifting.
(function () {
  'use strict';
  const GR = window.GR;
  const M = GR.map;

  const FRAG = `uniform sampler2D cur, h1, h2, h3, h4, h5, h6;
uniform float n, fade, blendMode, tintMode, matte, offset, variant;

vec3 tintFor(float i){
  if (tintMode < .5) return vec3(1.);
  if (tintMode < 1.5) return hsv2rgb(vec3(fract(i * .17 + time * .15), .85, 1.));
  if (tintMode < 2.5) return mod(i, 2.) < .5 ? vec3(.25, 1., 1.) : vec3(1., .25, 1.);
  if (tintMode < 3.5) return mix(vec3(1., .85, .3), vec3(1., .25, .1), i / 6.);
  return vec3(.35, .55, 1.) * (1.2 - i * .1);
}

vec3 comp(vec3 acc, vec3 c, sampler2D h, float i){
  if (i > n) return acc;
  vec2 q = uv - vec2(offset * .025 * i, offset * .006 * i * sin(time + i));
  vec3 k = texture(h, q).rgb;
  float m = matte < .5 ? smoothstep(.06, .28, distance(k, c)) : matte < 1.5 ? smoothstep(.3, .75, luma(k)) : 1.;
  float w = pow(1. - i / (n + 1.), .5 + fade * 2.5) * m;
  vec3 v = k * tintFor(i) * w;
  if (blendMode < .5) return max(acc, v);
  if (blendMode < 1.5) return 1. - (1. - acc) * (1. - v);
  if (blendMode < 2.5) return acc + v * .55;
  return abs(acc - v);
}

void main(){
  vec3 c = texture(cur, uv).rgb;
  if (variant > .5) {
    // chroma echo: each channel from a different moment
    float g = texture(h2, uv + vec2(offset * .01, 0.)).g;
    float b = texture(h4, uv + vec2(offset * .02, 0.)).b;
    vec3 e = vec3(c.r, g, b);
    o = vec4(mix(c, e, .5 + fade * .5), 1.);
    return;
  }
  vec3 acc = c;
  acc = comp(acc, c, h6, 6.);
  acc = comp(acc, c, h5, 5.);
  acc = comp(acc, c, h4, 4.);
  acc = comp(acc, c, h3, 3.);
  acc = comp(acc, c, h2, 2.);
  acc = comp(acc, c, h1, 1.);
  o = vec4(acc, 1.);
}`;

  GR.registerEffect('clones', {
    create(e) {
      const post = new GR.Post(e);
      const tmp = e.target(4, 4);
      const ring = Array.from({ length: 7 }, () => e.target(4, 4));
      let head = 0, frames = 0, filled = 0;
      const reset = () => { head = 0; frames = 0; filled = 0; };
      return {
        render(ctx) {
          const P = ctx.params, V = ctx.card.look;
          e.resize(tmp, ctx.w, ctx.h);
          ring.forEach((r) => e.resize(r, ctx.w, ctx.h));
          const delay = Math.max(1, Math.round(M(P.delay, 1, 10)));
          if (frames % delay === 0 || filled === 0) {
            e.copy(ctx.src, ring[head]);
            head = (head + 1) % ring.length;
            filled = Math.min(ring.length, filled + 1);
          }
          frames++;
          // h1 = most recent snapshot before the newest, h6 = oldest
          const at = (k) => ring[((head - 1 - Math.min(k, filled - 1)) % ring.length + ring.length) % ring.length];
          e.draw(e.program('clones', FRAG), {
            cur: ctx.src,
            h1: at(1), h2: at(2), h3: at(3), h4: at(4), h5: at(5), h6: at(6),
            n: Math.min(Math.round(M(P.clones, 1, 6)), Math.max(0, filled - 1)),
            fade: P.fade,
            blendMode: P.blend,
            tintMode: P.tint,
            matte: P.matte,
            offset: M(P.drift, -1, 1),
            variant: V.variant || 0,
          }, tmp);
          post.run(tmp, { glow: P.glow, thresh: 0.55, rgb: P.rgb }, ctx.out);
        },
        reset,
      };
    },
  });
})();
