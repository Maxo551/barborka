// GLITCH RIG — WebGL2 engine.
// Classic script (not an ES module): CEP serves panels over file://, where
// module imports are blocked. Everything hangs off one global: window.GR.
(function () {
  'use strict';
  const GR = (window.GR = window.GR || {});

  const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

  // Shared GLSL prelude prepended to every fragment shader.
  const HEADER = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform vec2 res;
uniform float time;
#define PI 3.14159265359
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), u.x), mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), u.x), u.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(0., 2. / 3., 1. / 3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0., -1. / 3., 2. / 3., -1.);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y); float e = 1e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6. * d + e)), d / (q.x + e), q.x); }
vec3 hueShift(vec3 c, float h){ vec3 v = rgb2hsv(c); v.x = fract(v.x + h); return hsv2rgb(v); }
vec3 saturateC(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }
vec3 ramp3(float t, vec3 a, vec3 b, vec3 c){ return t < .5 ? mix(a, b, t * 2.) : mix(b, c, t * 2. - 1.); }
vec3 heat(float t){ t = clamp(t, 0., 1.);
  vec3 c = mix(vec3(0., 0., .15), vec3(.35, 0., .65), smoothstep(0., .25, t));
  c = mix(c, vec3(.9, .1, .25), smoothstep(.2, .45, t));
  c = mix(c, vec3(1., .55, 0.), smoothstep(.45, .7, t));
  c = mix(c, vec3(1., 1., .55), smoothstep(.7, .95, t));
  return c; }
`;

  class Engine {
    constructor(canvas) {
      const gl = canvas.getContext('webgl2', {
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        antialias: false,
        alpha: true,
      });
      if (!gl) throw new Error('WebGL2 is not available on this machine.');
      this.gl = gl;
      this.canvas = canvas;
      this.programs = new Map();
      this.floatTargets = !!gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('OES_texture_float_linear');
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.time = 0;
      this._small = null;
    }

    // Compile (once) and return a program for a fragment body.
    program(key, frag) {
      let p = this.programs.get(key);
      if (p) return p;
      const gl = this.gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(s);
          const numbered = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
          console.error('[GR] shader "' + key + '" failed:\n' + log + '\n' + numbered);
          throw new Error('Shader ' + key + ': ' + log);
        }
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, HEADER + frag));
      gl.bindAttribLocation(prog, 0, 'p');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Link ' + key + ': ' + gl.getProgramInfoLog(prog));
      }
      p = { prog, loc: new Map(), key };
      this.programs.set(key, p);
      return p;
    }

    _loc(p, name) {
      if (!p.loc.has(name)) p.loc.set(name, this.gl.getUniformLocation(p.prog, name));
      return p.loc.get(name);
    }

    texture(opts = {}) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const filter = opts.nearest ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mipmap ? gl.LINEAR_MIPMAP_LINEAR : filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      const wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      const w = opts.w || 2, h = opts.h || 2;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return { tex, w, h, opts };
    }

    // Upload a video / canvas / image into a texture (flipped so uv(0,0) is bottom-left).
    upload(t, source) {
      const gl = this.gl;
      const w = source.videoWidth || source.naturalWidth || source.width;
      const h = source.videoHeight || source.naturalHeight || source.height;
      if (!w || !h) return t;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      if (t.opts && t.opts.mipmap) gl.generateMipmap(gl.TEXTURE_2D);
      t.w = w;
      t.h = h;
      return t;
    }

    // Render target (texture + framebuffer). float:true -> RGBA16F when supported.
    target(w, h, opts = {}) {
      const gl = this.gl;
      const t = { tex: gl.createTexture(), fbo: gl.createFramebuffer(), w: 0, h: 0, opts };
      this.resize(t, w, h);
      return t;
    }

    resize(t, w, h) {
      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));
      if (t.w === w && t.h === h) return t;
      const gl = this.gl;
      const float = t.opts.float && this.floatTargets;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      const filter = t.opts.nearest ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      const wrap = t.opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      t.w = w;
      t.h = h;
      return t;
    }

    free(t) {
      if (!t) return;
      const gl = this.gl;
      if (t.tex) gl.deleteTexture(t.tex);
      if (t.fbo) gl.deleteFramebuffer(t.fbo);
    }

    // Draw a full-screen pass. `out` = render target, or null for the canvas.
    draw(p, uniforms, out) {
      const gl = this.gl;
      const w = out ? out.w : this.canvas.width;
      const h = out ? out.h : this.canvas.height;
      gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.BLEND);
      gl.useProgram(p.prog);
      gl.bindVertexArray(this.vao);
      let unit = 0;
      const set = (name, v) => {
        const loc = this._loc(p, name);
        if (loc === null) return;
        if (v && v.tex) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, v.tex);
          gl.uniform1i(loc, unit);
          unit++;
        } else if (typeof v === 'number' || typeof v === 'boolean') {
          gl.uniform1f(loc, +v);
        } else if (Array.isArray(v) || v instanceof Float32Array) {
          if (v.length === 2) gl.uniform2fv(loc, v);
          else if (v.length === 3) gl.uniform3fv(loc, v);
          else if (v.length === 4) gl.uniform4fv(loc, v);
          else gl.uniform1fv(loc, v);
        }
      };
      set('res', [w, h]);
      set('time', this.time);
      for (const k in uniforms) set(k, uniforms[k]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // unbind textures so a target is never sampled while bound as output next pass
      for (let i = 0; i < unit; i++) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
    }

    copy(src, out, extra) {
      const p = this.program('copy', `uniform sampler2D tex; uniform float alpha;
void main(){ vec4 c = texture(tex, uv); o = vec4(c.rgb, mix(1., c.a, alpha)); }`);
      this.draw(p, Object.assign({ tex: src, alpha: 0 }, extra || {}), out);
    }

    // Downscale a texture to w x h and read the RGBA bytes back (for CPU analysis).
    readSmall(src, w, h) {
      if (!this._small) this._small = this.target(w, h);
      this.resize(this._small, w, h);
      this.copy(src, this._small);
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._small.fbo);
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return px; // rows bottom-up (GL convention), same as uv space
    }
  }

  GR.Engine = Engine;
  GR.GLSL_HEADER = HEADER;

  // A pool of ping-pong helpers effects can lean on.
  GR.util = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    smooth: (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    },
    hexToRgb(hex) {
      const n = parseInt(hex.replace('#', ''), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    },
    rand(seed) {
      // mulberry32
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
  };
})();
