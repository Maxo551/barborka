// Media sources the panel can preview: two procedural demo scenes (so the
// panel works with no footage at all), a local video file, the webcam, or the
// clip selected in After Effects / Premiere Pro (loaded from its file path).
(function () {
  'use strict';
  const GR = window.GR;
  const rand = GR.util.rand;

  // ---------------------------------------------------------------- demo scenes
  class DemoSource {
    constructor(scene, w = 960, h = 540) {
      this.kind = 'demo';
      this.scene = scene; // 'night' | 'sunset'
      this.el = document.createElement('canvas');
      this.el.width = w;
      this.el.height = h;
      this.width = w;
      this.height = h;
      this.duration = 8;
      this.fps = 30;
      this.t = 0;
      this.playing = true;
      this.ready = Promise.resolve();
      this.name = scene === 'night' ? 'DEMO · NIGHT' : 'DEMO · SUNSET';
      const r = rand(scene === 'night' ? 7 : 11);
      this.buildings = [];
      let x = -40;
      while (x < w + 200) {
        const bw = 50 + r() * 90, bh = 120 + r() * 260;
        const wins = [];
        for (let wy = 14; wy < bh - 20; wy += 18) for (let wx = 8; wx < bw - 12; wx += 14) if (r() < 0.38) wins.push([wx, wy, r()]);
        this.buildings.push({ x, bw, bh, wins, shade: 0.06 + r() * 0.08 });
        x += bw + 4 + r() * 10;
      }
      this.stars = Array.from({ length: 90 }, () => [r() * w, r() * h * 0.45, r()]);
      this.palms = [[0.12, 1.05], [0.84, 1.2], [0.93, 0.85]];
      this.x = this.el.getContext('2d');
      this.draw();
    }
    play() { this.playing = true; }
    pause() { this.playing = false; }
    update(dt) { if (this.playing) { this.t += dt; this.draw(); } }
    async seek(t) { this.t = t; this.draw(); }
    get currentTime() { return this.t; }

    figure(x, cx, cy, s, t, body, rim) {
      // a dancing figure made of rounded limbs, lit from one side
      const sw = Math.sin(t * 3.1), cw = Math.cos(t * 2.3);
      const limb = (x0, y0, a, l, wdt) => {
        const x1 = x0 + Math.sin(a) * l, y1 = y0 + Math.cos(a) * l;
        x.lineCap = 'round';
        x.lineWidth = wdt;
        x.strokeStyle = body;
        x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
        x.lineWidth = wdt * 0.28;
        x.strokeStyle = rim;
        x.beginPath(); x.moveTo(x0 + wdt * 0.3, y0); x.lineTo(x1 + wdt * 0.3, y1); x.stroke();
        return [x1, y1];
      };
      const hip = [cx + sw * 6 * s, cy + Math.abs(cw) * 6 * s];
      const neck = [hip[0] + sw * 10 * s, hip[1] - 120 * s];
      // legs
      let k = limb(hip[0], hip[1], 0.25 + sw * 0.35, 70 * s, 26 * s); limb(k[0], k[1], -0.05 + sw * 0.2, 70 * s, 22 * s);
      k = limb(hip[0], hip[1], -0.25 + cw * 0.3, 70 * s, 26 * s); limb(k[0], k[1], 0.05 - cw * 0.25, 70 * s, 22 * s);
      // torso
      x.lineCap = 'round'; x.lineWidth = 46 * s; x.strokeStyle = body;
      x.beginPath(); x.moveTo(hip[0], hip[1]); x.lineTo(neck[0], neck[1] + 10 * s); x.stroke();
      x.lineWidth = 10 * s; x.strokeStyle = rim;
      x.beginPath(); x.moveTo(hip[0] + 18 * s, hip[1] - 4 * s); x.lineTo(neck[0] + 18 * s, neck[1] + 14 * s); x.stroke();
      // arms
      k = limb(neck[0], neck[1] + 8 * s, 2.4 + Math.sin(t * 4.2) * 0.9, 55 * s, 18 * s); limb(k[0], k[1], 3.1 + Math.sin(t * 4.2 + 1) * 1.1, 50 * s, 15 * s);
      k = limb(neck[0], neck[1] + 8 * s, -2.3 + Math.cos(t * 3.7) * 0.9, 55 * s, 18 * s); limb(k[0], k[1], -3.0 + Math.cos(t * 3.7 + 1) * 1.2, 50 * s, 15 * s);
      // head
      const hx = neck[0] + sw * 4 * s, hy = neck[1] - 26 * s;
      const g = x.createRadialGradient(hx + 8 * s, hy - 6 * s, 2, hx, hy, 26 * s);
      g.addColorStop(0, rim); g.addColorStop(0.55, body); g.addColorStop(1, body);
      x.fillStyle = g;
      x.beginPath(); x.ellipse(hx, hy, 21 * s, 25 * s, 0, 0, Math.PI * 2); x.fill();
    }

    draw() {
      const x = this.x, W = this.width, H = this.height, t = this.t;
      if (this.scene === 'night') {
        let g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#05070f'); g.addColorStop(0.6, '#141a36'); g.addColorStop(1, '#0a0c16');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        for (const [sx, sy, sr] of this.stars) {
          x.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.6 * Math.abs(Math.sin(t * 2 + sr * 20))) + ')';
          x.fillRect(sx, sy, 1.5, 1.5);
        }
        const drift = (t * 14) % 600;
        const base = H * 0.78;
        for (const b of this.buildings) {
          const bx = ((b.x - drift + 1400) % (W + 260)) - 130;
          x.fillStyle = 'rgb(' + [20, 24, 46].map((v) => Math.round(v + b.shade * 120)).join(',') + ')';
          x.fillRect(bx, base - b.bh, b.bw, b.bh);
          for (const [wx, wy, wr] of b.wins) {
            const on = Math.sin(t * 0.7 + wr * 40) > -0.6;
            if (!on) continue;
            x.fillStyle = wr > 0.8 ? '#7fd8ff' : wr > 0.5 ? '#ffd27a' : '#ffb347';
            x.fillRect(bx + wx, base - b.bh + wy, 7, 9);
          }
        }
        // neon sign
        const flick = Math.sin(t * 23) > -0.7 ? 1 : 0.25;
        x.save();
        x.font = 'bold 64px "Bungee", "Arial Black", sans-serif';
        x.shadowColor = '#ff2bd6'; x.shadowBlur = 30 * flick;
        x.fillStyle = flick > 0.5 ? '#ff7cf0' : '#5a2050';
        x.fillText('24/7', W * 0.07, H * 0.33);
        x.shadowColor = '#2bf0ff'; x.fillStyle = flick > 0.5 ? '#9ff8ff' : '#204a50';
        x.font = 'bold 34px "Bungee", "Arial Black", sans-serif';
        x.fillText('OPEN', W * 0.76, H * 0.25);
        x.restore();
        // street
        g = x.createLinearGradient(0, base, 0, H);
        g.addColorStop(0, '#1a1d2c'); g.addColorStop(1, '#06070c');
        x.fillStyle = g; x.fillRect(0, base, W, H - base);
        for (let i = 0; i < 5; i++) {
          const lx = ((i * 260 - t * 60) % (W + 260) + W + 260) % (W + 260) - 130;
          const lg = x.createRadialGradient(lx, base - 170, 2, lx, base - 170, 90);
          lg.addColorStop(0, 'rgba(255,240,200,1)'); lg.addColorStop(0.15, 'rgba(255,200,120,.55)'); lg.addColorStop(1, 'rgba(255,160,60,0)');
          x.fillStyle = lg; x.fillRect(lx - 90, base - 260, 180, 180);
          x.fillStyle = '#0b0c12'; x.fillRect(lx - 2, base - 168, 4, 168);
        }
        // car headlights sweep
        const cxp = ((t * 340) % (W * 2.2)) - W * 0.6;
        const hg = x.createRadialGradient(cxp, base + 40, 2, cxp, base + 40, 120);
        hg.addColorStop(0, 'rgba(255,255,255,1)'); hg.addColorStop(0.2, 'rgba(255,250,220,.5)'); hg.addColorStop(1, 'rgba(255,250,220,0)');
        x.fillStyle = hg; x.fillRect(cxp - 120, base - 80, 240, 240);
        // key light pool + figure
        const pool = x.createRadialGradient(W * 0.5, H * 0.95, 10, W * 0.5, H * 0.95, 260);
        pool.addColorStop(0, 'rgba(90,140,255,.45)'); pool.addColorStop(1, 'rgba(90,140,255,0)');
        x.fillStyle = pool; x.fillRect(0, 0, W, H);
        this.figure(x, W * 0.5 + Math.sin(t * 0.6) * 60, H * 0.62, 1.45, t, '#5a6fb0', '#b5f3ff');
      } else {
        let g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#2a0f45'); g.addColorStop(0.35, '#b23a6b'); g.addColorStop(0.62, '#ff9a3c'); g.addColorStop(0.64, '#3b1a3a'); g.addColorStop(1, '#120716');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        const sy = H * 0.46 + Math.sin(t * 0.3) * 6;
        const sg = x.createRadialGradient(W * 0.5, sy, 10, W * 0.5, sy, 170);
        sg.addColorStop(0, '#fff6c8'); sg.addColorStop(0.45, '#ffcf5a'); sg.addColorStop(0.75, 'rgba(255,120,60,.6)'); sg.addColorStop(1, 'rgba(255,90,60,0)');
        x.fillStyle = sg; x.beginPath(); x.arc(W * 0.5, sy, 170, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#3b1a3a';
        for (let i = 0; i < 6; i++) x.fillRect(W * 0.5 - 120, sy + 20 + i * 14 + i * i, 240, 4 + i);
        // ocean shimmer
        const sea = H * 0.63;
        for (let y = sea; y < H; y += 6) {
          const k = (y - sea) / (H - sea);
          for (let i = 0; i < 7; i++) {
            const wx = W * 0.5 + Math.sin(t * 2 + y * 0.13 + i * 1.7) * (40 + k * 160) - 20;
            x.fillStyle = 'rgba(255,200,120,' + (0.55 - k * 0.4) + ')';
            x.fillRect(wx, y, 30 + k * 40, 2);
          }
        }
        // palms
        for (const [px, ps] of this.palms) {
          const bx = W * px, by = H;
          x.strokeStyle = '#13060f'; x.lineWidth = 14 * ps; x.lineCap = 'round';
          const tx = bx + Math.sin(t * 0.8 + px * 9) * 10 + 30 * ps, ty = H * 0.28;
          x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + 40 * ps, (by + ty) / 2, tx, ty); x.stroke();
          x.lineWidth = 6 * ps;
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + Math.sin(t + i) * 0.08;
            x.beginPath(); x.moveTo(tx, ty);
            x.quadraticCurveTo(tx + Math.cos(a) * 70 * ps, ty + Math.sin(a) * 30 * ps - 30, tx + Math.cos(a) * 120 * ps, ty + Math.abs(Math.sin(a)) * 60 * ps + 20);
            x.stroke();
          }
        }
        // birds
        x.strokeStyle = '#1a0a1a'; x.lineWidth = 2.5;
        for (let i = 0; i < 5; i++) {
          const bx = ((t * 50 + i * 170) % (W + 100)) - 50, by = H * 0.18 + Math.sin(t + i) * 20 + i * 12;
          const f = Math.sin(t * 9 + i) * 6;
          x.beginPath(); x.moveTo(bx - 10, by - f); x.lineTo(bx, by); x.lineTo(bx + 10, by - f); x.stroke();
        }
        this.figure(x, W * 0.36 + Math.sin(t * 0.5) * 40, H * 0.64, 1.35, t * 0.8 + 2, '#1a0b1d', '#ffb066');
      }
    }
  }

  // ---------------------------------------------------------------- video file / path
  class VideoSource {
    constructor(url, name) {
      this.kind = 'video';
      this.name = name || 'CLIP';
      const v = (this.el = document.createElement('video'));
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      if (/^https?:/i.test(url)) v.crossOrigin = 'anonymous';
      v.src = url;
      this.playing = true;
      this.fps = 30;
      this.ready = new Promise((res, rej) => {
        v.addEventListener('loadeddata', () => res(), { once: true });
        v.addEventListener('error', () => rej(new Error('This video cannot be decoded here (try an H.264 .mp4).')), { once: true });
      }).then(() => {
        this.width = v.videoWidth;
        this.height = v.videoHeight;
        this.duration = v.duration || 0;
        v.play().catch(() => {});
      });
    }
    play() { this.playing = true; this.el.play().catch(() => {}); }
    pause() { this.playing = false; this.el.pause(); }
    // release the decoder when another clip replaces this one
    stop() { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); }
    update() {}
    get currentTime() { return this.el.currentTime; }
    // Frame-accurate seek used by the renderer.
    // A detached, paused <video> may never fire requestVideoFrameCallback, so
    // every wait is raced against a timer: a render must never hang on a seek.
    seek(t) {
      const v = this.el;
      const target = Math.max(0, Math.min(t, (v.duration || t + 1) - 1e-3));
      return new Promise((res) => {
        let finished = false;
        const finish = () => { if (!finished) { finished = true; res(); } };
        const settled = () => {
          if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(finish);
          setTimeout(finish, v.requestVideoFrameCallback ? 120 : 20);
        };
        if (Math.abs(v.currentTime - target) < 1e-4 && v.readyState >= 2) return finish();
        v.addEventListener('seeked', settled, { once: true });
        setTimeout(finish, 4000);
        v.currentTime = target;
      });
    }
  }

  // ---------------------------------------------------------------- webcam
  class CamSource {
    constructor() {
      this.kind = 'cam';
      this.name = 'CAMERA';
      const v = (this.el = document.createElement('video'));
      v.muted = true;
      v.playsInline = true;
      this.fps = 30;
      this.duration = 6;
      this.playing = true;
      this.ready = navigator.mediaDevices
        .getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
        .then((stream) => {
          this.stream = stream;
          v.srcObject = stream;
          return v.play();
        })
        .then(() => {
          this.width = v.videoWidth;
          this.height = v.videoHeight;
        });
    }
    play() { this.playing = true; }
    pause() { this.playing = false; }
    update() {}
    get currentTime() { return performance.now() / 1000; }
    async seek() {}
    stop() { if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); }
  }

  GR.Sources = { DemoSource, VideoSource, CamSource };
})();
