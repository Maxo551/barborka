// Host bridge. Inside After Effects / Premiere Pro (CEP) APPLY renders the
// selected clip frame by frame through the same GPU effect you see on the
// screen, writes a PNG sequence and places it on the track above the clip.
// In a plain browser APPLY records the screen to a .webm instead.
(function () {
  'use strict';
  const BFX = window.BFX;

  const cep = typeof window !== 'undefined' && !!window.__adobe_cep__;
  function detectApp() {
    if (!cep) return 'browser';
    try {
      const id = String(JSON.parse(window.__adobe_cep__.getHostEnvironment()).appId || '').toUpperCase();
      if (id === 'PPRO') return 'ppro';
      if (id === 'AEFT') return 'ae';
      return id.toLowerCase();
    } catch (e) { return 'cep'; }
  }
  const app = detectApp();

  function nodeRequire() {
    if (typeof window.require === 'function') return window.require;
    if (window.cep_node && typeof window.cep_node.require === 'function') return window.cep_node.require;
    return null;
  }

  function evalScript(code) {
    return new Promise((resolve) => {
      try { window.__adobe_cep__.evalScript(code, (r) => resolve(r)); } catch (e) { resolve(JSON.stringify({ ok: false, err: String(e) })); }
    });
  }

  async function call(fn, arg) {
    const code = arg === undefined ? fn + '()' : fn + '(' + JSON.stringify(JSON.stringify(arg)) + ')';
    const raw = await evalScript(code);
    try { return JSON.parse(raw); } catch (e) { return { ok: false, err: 'Host said: ' + String(raw).slice(0, 200) }; }
  }

  function fileUrl(p) {
    let s = String(p).replace(/\\/g, '/');
    if (!s.startsWith('/')) s = '/' + s;
    return 'file://' + encodeURI(s).replace(/#/g, '%23').replace(/\?/g, '%3F');
  }

  // A blank source for titles (they render on transparency).
  function blankSource(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { el: c, width: w, height: h, async seek() {}, play() {}, pause() {}, update() {} };
  }

  // Fallback when Chromium cannot decode the clip (ProRes, some HEVC): ask the
  // host to export composited frames as PNG and read them back.
  class HostFrameSource {
    constructor(dir, which, w, h) {
      this.dir = dir; this.which = which; this.width = w; this.height = h;
      this.el = new Image();
      this.n = 0;
    }
    async seek(t) {
      const fs = nodeRequire()('fs'), path = nodeRequire()('path');
      const base = path.join(this.dir, '_grab_' + this.which + '_' + (this.n++));
      const r = await call('bfxGrabFrame', { time: t, base });
      if (!r.ok) throw new Error(r.err || 'Frame grab failed');
      const file = base + '.png';
      for (let i = 0; i < 100 && !fs.existsSync(file); i++) await new Promise((res) => setTimeout(res, 40));
      if (!fs.existsSync(file)) throw new Error('The host did not export a frame.');
      await new Promise((res, rej) => { this.el.onload = res; this.el.onerror = rej; this.el.src = fileUrl(file) + '?' + this.n; });
      try { fs.unlinkSync(file); } catch (e) { /* keep going */ }
    }
    play() {} pause() {} update() {}
  }

  async function openClip(p, dir, which, w, h, srcTime) {
    const v = new BFX.Sources.VideoSource(fileUrl(p), p.split(/[\\/]/).pop());
    try {
      await Promise.race([v.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);
      v.pause();
      return v;
    } catch (e) {
      console.warn('[BFX] cannot decode', p, '- using host frames');
      return new HostFrameSource(dir, which, w, h, srcTime);
    }
  }

  // CEP 10 ships Node 8 / Chromium 74: no recursive mkdir, no Blob.arrayBuffer.
  function mkdirp(fs, path, dir) {
    if (fs.existsSync(dir)) return;
    mkdirp(fs, path, path.dirname(dir));
    fs.mkdirSync(dir);
  }
  function blobBytes(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsArrayBuffer(blob);
    });
  }

  function stamp() {
    const d = new Date();
    const z = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
  }

  async function applyInHost(card, params, ui) {
    const req = nodeRequire();
    if (!req) throw new Error('Node.js is not enabled for this panel (check manifest.xml).');
    const fs = req('fs'), path = req('path'), os = req('os');
    const kind = card.tab === 'transitions' ? 'transition' : card.tab === 'titles' ? 'title' : 'look';
    const info = await call('bfxGetTarget', { kind });
    if (!info.ok) throw new Error(info.err || 'Nothing selected.');
    const fps = info.fps || 30;
    const W = info.width, H = info.height;
    const slug = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const tag = stamp();
    const dir = path.join(os.homedir(), 'Documents', 'BarborkaFX', 'renders', tag + '_' + slug);
    mkdirp(fs, path, dir);
    const prefix = 'bfx-' + slug + '-' + tag + '_';

    let srcA, srcB, startA = 0, startB = 0, duration, placeAt, transparent = false;
    if (kind === 'look') {
      const secs = BFX.LENGTH_SECONDS[params.length];
      duration = Math.max(1 / fps, Math.min(secs || info.remaining, info.remaining));
      srcA = await openClip(info.path, dir, 'a', W, H);
      startA = info.srcAt;
      placeAt = info.start;
      if (srcA instanceof HostFrameSource) { startA = info.start; }
    } else if (kind === 'transition') {
      const D = BFX.transitionSeconds(card, params);
      duration = D;
      srcA = await openClip(info.a.path, dir, 'a', W, H);
      srcB = await openClip(info.b.path, dir, 'b', W, H);
      const hostA = srcA instanceof HostFrameSource, hostB = srcB instanceof HostFrameSource;
      if (card.effect === 'mosh') {
        placeAt = info.cut;
        startA = hostA ? info.cut - 1 / fps : Math.max(0, info.a.cutSrc - 1 / fps);
        startB = hostB ? info.cut : info.b.cutSrc;
      } else {
        placeAt = info.cut - D / 2;
        startA = hostA ? info.cut - D / 2 : Math.max(0, info.a.cutSrc - D / 2);
        startB = hostB ? info.cut - D / 2 : Math.max(0, info.b.cutSrc - D / 2);
      }
    } else {
      duration = BFX.TITLE_SECONDS[params.length] || 3;
      srcA = blankSource(W, H);
      placeAt = info.start;
      transparent = true;
    }

    const files = [];
    await BFX.renderSequence({
      card, params, srcA, srcB: srcB || srcA, startA, startB, duration, fps,
      width: W, height: H, transparent,
      onProgress: (f) => ui.progress(f),
      async onFrame(canvas, i) {
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        const buf = req('buffer').Buffer.from(await blobBytes(blob));
        const file = path.join(dir, prefix + String(i).padStart(5, '0') + '.png');
        fs.writeFileSync(file, buf);
        files.push(file);
      },
    });
    const placed = await call('bfxPlace', {
      kind, first: files[0], count: files.length, fps, start: placeAt, duration,
      name: 'BFX ' + card.name, track: info.track, layerIndex: info.layerIndex,
    });
    if (!placed.ok) throw new Error(placed.err || 'Could not place the render.');
    return { frames: files.length, dir };
  }

  // Browser: record the live screen for the effect's length.
  async function recordInBrowser(player, card, params, ui) {
    const canvas = player.canvas;
    if (!canvas.captureStream || !window.MediaRecorder) throw new Error('This browser cannot record the canvas.');
    let secs;
    if (card.tab === 'transitions') secs = 0.9 * 2 + BFX.transitionSeconds(card, params);
    else if (card.tab === 'titles') secs = BFX.TITLE_SECONDS[params.length] || 3;
    else secs = BFX.LENGTH_SECONDS[params.length] || (card.effect === 'trip' ? BFX.tripCycle(params) : 6);
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : undefined);
    const chunks = [];
    rec.ondataavailable = (ev) => ev.data && ev.data.size && chunks.push(ev.data);
    const done = new Promise((res) => (rec.onstop = res));
    player.setPaused(false);
    player.restart();
    if (player.srcA && player.srcA.seek) await player.srcA.seek(0);
    rec.start(250);
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        const f = (performance.now() - t0) / 1000 / secs;
        ui.progress(Math.min(1, f));
        if (f >= 1) res(); else requestAnimationFrame(tick);
      };
      tick();
    });
    rec.stop();
    await done;
    stream.getTracks().forEach((t) => t.stop());
    const ext = (rec.mimeType || mime).includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'barborka-fx-' + card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.' + ext;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return { seconds: secs, file: a.download };
  }

  BFX.Host = {
    cep,
    app,
    evalScript,
    call,
    fileUrl,
    applyInHost,
    recordInBrowser,
    async clipName() {
      if (!cep) return null;
      const info = await call('bfxGetTarget', { kind: 'look' });
      return info.ok ? info.name : null;
    },
  };
})();
