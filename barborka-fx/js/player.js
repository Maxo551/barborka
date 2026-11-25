// Preview player (the screen), card thumbnails, and the frame-accurate offline
// renderer used by APPLY.
(function () {
  'use strict';
  const BFX = window.BFX;
  const M = BFX.map;

  function transitionSeconds(card, P) {
    if (card.effect === 'mosh') return M(P.moshLength, 0.4, 3);
    if (card.effect === 'transition') return M(P.duration, 0.25, 2.5);
    return 0;
  }
  BFX.transitionSeconds = transitionSeconds;

  // Progress of a transition at time `t` (seconds since the overlay starts).
  function transitionProgress(card, t, D) {
    return Math.max(0, Math.min(1, t / D));
  }

  class Player {
    constructor(canvas) {
      this.canvas = canvas;
      this.e = new BFX.Engine(canvas);
      this.instances = new Map();
      this.texA = this.e.texture();
      this.texB = this.e.texture();
      this.card = null;
      this.params = null;
      this.paused = false;
      this.t = 0;
      this.frame = 0;
      this.last = performance.now();
      this.onStatus = null;
      this.maxW = 960;
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    instance(effectId) {
      let i = this.instances.get(effectId);
      if (!i) {
        i = BFX.effects[effectId].create(this.e);
        this.instances.set(effectId, i);
      }
      return i;
    }

    setSources(a, b) {
      this.srcA = a;
      this.srcB = b;
      this.restart();
    }

    setCard(card, params) {
      const changed = !this.card || this.card.id !== card.id;
      this.card = card;
      this.params = params;
      if (changed) this.restart();
    }

    restart() {
      this.t = 0;
      this.frame = 0;
      this.instances.forEach((i) => i.reset && i.reset());
    }

    setPaused(p) {
      this.paused = p;
      [this.srcA, this.srcB].forEach((s) => s && (p ? s.pause() : s.play()));
    }

    _size(src) {
      const sw = src && src.width ? src.width : 1920;
      const sh = src && src.height ? src.height : 1080;
      const w = Math.min(this.maxW, sw);
      return [Math.round(w), Math.round((w * sh) / sw)];
    }

    _loop(now) {
      requestAnimationFrame(this._loop);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.card || !this.srcA || this.hold) return;
      if (!this.paused) {
        this.t += dt;
        this.frame++;
        this.srcA.update(dt);
        if (this.srcB && this.srcB !== this.srcA) this.srcB.update(dt);
      }
      const [w, h] = this._size(this.srcA);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      try {
        this.renderFrame(dt);
      } catch (err) {
        console.error(err);
        this.hold = true;
        if (this.onStatus) this.onStatus('ERROR · ' + String(err.message || err).slice(0, 60));
      }
    }

    renderFrame(dt) {
      const e = this.e;
      e.time = this.t;
      const card = this.card, P = this.params;
      if (this.srcA.el) e.upload(this.texA, this.srcA.el);
      const isTrans = card.tab === 'transitions';
      let p = 0;
      if (isTrans) {
        e.upload(this.texB, (this.srcB || this.srcA).el);
        const D = transitionSeconds(card, P);
        const hold = 0.9;
        const cyc = hold + D + hold;
        const tt = this.t % cyc;
        // shader transitions have their cut in the middle, datamosh starts on the cut
        p = (tt - hold) / D;
        if (p < 0 || p > 1) {
          const inst = this.instance(card.effect);
          if (p < 0 && inst.reset && this._wasIn) inst.reset();
          this._wasIn = false;
        } else this._wasIn = true;
      }
      const ctx = {
        src: this.texA,
        srcB: this.texB,
        srcEl: this.srcA.el,
        srcW: this.srcA.width,
        srcH: this.srcA.height,
        out: null,
        t: this.t,
        p,
        dt,
        frame: this.frame,
        params: P,
        card,
        w: this.canvas.width,
        h: this.canvas.height,
        live: true,
      };
      this.instance(card.effect).render(ctx);
    }
  }

  // ------------------------------------------------------------------ thumbnails
  class Thumbs {
    constructor(w, h) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
      this.e = new BFX.Engine(this.canvas);
      this.instances = new Map();
      this.a = this.e.texture();
      this.b = this.e.texture();
    }
    draw(card, srcA, srcB, target) {
      const e = this.e;
      let inst = this.instances.get(card.effect);
      if (!inst) this.instances.set(card.effect, (inst = BFX.effects[card.effect].create(e)));
      inst.reset && inst.reset();
      const P = BFX.catalog.defaults(card);
      if (card.textInput && card.tab === 'titles') P.text = 'GLITCH';
      e.upload(this.a, srcA.el);
      e.upload(this.b, srcB.el);
      const frames = card.effect === 'trip' ? 1 : card.effect === 'clones' || card.effect === 'blob' || card.effect === 'handframe' ? 4 : 1;
      for (let i = 0; i < frames; i++) {
        const t = card.effect === 'trip' ? 4.2 : 1.3 + i / 30;
        e.time = t;
        const p = card.effect === 'mosh' ? 0.35 : 0.5;
        inst.render({
          src: this.a, srcB: this.b, srcEl: srcA.el, out: null, t, p, dt: 1 / 30, frame: i,
          params: Object.assign(P, card.effect === 'handframe' ? { tracking: 2 } : {}),
          card, w: this.canvas.width, h: this.canvas.height, live: false, duration: 3,
        });
      }
      const x = target.getContext('2d');
      x.drawImage(this.canvas, 0, 0, target.width, target.height);
    }
  }

  // ------------------------------------------------------------------ offline render
  // job: {card, params, srcA, srcB, startA, startB, duration, fps, width, height,
  //       transparent, onFrame(canvas, index, count) -> Promise, onProgress(f), signal}
  async function renderSequence(job) {
    const canvas = document.createElement('canvas');
    canvas.width = job.width;
    canvas.height = job.height;
    const e = new BFX.Engine(canvas);
    const inst = BFX.effects[job.card.effect].create(e);
    const a = e.texture(), b = e.texture();
    const n = Math.max(1, Math.round(job.duration * job.fps));
    const isTrans = job.card.tab === 'transitions';
    const freezeA = job.card.effect === 'mosh';
    for (let i = 0; i < n; i++) {
      if (job.signal && job.signal.aborted) throw new Error('cancelled');
      const t = i / job.fps;
      await job.srcA.seek(freezeA ? job.startA : job.startA + t);
      e.upload(a, job.srcA.el);
      if (isTrans) {
        await job.srcB.seek(job.startB + t);
        e.upload(b, job.srcB.el);
      }
      e.time = t;
      inst.render({
        src: a, srcB: b, srcEl: job.srcA.el, srcW: job.srcA.width, srcH: job.srcA.height,
        out: null, t, p: isTrans ? (i + 0.5) / n : 0, dt: 1 / job.fps, frame: i,
        params: job.params, card: job.card, w: job.width, h: job.height,
        live: false, transparent: !!job.transparent, duration: job.duration,
      });
      await job.onFrame(canvas, i, n);
      if (job.onProgress) job.onProgress((i + 1) / n);
    }
    const lose = e.gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return n;
  }

  BFX.Player = Player;
  BFX.Thumbs = Thumbs;
  BFX.renderSequence = renderSequence;
})();
