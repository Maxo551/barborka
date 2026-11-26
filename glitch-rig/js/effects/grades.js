// COLOUR LOOKS: one shader, many modes (night vision, thermal, infrared,
// xerox, blacklight, CRT, bitcrush, VHS, corrupted, duotones, solarize,
// modulation). Each look keeps the same control set.
(function () {
  'use strict';
  const GR = window.GR;
  const M = GR.map;

  const FRAG = `uniform sampler2D src;
uniform float mode, amount, glitch, noiseAmt, contrastK, brightK, hueK, seed;
uniform vec3 c0, c1, c2;

const mat4 bayer = mat4(0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
float dither(vec2 p){ ivec2 i = ivec2(mod(p, 4.)); return bayer[i.x][i.y] / 16. - .5; }

vec2 glitchUV(vec2 p){
  if (glitch <= 0.) return p;
  float tt = floor(time * 12.);
  float band = floor(p.y * (8. + hash11(tt) * 30.));
  float r = hash21(vec2(band, tt));
  float on = step(1. - glitch * .35, r);
  p.x += (hash21(vec2(band, tt + 1.)) - .5) * .18 * on * glitch;
  vec2 blk = floor(p * vec2(12., 8.));
  float rb = hash21(blk + tt * 3.1);
  if (rb > 1. - glitch * .12) p += (hash22(blk + tt) - .5) * .08;
  return p;
}

vec3 tex(vec2 p){ return texture(src, p).rgb; }

void main(){
  vec2 p = glitchUV(uv);
  vec3 orig = tex(uv);
  vec3 c = tex(p);
  float L = luma(c);
  vec3 r = c;
  float n = hash21(floor(uv * res) + fract(time * 13.7) * 91.) - .5;

  if (mode < .5) {              // NIGHT VISION
    float l = pow(clamp(L * 1.9 + n * .25 * noiseAmt, 0., 1.), .75);
    r = ramp3(l, vec3(0., .03, .01), vec3(.16, .82, .22), vec3(.82, 1., .78));
    r *= .9 + .1 * sin(uv.y * res.y * 1.6);
  } else if (mode < 1.5) {      // THERMAL
    vec2 px = 2. / res;
    float b = (L + luma(tex(p + px)) + luma(tex(p - px)) + luma(tex(p + vec2(px.x, -px.y))) + luma(tex(p - vec2(px.x, -px.y)))) / 5.;
    r = heat(floor(pow(b, .9) * 18.) / 18.);
  } else if (mode < 2.5) {      // INFRARED
    vec3 f = vec3(c.g * 1.3 + c.r * .25, c.r * .4 + c.b * .2, c.b * .85 + c.g * .35);
    r = saturateC(f, 1.5) * 1.1;
  } else if (mode < 3.5) {      // XEROX
    float th = .45 + (fbm(uv * 3. + time * .2) - .5) * .25;
    float ink = step(L + n * .35 * (.3 + noiseAmt), th);
    float streak = smoothstep(.97, 1., hash11(floor(uv.x * 220.) + floor(time * 6.))) * .5;
    r = mix(vec3(.94, .92, .86), vec3(.06, .05, .07), clamp(ink + streak * step(.5, hash21(uv * res)), 0., 1.));
    r -= step(.995, hash21(floor(uv * res / 2.) + floor(time * 8.))) * .8;
  } else if (mode < 4.5) {      // BLACKLIGHT
    r = mix(vec3(.03, 0., .09), vec3(.42, .05, .95), smoothstep(.0, .6, L));
    r += pow(L, 2.5) * vec3(.3, 1.2, .9) + pow(max(c.b - c.r, 0.), 1.) * vec3(.2, .4, 1.);
  } else if (mode < 5.5) {      // CRT TV
    vec2 q = uv * 2. - 1.;
    q *= 1. + dot(q, q) * .08;
    vec2 pq = glitchUV(q * .5 + .5);
    if (pq.x < 0. || pq.y < 0. || pq.x > 1. || pq.y > 1.) { o = vec4(0., 0., 0., 1.); return; }
    vec3 cc = vec3(tex(pq + vec2(.0015, 0.)).r, tex(pq).g, tex(pq - vec2(.0015, 0.)).b);
    float mask = mod(floor(uv.x * res.x), 3.);
    vec3 m = mask < 1. ? vec3(1., .55, .55) : mask < 2. ? vec3(.55, 1., .55) : vec3(.55, .55, 1.);
    r = cc * m * 1.45 * (.75 + .25 * sin(pq.y * res.y * PI));
    r *= 1. - smoothstep(.75, 1.05, length(q * vec2(.9, 1.)));
  } else if (mode < 6.5) {      // BITCRUSH
    float px = 6. + amount * 6.;
    vec2 g = (floor(uv * res / px) + .5) * px / res;
    vec3 cc = tex(glitchUV(g));
    cc += dither(floor(uv * res / px)) * .25;
    r = floor(cc * 4. + .5) / 4.;
  } else if (mode < 7.5) {      // VHS
    float line = floor(uv.y * res.y / 2.);
    float jit = (hash11(line + floor(time * 24.) * 7.) - .5) * .004 * (1. + glitch * 4.);
    float track = smoothstep(.06, 0., abs(uv.y - fract(time * .11 + .05))) ;
    vec2 q = p + vec2(jit + track * .03 * sin(uv.y * 400.), 0.);
    float y = luma(tex(q));
    vec3 ch = vec3(0.);
    for (int i = 0; i < 6; i++) ch += tex(q - vec2(float(i) * .004, 0.));
    ch /= 6.;
    vec3 cyuv = ch - luma(ch);
    r = vec3(y) + cyuv * 1.3;
    r = mix(r, r * vec3(1.08, .9, 1.1), .6);
    r += track * (n + .5) * .5;
    r += smoothstep(.03, 0., uv.y) * (hash21(vec2(uv.x * 200., time)) - .2);
  } else if (mode < 8.5) {      // CORRUPTED
    float tt = floor(time * 8.);
    vec2 blk = floor(uv * vec2(16., 9.) * (1. + hash11(tt) * 2.));
    float hb = hash21(blk + tt);
    vec2 q = p;
    if (hb > .8) q += (hash22(blk * 1.3 + tt) - .5) * .25;
    vec3 cc = tex(q);
    if (hb > .9) cc = cc.brg;
    if (hb > .95) cc = floor(cc * 3.) / 3.;
    if (hb < .05) cc = 1. - cc;
    r = cc;
  } else if (mode < 9.5) {      // DUOTONE / TRITONE (toxic, cyanide, sunburn...)
    float l = smoothstep(.02, .95, L);
    r = ramp3(l, c0, c1, c2);
  } else if (mode < 10.5) {     // SOLARIZE / CHROME
    float l = .5 - .5 * cos(clamp(L * 1.25, 0., 1.) * PI * 3.);
    r = ramp3(l, c0, c1, c2) * (.35 + .65 * smoothstep(.0, .25, L));
  } else {                      // MODULATION
    float w = sin(uv.y * 60. + time * 6.) * .012 + sin(uv.y * 7. - time * 2.) * .02;
    float il = mod(floor(uv.y * res.y / 2.), 2.);
    vec3 cc;
    cc.r = tex(p + vec2(w * 1.4, 0.)).r;
    cc.g = tex(p + vec2(w * (il > .5 ? -1. : 1.), 0.)).g;
    cc.b = tex(p - vec2(w * 1.4, 0.)).b;
    r = cc * (.85 + .15 * il) * 1.1;
  }

  r = hueShift(clamp(r, 0., 4.), hueK);
  r = (r - .5) * contrastK + .5;
  r *= brightK;
  r += n * noiseAmt * .18 * step(.5, mode) ;
  o = vec4(mix(orig, max(r, 0.), amount), 1.);
}`;

  GR.registerEffect('grade', {
    create(e) {
      const post = new GR.Post(e);
      const tmp = e.target(4, 4);
      const hud = new GR.Overlay(e);
      const tmp2 = e.target(4, 4);
      return {
        render(ctx) {
          const P = ctx.params, V = ctx.card.look;
          e.resize(tmp, ctx.w, ctx.h);
          const c = (k, d) => GR.util.hexToRgb(V[k] || d);
          e.draw(e.program('grade', FRAG), {
            src: ctx.src,
            mode: V.mode,
            amount: P.amount,
            glitch: P.glitch * (V.glitchBoost || 1),
            noiseAmt: P.noise,
            contrastK: M(P.contrast, 0.5, 1.8),
            brightK: M(P.brightness, 0.4, 1.8),
            hueK: P.colour - 0.5,
            c0: c('c0', '#000000'),
            c1: c('c1', '#808080'),
            c2: c('c2', '#ffffff'),
          }, tmp);
          let srcPost = tmp;
          if (V.hud && P.hud === 0) {
            e.resize(tmp2, ctx.w, ctx.h);
            const x = hud.begin(ctx.w, ctx.h);
            GR.drawHud(x, [0, 0, ctx.w, ctx.h], ctx.t, { color: V.hudColor || '#c8ffc8', label: V.hudLabel || 'NV', cross: true });
            GR.drawOver(e, tmp, hud.commit(), tmp2, { amount: 0.85 });
            srcPost = tmp2;
          }
          post.run(srcPost, {
            glow: P.glow,
            thresh: 0.5,
            rgb: P.rgb,
            scanlines: P.scanlines,
            grain: V.mode === 0 ? P.noise * 0.6 : 0,
            vignette: P.vignette,
            flicker: V.flicker || 0,
          }, ctx.out);
        },
        reset() {},
      };
    },
  });
})();
