// Shared finishing pass: glow, light streaks, RGB split, scanlines, moving
// scan bar, grain, vignette, flicker and a basic grade. Every look ends here so
// the same controls behave the same way across the whole catalogue.
(function () {
  'use strict';
  const GR = window.GR;

  const EXTRACT = `uniform sampler2D src; uniform float thresh;
void main(){
  vec2 px = 1. / vec2(textureSize(src, 0));
  vec3 c = texture(src, uv + px * vec2(-1., -1.)).rgb + texture(src, uv + px * vec2(1., -1.)).rgb
         + texture(src, uv + px * vec2(-1., 1.)).rgb + texture(src, uv + px * vec2(1., 1.)).rgb;
  c *= .25;
  float l = max(max(c.r, c.g), c.b);
  o = vec4(c * smoothstep(thresh, thresh + .3, l), 1.);
}`;

  const BLUR = `uniform sampler2D src; uniform vec2 dir;
void main(){
  vec2 px = dir / res;
  vec3 s = texture(src, uv).rgb * .227027;
  s += (texture(src, uv + px * 1.3846).rgb + texture(src, uv - px * 1.3846).rgb) * .316216;
  s += (texture(src, uv + px * 3.2307).rgb + texture(src, uv - px * 3.2307).rgb) * .070270;
  o = vec4(s, 1.);
}`;

  const STREAK = `uniform sampler2D src; uniform float stepPx;
void main(){
  vec2 px = vec2(stepPx / res.x, 0.);
  vec3 s = vec3(0.); float w = 0.;
  for (int i = -4; i <= 4; i++) { float k = pow(.82, abs(float(i))); s += texture(src, uv + px * float(i)).rgb * k; w += k; }
  o = vec4(s / w * 1.15, 1.);
}`;

  const COMPOSITE = `uniform sampler2D src, glowT, streakT;
uniform float glow, streaks, rgb, scanlines, scanline, grain, vignette, flicker;
uniform float bright, contrast, satur, hue, useGlow;
uniform vec3 streakTint;
void main(){
  vec2 d = uv - .5;
  vec4 base = texture(src, uv);
  vec3 c = base.rgb;
  if (rgb > 0.) {
    vec2 off = vec2(rgb * .014 * (.4 + length(d) * 1.6), 0.);
    c.r = texture(src, uv + off).r;
    c.b = texture(src, uv - off).b;
  }
  if (useGlow > .5) {
    c += texture(glowT, uv).rgb * glow * 2.2;
    c += texture(streakT, uv).rgb * streaks * 1.4 * streakTint;
  }
  if (hue != 0.) c = hueShift(c, hue);
  c = (c - .5) * contrast + .5;
  c *= bright;
  c = saturateC(c, satur);
  float sl = .5 + .5 * sin(uv.y * res.y * PI * .5);
  c *= 1. - scanlines * .45 * (1. - sl);
  float sy = 1. - fract(time * .22);
  float band = exp(-pow((uv.y - sy) * res.y / (res.y * .02), 2.));
  c += scanline * band * .28;
  c *= 1. + scanline * .25 * sin(uv.y * 900. + time * 30.) * band;
  float g = hash21(floor(uv * res) + fract(time * 7.13) * 97.) - .5;
  c += g * grain * .3;
  float v = smoothstep(.25, .95, length(d * vec2(1., .9)) * 1.25);
  c *= 1. - vignette * v;
  c *= 1. - flicker * .18 * hash11(floor(time * 18.));
  o = vec4(max(c, 0.), base.a);
}`;

  class Post {
    constructor(engine) {
      this.e = engine;
      this.ex = engine.target(4, 4);
      this.ga = engine.target(4, 4);
      this.gb = engine.target(4, 4);
      this.sa = engine.target(4, 4);
      this.sb = engine.target(4, 4);
    }

    // o: {glow, streaks, thresh, rgb, scanlines, scanline, grain, vignette, flicker,
    //     bright, contrast, satur, hue, streakTint}
    run(src, o, out) {
      const e = this.e;
      const W = src.w, H = src.h;
      const wantGlow = (o.glow || 0) > 0.001 || (o.streaks || 0) > 0.001;
      if (wantGlow) {
        const qw = Math.ceil(W / 4), qh = Math.ceil(H / 4);
        [this.ex, this.ga, this.gb].forEach((t) => e.resize(t, qw, qh));
        e.resize(this.sa, qw, Math.ceil(H / 8));
        e.resize(this.sb, qw, Math.ceil(H / 8));
        const pE = e.program('post.extract', EXTRACT);
        const pB = e.program('post.blur', BLUR);
        const pS = e.program('post.streak', STREAK);
        e.draw(pE, { src, thresh: o.thresh == null ? 0.55 : o.thresh }, this.ex);
        e.draw(pB, { src: this.ex, dir: [1, 0] }, this.ga);
        e.draw(pB, { src: this.ga, dir: [0, 1] }, this.gb);
        e.draw(pB, { src: this.gb, dir: [2, 0] }, this.ga);
        e.draw(pB, { src: this.ga, dir: [0, 2] }, this.gb);
        if ((o.streaks || 0) > 0.001) {
          e.draw(pS, { src: this.ex, stepPx: 1 }, this.sa);
          e.draw(pS, { src: this.sa, stepPx: 4 }, this.sb);
          e.draw(pS, { src: this.sb, stepPx: 14 }, this.sa);
          e.draw(pS, { src: this.sa, stepPx: 40 }, this.sb);
        }
      }
      const pC = e.program('post.composite', COMPOSITE);
      e.draw(pC, {
        src,
        glowT: this.gb,
        streakT: this.sb,
        useGlow: wantGlow ? 1 : 0,
        glow: o.glow || 0,
        streaks: o.streaks || 0,
        rgb: o.rgb || 0,
        scanlines: o.scanlines || 0,
        scanline: o.scanline || 0,
        grain: o.grain || 0,
        vignette: o.vignette || 0,
        flicker: o.flicker || 0,
        bright: o.bright == null ? 1 : o.bright,
        contrast: o.contrast == null ? 1 : o.contrast,
        satur: o.satur == null ? 1 : o.satur,
        hue: o.hue || 0,
        streakTint: o.streakTint || [0.75, 0.9, 1.0],
      }, out);
    }
  }

  GR.Post = Post;
})();
