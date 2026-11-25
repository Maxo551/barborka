// Helpers shared by effects: the registry, a 2D overlay canvas that becomes a
// texture (tracking boxes, HUD text), and the camera HUD drawing.
(function () {
  'use strict';
  const BFX = window.BFX;
  BFX.effects = BFX.effects || {};

  BFX.registerEffect = function (id, def) {
    BFX.effects[id] = def;
  };

  // Map a 0..1 slider to a range.
  BFX.map = (v, a, b) => a + (b - a) * (v == null ? 0.5 : v);

  class Overlay {
    constructor(engine) {
      this.e = engine;
      this.cv = document.createElement('canvas');
      this.x = this.cv.getContext('2d');
      this.tex = engine.texture({ w: 2, h: 2 });
    }
    begin(w, h) {
      if (this.cv.width !== w || this.cv.height !== h) {
        this.cv.width = w;
        this.cv.height = h;
      }
      this.x.setTransform(1, 0, 0, 1, 0, 0);
      this.x.clearRect(0, 0, w, h);
      return this.x;
    }
    commit() {
      return this.e.upload(this.tex, this.cv);
    }
  }
  BFX.Overlay = Overlay;

  // Alpha-composite an overlay texture over a base texture.
  BFX.drawOver = function (engine, base, over, out, opts) {
    const p = engine.program('over', `uniform sampler2D base, over; uniform float amount;
void main(){ vec4 b = texture(base, uv); vec4 v = texture(over, uv); o = vec4(mix(b.rgb, v.rgb, v.a * amount), b.a); }`);
    engine.draw(p, { base, over, amount: opts && opts.amount != null ? opts.amount : 1 }, out);
  };

  function pad(n, l) { return String(Math.floor(n)).padStart(l || 2, '0'); }
  BFX.timecode = function (t, fps) {
    fps = fps || 30;
    const f = Math.floor((t % 1) * fps);
    return pad(t / 3600) + ':' + pad((t / 60) % 60) + ':' + pad(t % 60) + ':' + pad(f);
  };

  // Camcorder HUD. rect = [x0,y0,x1,y1] in pixels (top-left origin).
  BFX.drawHud = function (x, rect, t, o) {
    o = o || {};
    const [x0, y0, x1, y1] = rect;
    const w = x1 - x0, h = y1 - y0;
    const s = Math.max(10, Math.min(w, h) * 0.06);
    const col = o.color || '#ffffff';
    x.save();
    x.strokeStyle = col;
    x.fillStyle = col;
    x.lineWidth = Math.max(1.5, s * 0.14);
    if (o.glow) { x.shadowColor = col; x.shadowBlur = s * 0.8; }
    if (o.corners !== false) {
      const c = Math.min(w, h) * 0.12;
      const m = s * 0.6;
      const L = [[x0 + m, y0 + m, 1, 1], [x1 - m, y0 + m, -1, 1], [x0 + m, y1 - m, 1, -1], [x1 - m, y1 - m, -1, -1]];
      for (const [cx, cy, dx, dy] of L) {
        x.beginPath();
        x.moveTo(cx, cy + c * dy); x.lineTo(cx, cy); x.lineTo(cx + c * dx, cy);
        x.stroke();
      }
    }
    x.font = '600 ' + Math.round(s) + 'px "Share Tech Mono", "Consolas", monospace';
    x.textBaseline = 'top';
    if (o.rec !== false) {
      const blink = Math.floor(t * 2) % 2 === 0;
      if (blink) {
        x.save();
        x.fillStyle = '#ff2b2b'; x.shadowColor = '#ff2b2b'; x.shadowBlur = s;
        x.beginPath(); x.arc(x0 + s * 2, y0 + s * 2.05, s * 0.42, 0, Math.PI * 2); x.fill();
        x.restore();
      }
      x.fillText('REC', x0 + s * 2.8, y0 + s * 1.5);
    }
    if (o.label) {
      x.textAlign = 'right';
      x.fillText(o.label, x1 - s * 1.6, y0 + s * 1.5);
      x.textAlign = 'left';
    }
    if (o.timecode !== false) {
      x.textBaseline = 'bottom';
      x.fillText(BFX.timecode(t, 30), x0 + s * 1.6, y1 - s * 1.3);
      if (o.battery !== false) {
        const bx = x1 - s * 4.2, by = y1 - s * 2.2;
        x.strokeRect(bx, by, s * 2.4, s * 0.95);
        x.fillRect(bx + s * 2.4, by + s * 0.28, s * 0.22, s * 0.4);
        x.fillRect(bx + s * 0.18, by + s * 0.18, s * 1.6, s * 0.6);
      }
    }
    if (o.cross) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, c = s * 0.9;
      x.beginPath();
      x.moveTo(cx - c, cy); x.lineTo(cx - c * 0.35, cy); x.moveTo(cx + c * 0.35, cy); x.lineTo(cx + c, cy);
      x.moveTo(cx, cy - c); x.lineTo(cx, cy - c * 0.35); x.moveTo(cx, cy + c * 0.35); x.lineTo(cx, cy + c);
      x.stroke();
    }
    x.restore();
  };

  // Shared "inside look" GLSL used by HAND FRAME and BLOB TRACK box effects.
  BFX.GLSL_INSIDE = `
vec3 insideLook(float m, vec3 c, vec2 p, sampler2D src){
  float L = luma(c);
  if (m < .5) { // night vision
    float n = hash21(floor(p * res) + floor(time * 30.)) - .5;
    float l = pow(clamp(L * 1.6 + n * .12, 0., 1.), .8);
    return ramp3(l, vec3(0., .04, 0.), vec3(.18, .85, .25), vec3(.85, 1., .8));
  }
  if (m < 1.5) { // infrared
    vec3 f = vec3(c.g * 1.25 + c.r * .2, c.r * .35 + c.b * .2, c.b * .9 + c.g * .25);
    return saturateC(f, 1.4) * 1.15;
  }
  if (m < 2.5) return heat(L * 1.15);              // thermal
  if (m < 3.5) return vec3(pow(L, .9)) * vec3(.95, .97, 1.); // mono
  if (m < 4.5) return 1. - c;                       // invert
  if (m < 5.5) return floor(c * 4.) / 4.;           // posterize
  return c;
}`;
})();
