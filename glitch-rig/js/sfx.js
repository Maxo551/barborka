// Tiny synthesized UI sounds (no audio files): key clicks, lever snaps and the
// APPLY thunk. Created on the first gesture so autoplay rules are respected.
(function () {
  'use strict';
  const GR = window.GR;
  let ac = null;
  let on = true;
  try { on = localStorage.getItem('glitchrig.sound') !== 'off'; } catch (e) { /* storage blocked */ }

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function burst(freq, dur, gain, type) {
    if (!on) return;
    const a = ctx();
    if (!a) return;
    const t = a.currentTime;
    const len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 2;
    const g = a.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }

  function tone(freq, dur, gain) {
    if (!on) return;
    const a = ctx();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur);
  }

  GR.sfx = {
    click() { burst(3200, 0.03, 0.25); },
    tick() { burst(5200, 0.015, 0.12); },
    lever() { burst(1800, 0.04, 0.4); setTimeout(() => burst(900, 0.05, 0.35), 45); },
    apply() { tone(110, 0.25, 0.5); burst(400, 0.12, 0.5, 'lowpass'); },
    done() { tone(880, 0.12, 0.15); setTimeout(() => tone(1320, 0.18, 0.15), 110); },
    get on() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem('glitchrig.sound', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
      return on;
    },
  };
})();
