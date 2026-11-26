// TITLES: your words set in a display font, then styled on the GPU (fuzz,
// chrome drip, neon tube, interlace, thorns, smoke, frost, gothic, candy,
// tape). Renders with a transparent background so it lands on its own track.
(function () {
  'use strict';
  const GR = window.GR;
  const M = GR.map;

  const FONTS = [
    '"Rubik Mono One", "Arial Black", sans-serif',
    '"Metal Mania", "Impact", fantasy',
    '"Monoton", "Arial Black", sans-serif',
    '"Orbitron", "Arial Black", sans-serif',
    '"Pirata One", "Palatino Linotype", serif',
    '"Abril Fatface", "Georgia", serif',
    '"Bungee", "Arial Black", sans-serif',
    '"UnifrakturMaguntia", "Old English Text MT", serif',
    '"Rubik Bubbles", "Arial Rounded MT Bold", sans-serif',
    '"VT323", "Consolas", monospace',
  ];
  const WEIGHTS = ['400', '400', '400', '900', '400', '400', '400', '400', '400', '400'];
  const COLOURS = ['#ff3045', '#ff9a1f', '#ffe14a', '#a6ff3d', '#2bd9ff', '#3d6bff', '#ff4ff0', '#ffffff'];

  const FRAG = `uniform sampler2D T, src;
uniform float style, amount, blurK, hueK, satK, brightK, contrastK, tintK, transparent, anim, seed;
uniform vec3 colour;

float mk(vec2 q){ return texture(T, q).a; }
vec2 asp(){ return vec2(res.y / res.x, 1.); }
float glowM(vec2 q, float r){
  float s = 0.;
  for (int i = 0; i < 20; i++) { float a = float(i) * 2.39996; float rr = r * sqrt((float(i) + .5) / 20.); s += mk(q + vec2(cos(a), sin(a)) * rr * asp()); }
  return s / 20.;
}
float dil(vec2 q, float r){ float m = mk(q); for (int i = 0; i < 12; i++) { float a = float(i) * .5236; m = max(m, mk(q + vec2(cos(a), sin(a)) * r * asp())); } return m; }
float ero(vec2 q, float r){ float m = mk(q); for (int i = 0; i < 12; i++) { float a = float(i) * .5236; m = min(m, mk(q + vec2(cos(a), sin(a)) * r * asp())); } return m; }

void main(){
  float t = time;
  float am = amount * (1. + anim * 3.);
  vec2 q = uv;
  vec3 col = vec3(0.); float a = 0.;
  if (anim > 0.) {
    float row = floor(uv.y * 30.);
    q.x += (hash11(row + floor(t * 30.)) - .5) * anim * .3;
  }

  if (style < .5) {                                   // FUZZ
    float tt = floor(t * 18.);
    vec2 j = (hash22(floor(uv * res / 2.) + tt) - .5) * .012 * am;
    float row = floor(uv.y * 60.);
    q.x += (hash11(row + tt) - .5) * .02 * am * step(.7, hash11(row * 3. + tt));
    float smear = 0.;
    for (int i = 0; i < 6; i++) smear = max(smear, mk(q + j + vec2(0., float(i) * .006 * am * hash21(vec2(floor(uv.x * 160.), 1.)))));
    float off = .006 * am;
    float r = max(mk(q + j + vec2(off, 0.)), smear * .6);
    float g = max(mk(q + j), smear * .6);
    float b = max(mk(q + j - vec2(off, 0.)), smear * .6);
    float speck = step(.35, hash21(floor(uv * res) + tt));
    vec3 base = mix(vec3(.75, .8, .85), colour, .45);
    col = vec3(r * 1.1, g * .9, b * 1.15) * base * (.55 + .45 * speck);
    a = max(r, max(g, b)) * (.6 + .4 * speck);
  } else if (style < 1.5) {                           // CHROME DRIP
    float colN = noise(vec2(uv.x * 55., 3.));
    float len = pow(colN, 3.) * .18 * am;
    float drip = 0.;
    for (int i = 0; i < 10; i++) drip = max(drip, mk(q + vec2(0., float(i) / 9. * len)) * (1. - float(i) / 12.));
    float m = max(mk(q), drip * smoothstep(.02, .0, abs(fract(uv.x * 55.) - .5) - .25));
    float bands = sin((uv.y + fbm(uv * 8.) * .05) * 40.) * .5 + .5;
    vec3 chrome = mix(vec3(.12, .13, .16), vec3(.95, .97, 1.), bands);
    chrome = mix(chrome, chrome * colour * 1.4, .25);
    float out1 = dil(q, .006) - mk(q);
    chrome += pow(bands, 12.) * .8;
    col = chrome * m + vec3(.02) * out1;
    a = max(m, out1);
  } else if (style < 2.5) {                           // NEON SIGN
    float m = mk(q);
    float rim = m - ero(q, .006);
    float band = floor(uv.x * 7.);
    float flick = step(.08, hash11(band + floor(t * 12.))) * .7 + .3;
    float halo = glowM(q, .05);
    col = colour * (rim * 2. + m * .25) * flick + colour * halo * 1.4 * flick + vec3(1.) * rim * .6 * flick;
    a = clamp(rim + m * .3 + halo * 1.2, 0., 1.);
  } else if (style < 3.5) {                           // INTERLACE
    float ln = floor(uv.y * res.y / 3.);
    float odd = mod(ln, 2.);
    q.x += (odd - .5) * .02 * am * sin(t * 3. + ln * .2);
    float m = mk(q) * step(.34, fract(uv.y * res.y / 3.));
    vec3 g = mix(colour, vec3(1.), smoothstep(.3, .7, uv.y));
    col = g * m;
    a = m;
  } else if (style < 4.5) {                           // THORNS
    vec2 n2 = vec2(noise(uv * 90. + 3.), noise(uv * 90. + 9.)) - .5;
    q += n2 * .02 * am * smoothstep(.0, .6, glowM(uv, .01));
    float m = mk(q);
    float halo = glowM(q, .06);
    col = mix(vec3(.04, 0., .03), colour * .3, m) * m + colour * halo * 1.6;
    col += colour * (m - ero(q, .004)) * 1.8;
    a = clamp(m + halo * 1.3, 0., 1.);
  } else if (style < 5.5) {                           // SMOKE
    vec2 w = vec2(fbm(uv * 6. + vec2(0., -t * .4)), fbm(uv * 6. + 4. + vec2(0., -t * .4))) - .5;
    float m = mk(q + w * .025 * am);
    float rise = glowM(q + vec2(0., -.03 - .04 * am) + w * .06, .04);
    float diss = smoothstep(.25, .6, fbm(uv * 5. + vec2(0., -t * .6)) + .2);
    col = mix(vec3(.9), colour, .3) * (m * diss + rise * .55 * fbm(uv * 9. - t * .3));
    a = clamp(m * diss + rise * .6, 0., 1.);
  } else if (style < 6.5) {                           // FROSTBITE
    float m = mk(q);
    vec3 g = ramp3(uv.y, vec3(.05, .2, .6), vec3(.35, .85, 1.), vec3(1.));
    vec2 cell = floor(uv * 70.);
    float cry = hash21(cell);
    vec2 f = fract(uv * 70.) - .5;
    float facet = smoothstep(.5, .1, abs(f.x + f.y * (cry - .5) * 2.));
    float sp = pow(max(sin(t * 4. + cry * 30.), 0.), 20.) * step(.85, cry);
    col = (g * (.75 + .35 * facet) + sp) * m + vec3(.9, 1., 1.) * (dil(q, .004) - m);
    col = mix(col, col * colour * 1.3, .15);
    a = max(m, dil(q, .004));
  } else if (style < 7.5) {                           // GOTHIC
    float m = mk(q);
    float halo = glowM(q, .045);
    vec3 fill = mix(vec3(.02), vec3(.35, .02, .04), uv.y) + hash21(floor(uv * res) + floor(t * 12.)) * .06;
    col = fill * m + colour * .8 * halo * (1. - m) + vec3(.6, .1, .1) * (m - ero(q, .003));
    a = clamp(m + halo, 0., 1.);
  } else if (style < 8.5) {                           // SUGAR RUSH
    float bounce = 1. + .04 * sin(t * 6.) * am;
    q = .5 + (q - .5) / bounce;
    float m = mk(q);
    float outl = dil(q, .012);
    float sh = dil(q + vec2(-.008, .012), .012);
    float stripe = step(.5, fract((uv.x + uv.y) * 14. - t * .8));
    vec3 candy = mix(vec3(1., .45, .75), vec3(1., .92, .4), stripe);
    candy = mix(candy, colour, .25);
    col = candy * m + vec3(1.) * (outl - m) + vec3(.25, 0., .2) * (sh - outl) * step(outl, .5);
    a = max(max(m, outl), sh * .8);
  } else {                                            // BLUE FUZZ (tape)
    float row = floor(uv.y * res.y / 2.);
    q.x += (hash11(row + floor(t * 24.)) - .5) * .006 * am;
    float m = glowM(q, .004 + .006 * am);
    float halo = glowM(q, .04);
    vec3 c2 = mix(colour, vec3(.3, .45, 1.), .6);
    col = c2 * m * 1.3 + c2 * halo * .9;
    col *= .85 + .15 * sin(uv.y * res.y * 1.5);
    a = clamp(m + halo * .8, 0., 1.);
  }

  // blur adds a soft bloom of the same colour
  if (blurK > 0.) { float g = glowM(q, .03 * blurK); col += colour * g * blurK * .8; a = clamp(a + g * blurK * .7, 0., 1.); }
  col = mix(col, col * colour * 1.5, tintK);
  col = hueShift(clamp(col, 0., 4.), hueK);
  col = saturateC(col, satK);
  col = (col - .5) * contrastK + .5;
  col = max(col * brightK, 0.);
  if (transparent > .5) { o = vec4(col / max(a, 1e-3), a); return; }
  vec3 bg = texture(src, uv).rgb * .45;
  o = vec4(bg * (1. - a) + col, 1.);
}`;

  GR.TITLE_COLOURS = COLOURS;
  GR.TITLE_FONTS = FONTS;

  GR.registerEffect('title', {
    create(e) {
      const post = new GR.Post(e);
      const tmp = e.target(4, 4);
      const text = new GR.Overlay(e);
      let key = '';
      return {
        reset() { key = ''; },
        render(ctx) {
          const P = ctx.params, V = ctx.card.look;
          const W = ctx.w, H = ctx.h;
          e.resize(tmp, W, H);
          const words = (P.text || 'GLITCH RIG').slice(0, 80);
          const k = [words, V.style, P.size, W, H, GR.fontEpoch || 0].join('|');
          if (k !== key) {
            key = k;
            const x = text.begin(W, H);
            const lines = words.split(/\n|\\n/);
            let size = H * M(P.size, 0.08, 0.34);
            const font = (s) => WEIGHTS[V.style] + ' ' + Math.round(s) + 'px ' + FONTS[V.style];
            x.font = font(size);
            const widest = Math.max(...lines.map((l) => x.measureText(l).width));
            if (widest > W * 0.88) size *= (W * 0.88) / widest;
            x.font = font(size);
            x.fillStyle = '#fff';
            x.textAlign = 'center';
            x.textBaseline = 'middle';
            const lh = size * 1.05;
            lines.forEach((l, i) => x.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh));
            text.commit();
          }
          // glitch in / out
          let anim = 0;
          const dur = ctx.duration || 3;
          const tt = ctx.live ? ctx.t % 3.2 : ctx.t;
          if (tt < 0.35) anim = 1 - tt / 0.35;
          else if (!ctx.live && tt > dur - 0.3) anim = (tt - (dur - 0.3)) / 0.3;
          e.draw(e.program('title', FRAG), {
            T: text.tex,
            src: ctx.src,
            style: V.style,
            amount: M(P.amount, 0.1, 1.6),
            blurK: P.blur,
            hueK: P.hue - 0.5,
            satK: M(P.saturation, 0, 2),
            brightK: M(P.brightness, 0.3, 1.9),
            contrastK: M(P.contrast, 0.5, 1.6),
            tintK: P.tint,
            colour: GR.util.hexToRgb(COLOURS[P.colour] || '#ffffff'),
            transparent: ctx.transparent ? 1 : 0,
            anim,
          }, tmp);
          if (ctx.transparent) e.copy(tmp, ctx.out || null, { alpha: 1 });
          else post.run(tmp, { glow: 0.25, thresh: 0.5 }, ctx.out);
        },
      };
    },
  });
})();
