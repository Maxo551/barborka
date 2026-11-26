// Shader transitions: the cut sits at the middle of the transition; A plays
// out, B plays in. One shader, one mode per card.
(function () {
  'use strict';
  const GR = window.GR;
  const M = GR.map;

  const FRAG = `uniform sampler2D A, B;
uniform float p, mode, intensity, flash, blur;
uniform vec2 dir;
uniform vec3 tint;

vec3 ta(vec2 q){ return texture(A, q).rgb; }
vec3 tb(vec2 q){ return texture(B, q).rgb; }
vec3 pick(vec2 q, float s){ return s < .5 ? ta(q) : tb(q); }
float ease(float x){ return x * x * (3. - 2. * x); }

void main(){
  float env = sin(clamp(p, 0., 1.) * PI);
  float k = intensity;
  float side = step(.5, p);
  vec3 c;
  vec2 q = uv;

  if (mode < .5) {                                    // FLASHBANG
    c = pick(q, side);
    float f = exp(-abs(p - .5) * (6. + 10. * (1. - k)));
    c = c * (1. + f * 4. * k) + f * k * 1.2;
  } else if (mode < 1.5) {                            // STATIC
    float j = (hash11(floor(uv.y * 90.) + floor(time * 40.)) - .5) * .08 * env * k;
    q.x += j;
    c = pick(q, side);
    float n = hash21(floor(uv * res / 2.) + floor(time * 60.) * 3.1);
    float bars = .5 + .5 * sin(uv.y * 40. + time * 30.);
    c = mix(c, vec3(n) * (.6 + .4 * bars), clamp(pow(env, .6) * k * 1.1, 0., 1.));
  } else if (mode < 2.5) {                            // STROBE
    float st = floor(p * (8. + k * 14.));
    float m = mod(st, 4.);
    c = m < 1. ? ta(q) : m < 2. ? vec3(1.) : m < 3. ? tb(q) : vec3(0.);
    if (p > .85) c = tb(q);
    if (p < .08) c = ta(q);
  } else if (mode < 3.5) {                            // MOSAIC
    float px = 1. + env * env * k * 90.;
    vec2 g = (floor(uv * res / px) + .5) * px / res;
    c = mix(ta(g), tb(g), smoothstep(.4, .6, p));
  } else if (mode < 4.5) {                            // SHOCKWAVE
    vec2 d = (uv - .5) * vec2(res.x / res.y, 1.);
    float r = length(d);
    float rad = ease(p) * 1.4;
    float w = .12;
    float ring = smoothstep(w, 0., abs(r - rad));
    vec2 off = normalize(d + 1e-5) * ring * .06 * k;
    vec3 ca = vec3(ta(q - off * 1.2).r, ta(q - off).g, ta(q - off * .8).b);
    vec3 cb = vec3(tb(q - off * 1.2).r, tb(q - off).g, tb(q - off * .8).b);
    c = r < rad ? cb : ca;
    c += ring * env * .6 * tint;
  } else if (mode < 5.5) {                            // CHROMA SPLIT
    vec2 off = dir * env * .12 * k;
    float pr = smoothstep(.0, .7, p), pg = smoothstep(.15, .85, p), pb = smoothstep(.3, 1., p);
    c.r = mix(ta(q + off).r, tb(q + off).r, pr);
    c.g = mix(ta(q).g, tb(q).g, pg);
    c.b = mix(ta(q - off).b, tb(q - off).b, pb);
  } else if (mode < 6.5) {                            // WHIP PAN
    float e = ease(p);
    vec3 s = vec3(0.);
    float spd = env * k * .18;
    for (int i = 0; i < 16; i++) {
      float f = (float(i) / 15. - .5) * spd;
      vec2 qq = uv + dir * (e + f);
      vec2 qa = qq, qb = qq - dir;
      bool inA = qa.x >= 0. && qa.x <= 1. && qa.y >= 0. && qa.y <= 1.;
      s += inA ? ta(fract(qa)) : tb(fract(qb));
    }
    c = s / 16.;
  } else if (mode < 7.5) {                            // ZOOM PUNCH
    float z = p < .5 ? 1. + ease(p * 2.) * 2.5 * k : 1. + (1. - ease((p - .5) * 2.)) * 2.5 * k;
    vec2 ctr = vec2(.5);
    vec3 s = vec3(0.);
    float bl = env * .25 * k;
    for (int i = 0; i < 14; i++) {
      float f = 1. - bl * float(i) / 13.;
      vec2 qq = ctr + (uv - ctr) / (z * f);
      s += pick(qq, side);
    }
    c = s / 14.;
  } else if (mode < 8.5) {                            // DATA TEAR
    float rows = 18. + 40. * k;
    float row = floor(uv.y * rows);
    float th = hash11(row * 1.7);
    float sw = step(th, p * 1.2 - .1);
    float sh = (hash11(row + floor(time * 20.)) - .5) * env * .35 * k;
    vec2 qq = vec2(uv.x + sh, uv.y);
    c = sw > .5 ? tb(qq) : ta(qq);
    c.r = (sw > .5 ? tb(qq + vec2(.01 * env, 0.)) : ta(qq + vec2(.01 * env, 0.))).r;
    c += step(.96, hash21(vec2(row, floor(time * 25.)))) * env * tint;
  } else if (mode < 9.5) {                            // RIPPLE
    vec2 d = uv - .5;
    float r = length(d);
    vec2 off = normalize(d + 1e-5) * sin(r * 60. - time * 12.) * .02 * env * k;
    c = mix(ta(q + off), tb(q + off), smoothstep(.35, .65, p));
  } else if (mode < 10.5) {                           // WARP SPEED
    vec2 d = uv - .5;
    vec3 s = vec3(0.);
    float st = env * .5 * k;
    for (int i = 0; i < 18; i++) {
      float f = 1. - st * float(i) / 17.;
      s += pick(.5 + d * f, side);
    }
    c = s / 18.;
    c += exp(-length(d) * 6.) * env * env * 2. * tint;
  } else if (mode < 11.5) {                           // GHOST PHASE
    vec3 s = vec3(0.);
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      vec2 off = vec2(sin(time * 3. + fi * 1.7), cos(time * 2.3 + fi)) * .03 * env * k * fi;
      float sp = clamp(p * 1.4 - fi * .1, 0., 1.);
      s += mix(ta(q + off), tb(q + off), smoothstep(.3, .7, sp)) * (fi == 0. ? 1. : .5);
    }
    c = s / 3.;
    c = mix(c, c * vec3(.7, 1., 1.15), env);
  } else if (mode < 12.5) {                           // BURNOUT
    float n = fbm(uv * 4. + time * .2);
    float th = p * 1.3 - .15;
    float l = luma(ta(q)) * .5 + n * .5;
    float burn = smoothstep(th, th - .08, l);
    float edge = smoothstep(.09, 0., abs(l - th));
    c = mix(ta(q), tb(q), burn);
    c += edge * (vec3(1., .55, .1) * 2. + tint * .5) * k;
  } else {                                            // GLITCH BLOCKS
    float tt = floor(time * 15.);
    vec2 bsz = vec2(8., 6.) * (1. + floor(hash11(tt) * 3.));
    vec2 bi = floor(uv * bsz);
    float h = hash21(bi);
    float sw = step(h, p);
    vec2 off = (hash22(bi + tt) - .5) * .12 * env * k * step(.7, hash21(bi + tt * 1.3));
    c = sw > .5 ? tb(q + off) : ta(q + off);
    if (hash21(bi + tt * 2.) > 1. - env * .25) c = c.gbr;
  }
  if (flash > .5) c += exp(-abs(p - .5) * 30.) * .9;
  o = vec4(c, 1.);
}`;

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const TINTS = ['#ffffff', '#ff3045', '#ff9a1f', '#ffe14a', '#3dff7a', '#3de0ff', '#ff4ff0'];

  GR.registerEffect('transition', {
    create(e) {
      const post = new GR.Post(e);
      const tmp = e.target(4, 4);
      return {
        reset() {},
        render(ctx) {
          const P = ctx.params, V = ctx.card.look;
          e.resize(tmp, ctx.w, ctx.h);
          if (ctx.p <= 0) return e.copy(ctx.src, ctx.out || null);
          if (ctx.p >= 1) return e.copy(ctx.srcB, ctx.out || null);
          e.draw(e.program('transition', FRAG), {
            A: ctx.src,
            B: ctx.srcB,
            p: ctx.p,
            mode: V.mode,
            intensity: M(P.intensity, 0.2, 1.4),
            flash: P.flash === 0 ? 1 : 0,
            dir: DIRS[P.direction] || [1, 0],
            tint: GR.util.hexToRgb(TINTS[P.colour] || '#ffffff'),
            blur: P.blur,
          }, tmp);
          const env = Math.sin(Math.max(0, Math.min(1, ctx.p)) * Math.PI);
          post.run(tmp, { glow: P.glow * env, thresh: 0.6, rgb: P.rgb * env, grain: P.grain * env }, ctx.out);
        },
      };
    },
  });

  GR.TRANSITION_TINTS = TINTS;
})();
