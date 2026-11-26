// TRIP family: breathing warp, melting drips, hue drift, kaleidoscopic
// pattern growing over flat areas and feedback tracers. Strength follows an
// envelope: starts after -> come up -> peak -> come down.
(function () {
  'use strict';
  const GR = window.GR;
  const M = GR.map;

  const FRAG = `uniform sampler2D src, prev;
uniform float env, warp, tracers, patSpeed, patCol, colMode, variant, seed, hasPrev;

float flower(vec2 p){
  vec2 r = vec2(1., 1.7320508);
  vec2 h = r * .5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  float d = length(g);
  float ring = smoothstep(.05, 0., abs(d - .5)) + smoothstep(.04, 0., abs(d - .25)) * .6;
  float ang = atan(g.y, g.x);
  float petals = smoothstep(.06, 0., abs(d - (.32 + .08 * cos(ang * 6.))));
  return clamp(ring + petals, 0., 1.);
}

float kaleido(vec2 p, float t){
  float a = atan(p.y, p.x), r = length(p);
  float k = 8.;
  a = mod(a + t * .1, 2. * PI / k);
  a = abs(a - PI / k);
  vec2 q = vec2(cos(a), sin(a)) * r;
  return smoothstep(.06, 0., abs(sin(q.x * 9. - t) * .5 + sin(q.y * 14. + t * .7) * .3)) ;
}

void main(){
  float e = env;
  float t = time;
  vec2 p = uv;
  vec2 q = p * 2.6 + vec2(t * .12, -t * .09) + seed * 13.;
  vec2 disp = vec2(fbm(q), fbm(q + 5.2)) - .5;
  float wa = warp * e * (variant > 1.5 && variant < 2.5 ? .14 : .055);
  p += disp * wa;
  p = (p - .5) * (1. - .035 * e * sin(t * 1.3)) + .5;
  if (variant < .5 || (variant > .5 && variant < 1.5)) {
    float drip = fbm(vec2(p.x * 9. + seed, t * .25));
    float melt = e * warp * (variant > .5 ? .16 : .07);
    p.y += melt * drip * smoothstep(0., 1., uv.y);
    p.x += sin(p.y * 30. + t * 2.) * melt * .05;
  }
  vec3 c = texture(src, p).rgb;
  vec2 px = 1.5 / res;
  float edge = length(vec2(luma(texture(src, p + vec2(px.x, 0.)).rgb) - luma(texture(src, p - vec2(px.x, 0.)).rgb),
                           luma(texture(src, p + vec2(0., px.y)).rgb) - luma(texture(src, p - vec2(0., px.y)).rgb)));
  float L = luma(c);

  // colour drift
  if (colMode < .5) c = saturateC(hueShift(c, e * .08 * sin(t * .4)), 1. + e * .6);
  else if (colMode < 1.5) c = saturateC(hueShift(c, t * .12 * e + L * e * .8), 1. + e);
  else if (colMode < 2.5) c = mix(c, hsv2rgb(vec3(fract(L * 1.5 + t * .1), 1., 1.)) * (.2 + L * 1.4), e * .75);
  else c = mix(c, 1. - hueShift(c, t * .1), e * .7);

  // pattern
  vec2 g = (uv - .5) * vec2(res.x / res.y, 1.);
  float ps = t * (.05 + patSpeed * .6);
  vec2 gp = g * (5. + 1.5 * sin(ps * .7)) ;
  gp = mat2(cos(ps * .3), -sin(ps * .3), sin(ps * .3), cos(ps * .3)) * gp + disp * 2.;
  float pat = variant > 2.5 ? max(flower(gp), kaleido(g * 1.2, ps * 4.)) : flower(gp);
  float flatArea = 1. - clamp(edge * 6., 0., 1.);
  float pm = e * pat * smoothstep(.12, .45, L) * flatArea * .7;
  vec3 pc = patCol < .5 ? c * 1.7 + .05 : patCol < 1.5 ? hsv2rgb(vec3(fract(gp.x * .05 + gp.y * .05 + t * .1), .9, 1.)) : vec3(1., .8, .3) * (.4 + L);
  c = mix(c, pc, clamp(pm, 0., 1.));

  // tracers (feedback)
  if (hasPrev > .5) {
    vec3 pr = texture(prev, (uv - .5) * .995 + .5).rgb;
    float k = tracers * e * .9;
    c = max(c, pr * k * .97);
    c = mix(c, pr, k * .25);
  }
  o = vec4(c, 1.);
}`;

  function envelope(t, P) {
    const start = M(P.startsAfter, 0, 3);
    const up = M(P.comeUp, 0.2, 4);
    const peak = M(P.peak, 0.5, 6);
    const down = M(P.comeDown, 0.2, 6);
    const tt = t - start;
    let v;
    if (tt < 0) v = 0;
    else if (tt < up) v = GR.util.smooth(0, 1, tt / up);
    else if (tt < up + peak) v = 1;
    else if (tt < up + peak + down) v = 1 - GR.util.smooth(0, 1, (tt - up - peak) / down);
    else v = 0;
    return v * M(P.dose, 0.15, 1.2);
  }

  GR.tripCycle = function (P) {
    return M(P.startsAfter, 0, 3) + M(P.comeUp, 0.2, 4) + M(P.peak, 0.5, 6) + M(P.comeDown, 0.2, 6) + 0.6;
  };

  GR.registerEffect('trip', {
    create(e) {
      const post = new GR.Post(e);
      let a = e.target(4, 4), b = e.target(4, 4);
      let fresh = true;
      return {
        render(ctx) {
          const P = ctx.params, V = ctx.card.look;
          e.resize(a, ctx.w, ctx.h);
          e.resize(b, ctx.w, ctx.h);
          // the preview loops the whole envelope; a render plays it once from the start
          const cyc = GR.tripCycle(P);
          const t = ctx.live ? ctx.t % cyc : ctx.t;
          e.draw(e.program('trip', FRAG), {
            src: ctx.src,
            prev: b,
            hasPrev: fresh ? 0 : 1,
            env: envelope(t, P),
            warp: P.warp,
            tracers: P.tracers,
            patSpeed: P.patternSpeed,
            patCol: P.patternColours,
            colMode: P.colours,
            variant: V.variant,
            seed: P.variation * 7.0,
          }, a);
          fresh = false;
          const s = a; a = b; b = s; // b now holds this frame (feedback for the next)
          post.run(b, { glow: 0.15 + P.dose * 0.25, thresh: 0.6, vignette: 0.25 }, ctx.out);
        },
        reset() { fresh = true; },
      };
    },
  });
})();
