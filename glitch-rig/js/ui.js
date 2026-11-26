// Panel UI: tabs, card list, the VFD controls, switches and APPLY.
(function () {
  'use strict';
  const GR = window.GR;
  const $ = (s) => document.querySelector(s);
  const PER_PAGE = 12;
  const Host = GR.Host;
  const sfx = GR.sfx;

  // ------------------------------------------------------------------ state
  const store = {
    get(k, d) { try { const v = localStorage.getItem('glitchrig.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('glitchrig.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const state = {
    tab: store.get('tab', 'looks'),
    selected: store.get('selected', {}), // tab -> card id
    params: {},                          // card id -> params
    page: 0,
    busy: false,
  };
  const rig = $('#rig');

  // ------------------------------------------------------------------ fit to window
  function fit() {
    if (window.innerWidth <= 860) { rig.style.transform = ''; return; }
    const s = Math.min(window.innerWidth / 1310, window.innerHeight / 830);
    rig.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  // ------------------------------------------------------------------ toast + chip
  let toastTimer = 0;
  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!err);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), err ? 6500 : 3800);
  }
  function chip(text, mode) {
    const c = $('#chip');
    c.querySelector('span').textContent = text;
    c.classList.toggle('busy', mode === 'busy');
    c.classList.toggle('err', mode === 'err');
  }

  // ------------------------------------------------------------------ sources + player
  const demoA = new GR.Sources.DemoSource('night');
  const demoB = new GR.Sources.DemoSource('sunset');
  let srcA = demoA, srcB = demoB;
  let player;
  try {
    player = new GR.Player($('#screen'));
  } catch (err) {
    chip('NO WEBGL2', 'err');
    toast('This machine has no WebGL2, so the panel cannot draw effects.', true);
    return;
  }
  player.onStatus = (s) => chip(s, 'err');
  player.setSources(srcA, srcB);

  function setSource(which, src) {
    if (which === 'A') {
      if (srcA && srcA !== demoA && srcA.stop) srcA.stop();
      srcA = src;
    } else srcB = src;
    player.setSources(srcA, srcB);
    $('#srcName').textContent = srcA.name + (state.tab === 'transitions' ? '  →  ' + srcB.name : '');
  }

  // ------------------------------------------------------------------ thumbnails
  let thumbs = null;
  const thumbA = new GR.Sources.DemoSource('night');
  const thumbB = new GR.Sources.DemoSource('sunset');
  thumbA.seek(1.3);
  thumbB.seek(2.1);
  const thumbQueue = [];
  const thumbCache = new Map(); // card id -> rendered canvas
  let thumbsReady = false;
  function queueThumb(card, canvas) {
    const done = thumbCache.get(card.id);
    if (done) { canvas.getContext('2d').drawImage(done, 0, 0, canvas.width, canvas.height); return; }
    thumbQueue.push([card, canvas]);
    if (thumbsReady) pumpThumbs();
  }
  let pumping = false;
  function pumpThumbs() {
    if (pumping) return;
    pumping = true;
    const step = () => {
      const job = thumbQueue.shift();
      if (!job) { pumping = false; return; }
      const [card, canvas] = job;
      if (!canvas.isConnected) { step(); return; } // the list was rebuilt
      try {
        const cached = thumbCache.get(card.id);
        if (cached) canvas.getContext('2d').drawImage(cached, 0, 0, canvas.width, canvas.height);
        else {
          if (!thumbs) thumbs = new GR.Thumbs(480, 270);
          thumbs.draw(card, thumbA, thumbB, canvas);
          const keep = document.createElement('canvas');
          keep.width = canvas.width; keep.height = canvas.height;
          keep.getContext('2d').drawImage(canvas, 0, 0);
          thumbCache.set(card.id, keep);
        }
      } catch (e) { console.warn('[GR] thumb', card.name, e); }
      setTimeout(step, 0);
    };
    step();
  }

  // ------------------------------------------------------------------ tabs + cards
  function currentCard() {
    return GR.catalog.byId(state.selected[state.tab]) || GR.catalog.cards.find((c) => c.tab === state.tab);
  }

  function setTab(tab, silent) {
    state.tab = tab;
    store.set('tab', tab);
    rig.dataset.tab = tab;
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $('#srcBtnsB').hidden = Host.cep || tab !== 'transitions';
    buildCards();
    select(currentCard().id, true);
    if (!silent) sfx.click();
  }

  function buildCards() {
    const box = $('#cards');
    box.innerHTML = '';
    thumbQueue.length = 0;
    GR.catalog.cards.filter((c) => c.tab === state.tab).forEach((card) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.setAttribute('role', 'option');
      b.dataset.id = card.id;
      const cv = document.createElement('canvas');
      cv.width = 320;
      cv.height = 180;
      const lab = document.createElement('span');
      lab.className = 'card-label';
      lab.textContent = card.name;
      b.append(cv, lab);
      b.addEventListener('click', () => { select(card.id); sfx.click(); });
      box.appendChild(b);
      queueThumb(card, cv);
    });
  }

  function select(id, silent) {
    const card = GR.catalog.byId(id);
    if (!card) return;
    state.selected[state.tab] = id;
    store.set('selected', state.selected);
    if (!state.params[id]) state.params[id] = Object.assign(GR.catalog.defaults(card), store.get('p.' + id, {}));
    const P = state.params[id];
    player.setCard(card, P);
    state.page = 0;
    document.querySelectorAll('.card').forEach((el) => {
      const on = el.dataset.id === id;
      el.setAttribute('aria-selected', String(on));
      if (on && !silent) el.scrollIntoView({ block: 'nearest' });
    });
    $('#cardName').textContent = card.name;
    const ti = $('#vfdText');
    ti.hidden = !card.textInput;
    if (card.textInput) {
      $('#wordsLabel').textContent = card.textLabel || 'TYPE';
      $('#words').value = P.text || '';
    }
    $('#srcName').textContent = srcA.name + (state.tab === 'transitions' ? '  →  ' + srcB.name : '');
    buildControls();
  }

  function saveParams(card) {
    store.set('p.' + card.id, state.params[card.id]);
  }

  // ------------------------------------------------------------------ VFD controls
  function buildControls() {
    const card = currentCard();
    const P = state.params[card.id];
    const grid = $('#controls');
    grid.innerHTML = '';
    const pages = Math.ceil(card.params.length / PER_PAGE);
    state.page = Math.min(state.page, pages - 1);
    const list = card.params.slice(state.page * PER_PAGE, (state.page + 1) * PER_PAGE);
    // fill the display column by column, like a rack readout
    const rows = Math.ceil(list.length / 3);
    const ordered = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < 3; c++) {
      const i = c * rows + r;
      ordered.push(list[i] || null);
    }
    ordered.forEach((p) => {
      const el = document.createElement('div');
      el.className = 'ctl';
      if (!p) { grid.appendChild(el); return; }
      const label = document.createElement('div');
      label.className = 'ctl-label';
      label.textContent = p.label;
      el.appendChild(label);
      if (p.type === 'range') el.appendChild(rangeCtl(card, p, P));
      else if (p.type === 'choice') el.appendChild(choiceCtl(card, p, P));
      else el.appendChild(swatchCtl(card, p, P));
      grid.appendChild(el);
    });
    $('#pager').hidden = pages < 2;
    $('#pgText').textContent = state.page + 1 + '/' + pages;
  }

  function changed(card) {
    saveParams(card);
  }

  function rangeCtl(card, p, P) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.tabIndex = 0;
    bar.setAttribute('role', 'slider');
    bar.setAttribute('aria-label', p.label);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '16');
    const segs = [];
    for (let i = 0; i < 16; i++) { const s = document.createElement('i'); bar.appendChild(s); segs.push(s); }
    const paint = () => {
      const n = Math.round(P[p.id] * 16);
      segs.forEach((s, i) => s.classList.toggle('on', i < n));
      bar.setAttribute('aria-valuenow', String(n));
    };
    const set = (n) => {
      n = Math.max(0, Math.min(16, n));
      if (Math.round(P[p.id] * 16) === n) return;
      P[p.id] = n / 16;
      paint();
      sfx.tick();
      changed(card);
    };
    const fromEvent = (ev) => {
      const r = bar.getBoundingClientRect();
      return Math.round(((ev.clientX - r.left) / r.width) * 16 + 0.25);
    };
    bar.addEventListener('pointerdown', (ev) => {
      bar.setPointerCapture(ev.pointerId);
      set(fromEvent(ev));
      const move = (e2) => set(fromEvent(e2));
      const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
    bar.addEventListener('wheel', (ev) => { ev.preventDefault(); set(Math.round(P[p.id] * 16) + (ev.deltaY < 0 ? 1 : -1)); }, { passive: false });
    bar.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { set(Math.round(P[p.id] * 16) + 1); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { set(Math.round(P[p.id] * 16) - 1); ev.preventDefault(); }
    });
    paint();
    return bar;
  }

  function choiceCtl(card, p, P) {
    const box = document.createElement('div');
    box.className = 'choice';
    const prev = document.createElement('button');
    prev.textContent = '◀';
    prev.setAttribute('aria-label', p.label + ' previous');
    const val = document.createElement('span');
    const next = document.createElement('button');
    next.textContent = '▶';
    next.setAttribute('aria-label', p.label + ' next');
    const paint = () => { val.textContent = p.options[P[p.id]] || p.options[0]; };
    const step = (d) => {
      P[p.id] = (P[p.id] + d + p.options.length) % p.options.length;
      paint();
      sfx.click();
      if (p.id === 'tracking' || p.id === 'chars') player.restart();
      changed(card);
    };
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    box.append(prev, val, next);
    paint();
    return box;
  }

  function swatchCtl(card, p, P) {
    const box = document.createElement('div');
    box.className = 'swatches';
    p.options.forEach((col, i) => {
      const b = document.createElement('button');
      b.style.background = col;
      b.setAttribute('aria-label', p.label + ' ' + col);
      b.setAttribute('aria-pressed', String(P[p.id] === i));
      b.addEventListener('click', () => {
        P[p.id] = i;
        box.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', String(j === i)));
        sfx.click();
        changed(card);
      });
      box.appendChild(b);
    });
    return box;
  }

  $('#pgPrev').addEventListener('click', () => { const n = Math.ceil(currentCard().params.length / PER_PAGE); state.page = (state.page - 1 + n) % n; buildControls(); sfx.click(); });
  $('#pgNext').addEventListener('click', () => { const n = Math.ceil(currentCard().params.length / PER_PAGE); state.page = (state.page + 1) % n; buildControls(); sfx.click(); });

  $('#words').addEventListener('input', (ev) => {
    const card = currentCard();
    state.params[card.id].text = ev.target.value;
    changed(card);
  });

  // ------------------------------------------------------------------ switches
  function flick(sw, latch) {
    const lever = document.querySelector('[data-sw="' + sw + '"] .lever');
    sfx.lever();
    if (latch) {
      const down = !lever.classList.contains('down');
      lever.classList.toggle('down', down);
      lever.setAttribute('aria-pressed', String(down));
      return down;
    }
    lever.classList.add('down');
    setTimeout(() => lever.classList.remove('down'), 220);
    return true;
  }
  document.querySelector('[data-sw="pause"] .lever').addEventListener('click', () => {
    const down = flick('pause', true);
    player.setPaused(down);
    chip(down ? 'PAUSED' : 'LIVE');
  });
  document.querySelector('[data-sw="random"] .lever').addEventListener('click', () => {
    flick('random');
    const card = currentCard();
    const keep = state.params[card.id];
    const r = GR.catalog.random(card, Math.random);
    if (card.textInput) r.text = keep.text;
    Object.assign(keep, r);
    buildControls();
    changed(card);
  });
  document.querySelector('[data-sw="reset"] .lever').addEventListener('click', () => {
    flick('reset');
    const card = currentCard();
    const keep = state.params[card.id];
    const d = GR.catalog.defaults(card);
    if (card.textInput) d.text = keep.text;
    Object.keys(keep).forEach((k) => delete keep[k]);
    Object.assign(keep, d);
    player.restart();
    buildControls();
    changed(card);
  });

  // ------------------------------------------------------------------ sources
  document.querySelectorAll('#srcBtns .key, #srcBtnsB .key').forEach((b) => {
    b.addEventListener('click', async () => {
      sfx.click();
      const kind = b.dataset.src;
      if (kind === 'demo') { setSource('A', demoA); setSource('B', demoB); }
      else if (kind === 'file') $('#fileA').click();
      else if (kind === 'fileB') $('#fileB').click();
      else if (kind === 'cam') {
        const cam = new GR.Sources.CamSource();
        chip('CAMERA…', 'busy');
        try { await cam.ready; setSource('A', cam); chip('LIVE'); } catch (e) { chip('LIVE'); toast('Camera unavailable: ' + (e.message || e), true); }
      }
    });
  });
  async function loadFile(input, which) {
    const f = input.files && input.files[0];
    if (!f) return;
    const v = new GR.Sources.VideoSource(URL.createObjectURL(f), f.name.toUpperCase());
    chip('LOADING…', 'busy');
    try { await v.ready; setSource(which, v); chip('LIVE'); } catch (e) { chip('LIVE'); toast(e.message || String(e), true); }
    input.value = '';
  }
  $('#fileA').addEventListener('change', (ev) => loadFile(ev.target, 'A'));
  $('#fileB').addEventListener('change', (ev) => loadFile(ev.target, 'B'));

  // drop a video anywhere
  window.addEventListener('dragover', (ev) => ev.preventDefault());
  window.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!f || !/^video\//.test(f.type)) return;
    const v = new GR.Sources.VideoSource(URL.createObjectURL(f), f.name.toUpperCase());
    v.ready.then(() => setSource('A', v)).catch((e) => toast(e.message || String(e), true));
  });

  // host: preview the clip that is selected in the timeline
  if (Host.cep) {
    $('#srcBtns').hidden = true;
    $('#hostBtns').hidden = false;
    $('#applyNote').textContent = Host.app === 'ae' ? 'RENDER + ADD LAYER' : 'RENDER + PLACE ON TRACK';
    $('#grab').addEventListener('click', async () => {
      sfx.click();
      const info = await Host.call('grGetTarget', { kind: state.tab === 'transitions' ? 'transition' : 'look' });
      if (!info.ok) return toast(info.err || 'Select a clip first.', true);
      const p = info.path || (info.a && info.a.path);
      const v = new GR.Sources.VideoSource(Host.fileUrl(p), (info.name || p.split(/[\\/]/).pop()).toUpperCase());
      try {
        await v.ready;
        if (info.srcAt != null) await v.seek(info.srcAt);
        v.play();
        setSource('A', v);
        if (info.b && info.b.path) {
          const vb = new GR.Sources.VideoSource(Host.fileUrl(info.b.path), info.b.path.split(/[\\/]/).pop().toUpperCase());
          await vb.ready;
          setSource('B', vb);
        }
      } catch (e) { toast('Preview cannot decode this clip, APPLY will still work through host frames.', true); }
    });
  } else {
    $('#applyNote').textContent = 'RECORD TO VIDEO FILE';
  }

  // ------------------------------------------------------------------ APPLY
  const applyBtn = $('#apply');
  applyBtn.addEventListener('click', async () => {
    if (state.busy) return;
    const card = currentCard();
    const P = JSON.parse(JSON.stringify(state.params[card.id]));
    state.busy = true;
    applyBtn.classList.add('busy');
    sfx.apply();
    const ui = { progress: (f) => chip((Host.cep ? 'RENDERING ' : 'RECORDING ') + Math.round(f * 100) + '%', 'busy') };
    ui.progress(0);
    try {
      if (Host.cep) {
        player.hold = true;
        const r = await Host.applyInHost(card, P, ui);
        toast(card.name + ' applied · ' + r.frames + ' frames');
      } else {
        const r = await Host.recordInBrowser(player, card, P, ui);
        toast('Saved ' + r.file + ' (' + r.seconds.toFixed(1) + ' s)');
      }
      sfx.done();
      chip('LIVE');
    } catch (e) {
      console.error(e);
      chip('ERROR', 'err');
      toast(e.message || String(e), true);
    } finally {
      player.hold = false;
      state.busy = false;
      applyBtn.classList.remove('busy');
    }
  });

  // ------------------------------------------------------------------ keys
  window.addEventListener('keydown', (ev) => {
    if (ev.target && ev.target.tagName === 'INPUT') return;
    if (ev.code === 'Space') { ev.preventDefault(); document.querySelector('[data-sw="pause"] .lever').click(); }
    if (ev.key === 'r' || ev.key === 'R') document.querySelector('[data-sw="random"] .lever').click();
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (ev.target && ev.target.classList && ev.target.classList.contains('bar')) return;
      ev.preventDefault();
      const list = GR.catalog.cards.filter((c) => c.tab === state.tab);
      const i = list.findIndex((c) => c.id === currentCard().id);
      const n = list[(i + (ev.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
      select(n.id);
      sfx.click();
    }
  });

  const mute = $('#mute');
  const paintMute = () => { mute.textContent = sfx.on ? 'SND ON' : 'SND OFF'; };
  mute.addEventListener('click', () => { sfx.toggle(); paintMute(); });
  paintMute();

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  // ------------------------------------------------------------------ boot
  if (!['looks', 'transitions', 'titles'].includes(state.tab)) state.tab = 'looks';
  setTab(state.tab, true);
  GR.Glyphs.ready().then(() => {
    GR.Glyphs.clear();
    GR.fontEpoch = (GR.fontEpoch || 0) + 1;
    thumbsReady = true;
    pumpThumbs();
  });
  GR.ui = { select, setTab, state, player, toast };
})();
