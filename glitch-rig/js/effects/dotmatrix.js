// DOT MATRIX family: the image rebuilt from cells (dots, shaded orbs, glyphs,
// words or LED squares), recoloured through a palette, with falling code
// rain, twinkling sparkles and the shared finishing pass.
(function () {
  'use strict';
  const GR = window.GR;
  const M = GR.map;

  const FRAG = `uniform sampler2D src, atlas;
uniform float glyphCount, cell, mode, dotSize, depth, darkDetail, brighten, shadows, invert;
uniform float pmode, keep, bg, rain, rainSpeed, sparkle, sparkleSize, rainGlyphs;
uniform vec3 c0, c1, c2;

float glyph(float gi, vec2 f, float scale){
  vec2 ff = (f - .5) / scale + .5;
  if (ff.x < 0. || ff.y < 0. || ff.x > 1. || ff.y > 1.) return 0.;
  gi = mod(gi, glyphCount);
  vec2 g = vec2(mod(gi, 16.), floor(gi / 16.));
  return texture(atlas, (vec2(g.x, 15. - g.y) + ff) / 16.).r;
}

vec3 palette(float L, vec3 sc, vec2 p){
  vec3 col;
  if (pmode < .5) col = saturateC(sc / max(max(sc.r, max(sc.g, sc.b)), .05), 1.25) * (.08 + L);
  else if (pmode < 1.5) col = mix(c0, c1, L);
  else if (pmode < 2.5) { float h = fract(L * .55 + p.x * .55 + p.y * .35 + time * .02); col = mix(c0, hsv2rgb(vec3(h, .55, 1.)), .7) * (.2 + L * 1.35); }
  else if (pmode < 3.5) col = hsv2rgb(vec3(fract(p.x * .9 + p.y * .35 + time * .04 + L * .25), .75, 1.)) * (.1 + L);
  else if (pmode < 4.5) col = heat(L);
  else col = ramp3(L, c0, c1, c2);
  return mix(col, sc * (.35 + L), keep);
}

float sparkles(vec2 fc){
  float gsz = mix(26., 80., sparkleSize);
  vec2 gi = floor(fc / gsz);
  float s = 0.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = gi + vec2(float(i), float(j));
    vec2 h = hash22(g);
    float on = step(.45, hash21(g + 3.7));
    vec2 pos = (g + h) * gsz;
    float ph = hash21(g + 7.1);
    float tw = pow(max(sin(time * (1.2 + ph * 3.) + ph * 6.283), 0.), 6.) * on;
    tw *= smoothstep(.2, .65, luma(texture(src, pos / res).rgb));
    vec2 d = abs(fc - pos);
    float sz = gsz * mix(.18, .55, sparkleSize);
    float star = exp(-d.x / (sz * .05)) * exp(-d.y / sz) + exp(-d.y / (sz * .05)) * exp(-d.x / sz);
    star += exp(-length(d) / (sz * .1));
    s += star * tw;
  }
  return s;
}

void main(){
  vec2 fc = uv * res;
  float cs = cell;
  vec2 ci = floor(fc / cs);
  vec2 f = fract(fc / cs);
  vec2 cuv = (ci + .5) * cs / res;
  vec2 e = vec2(cs) / res;
  vec3 sc = (texture(src, cuv).rgb * 2. + texture(src, cuv + e * .25).rgb + texture(src, cuv - e * .25).rgb) * .25;
  float L = luma(sc);
  float lx = luma(texture(src, cuv + vec2(e.x, 0.)).rgb) - luma(texture(src, cuv - vec2(e.x, 0.)).rgb);
  float ly = luma(texture(src, cuv + vec2(0., e.y)).rgb) - luma(texture(src, cuv - vec2(0., e.y)).rgb);
  float edge = clamp(length(vec2(lx, ly)) * 2.5, 0., 1.);
  if (invert > .5) L = 1. - L;
  L = pow(clamp(L, 0., 1.), mix(1.25, .45, darkDetail));
  L *= .75 + brighten * 1.1;
  L = mix(L, max(L, edge * 1.2), depth);
  float floorL = shadows * .22;
  L = clamp((L - floorL) / (1. - floorL), 0., 1.);

  // falling code rain, one stream per column
  float colSeed = hash11(ci.x * 1.731 + 3.1);
  float speed = (.35 + colSeed) * (.15 + rainSpeed * 1.6);
  float yTop = 1. - (ci.y + .5) * cs / res.y;
  float head = fract(time * speed * .35 + colSeed * 9.13);
  float dist = head - yTop; if (dist < 0.) dist += 1.;
  float trail = exp(-dist * 7.);
  float isHead = smoothstep(cs / res.y * 1.5, 0., dist);
  float flickRate = 3. + rainSpeed * 14.;
  float gscale = mix(.7, 1.08, dotSize);

  float A, V = L;
  if (mode < .5) {
    float r = mix(.18, .6, dotSize) * (.4 + .6 * sqrt(L));
    A = smoothstep(r, r - .14, length(f - .5));
  } else if (mode < 1.5) {
    float r = mix(.2, .56, dotSize) * (.35 + .65 * sqrt(L));
    vec2 q = (f - .5) / max(r, 1e-3);
    float d = dot(q, q);
    vec3 n = vec3(q, sqrt(max(1. - d, 0.)));
    vec3 ld = normalize(vec3(-.45, .55, .7));
    float lit = .25 + .75 * max(dot(n, ld), 0.);
    float spec = pow(max(dot(reflect(-ld, n), vec3(0., 0., 1.)), 0.), 18.);
    A = (1. - smoothstep(.8, 1., d)) * (lit + spec * 1.2);
    V = clamp(L * .8 + spec * .5, 0., 1.);
  } else if (mode < 2.5) {
    A = glyph(floor((.12 + .88 * L) * (glyphCount - 1.) + .5), f, gscale);
    V = .3 + .8 * L;
  } else if (mode < 3.5) {
    float gi = floor(hash21(ci + floor(time * flickRate * (.3 + hash21(ci.yx)))) * glyphCount);
    A = glyph(gi, f, gscale);
    V = clamp(L * 1.35 * (1. - rain * .3 + rain * trail * 1.2) + isHead * rain * .7, 0., 1.);
  } else if (mode < 4.5) {
    A = glyph(mod(ci.x + ci.y * 7. + floor(time * (1. + rainSpeed * 6.)), glyphCount), f, gscale);
    V = .2 + .8 * L;
  } else {
    vec2 q = abs(f - .5);
    A = step(max(q.x, q.y), mix(.2, .47, dotSize)) * (.35 + .65 * step(.08, L));
  }

  // glyph strokes cover less of a cell than a dot does, so they get more gain
  float gain = (mode > 1.5 && mode < 4.5) ? 1.7 : 1.;
  vec3 col = palette(V, sc, uv) * A * gain;
  if (mode < 3.5 && mode > 2.5) col += vec3(.75) * isHead * rain * A;
  // rain overlay for non-glyph looks
  if (rainGlyphs > .5 && rain > 0.) {
    float gi = floor(hash21(ci + 11. + floor(time * flickRate)) * glyphCount);
    float rg = glyph(gi, f, .85) * trail * rain;
    col += (palette(1., sc, uv) * .8 + isHead * .6) * rg * (.3 + .7 * L);
  }
  col += sc * bg * .35 * (1. - clamp(A, 0., 1.));
  col += vec3(1., .97, .92) * sparkles(fc) * sparkle * 1.4;
  o = vec4(col, 1.);
}`;

  const SET_KEYS = ['symbols', 'letters', 'numbers', 'binary', 'kana', 'code', 'blocks', 'ascii', 'words'];

  GR.registerEffect('dotmatrix', {
    create(e) {
      const post = new GR.Post(e);
      const tmp = e.target(4, 4);
      return {
        render(ctx) {
          const P = ctx.params, V = ctx.card.look;
          e.resize(tmp, ctx.w, ctx.h);
          const setKey = SET_KEYS[P.chars] || V.set || 'symbols';
          const atlas = GR.Glyphs.atlas(e, setKey, P.text || V.words);
          const short = Math.min(ctx.w, ctx.h);
          // glyphs need bigger cells than dots to stay readable
          const glyphy = V.mode >= 2 && V.mode <= 4;
          const cell = Math.max(3, Math.round(short * M(P.size, 0.004, 0.034) * (glyphy ? 1.45 : 1)));
          const c = (k, d) => GR.util.hexToRgb(V[k] || d);
          e.draw(e.program('dotmatrix', FRAG), {
            src: ctx.src,
            atlas,
            glyphCount: atlas.count,
            cell,
            mode: V.mode,
            dotSize: P.dotSize,
            depth: P.depth,
            darkDetail: P.darkDetail,
            brighten: P.brighten,
            shadows: P.shadows,
            invert: V.invert ? 1 : 0,
            pmode: V.pmode,
            keep: V.keep || 0,
            bg: V.bg == null ? 0.3 : V.bg,
            rain: P.rain,
            rainSpeed: P.rainSpeed,
            rainGlyphs: V.mode === 2 || V.mode === 3 || V.mode === 4 ? 0 : 1,
            sparkle: P.sparkle,
            sparkleSize: P.sparkleSize,
            c0: c('c0', '#000000'),
            c1: c('c1', '#ffffff'),
            c2: c('c2', '#ffffff'),
          }, tmp);
          post.run(tmp, {
            glow: P.glow,
            streaks: P.streaks,
            thresh: 0.6,
            rgb: P.rgb,
            scanline: P.scanLine,
            scanlines: P.scanlines,
            grain: P.grain,
            vignette: P.vignette,
            flicker: P.flicker,
            hue: (P.lookColour - 0.5),
            streakTint: V.streakTint || [0.8, 0.9, 1.0],
          }, ctx.out);
        },
        reset() {},
      };
    },
  });
})();
