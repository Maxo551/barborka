// Runs the Resolve DCTL kernels on the CPU (C++ build of the exact kernel
// source) so their output can be checked against the panel without Resolve.
// Usage from other scripts: harness.run({ w, h, inputs: {src: 'file.rgba'}, steps, out })
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { K, GLYPH_FNS } = require('../src/kernels');

const PRELUDE = fs.readFileSync(path.join(__dirname, '../src/prelude.dctl'), 'utf8');

function source(steps) {
  const used = [...new Set(steps.map((s) => s.kernel))];
  let cpp = '#include "dctl_cpu.h"\n' + PRELUDE + '\n' + GLYPH_FNS + '\n';
  for (const name of Object.keys(K)) {
    cpp += `struct ${name}Params {\n${K[name].params}\n};\n${K[name].code}\n`;
  }
  return { cpp, used };
}

function lit(v) {
  return typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(6) + 'f') : String(v);
}

// steps: [{ kernel, inputs: [names], out: name, params: {...} }]
function run(job) {
  const { w, h } = job;
  const { cpp } = source(job.steps);
  const ins = Object.keys(job.inputs);
  let main = '\nint main(int argc, char** argv) {\n  (void)argc;\n';
  ins.forEach((name, i) => { main += `  Tex ${name} = loadRaw(argv[${i + 1}], ${w}, ${h});\n`; });
  const declared = new Set(ins);
  job.steps.forEach((s, si) => {
    if (!declared.has(s.out)) { main += `  Tex ${s.out} = newTex(${s.w || w}, ${s.h || h});\n`; declared.add(s.out); }
    main += `  { ${s.kernel}Params p; memset(&p, 0, sizeof p);\n`;
    const P = Object.assign({ width: s.w || w, height: s.h || h, compOrder: 15, scale: h / 540 }, s.params);
    for (const [k, v] of Object.entries(P)) {
      if (Array.isArray(v)) v.forEach((x, i) => { main += `    p.${k}[${i}] = ${lit(x)};\n`; });
      else main += `    p.${k} = ${lit(v)};\n`;
    }
    const args = ['&p'].concat(s.inputs.map((n) => '&' + n)).concat(['&' + s.out]).join(', ');
    main += `    runAll(${s.w || w}, ${s.h || h}, [&] { ${s.kernel}(${args}); }); }\n`;
    void si;
  });
  main += `  saveRaw(argv[${ins.length + 1}], ${job.out});\n  return 0;\n}\n`;
  const dir = job.workdir;
  fs.mkdirSync(dir, { recursive: true });
  const cppPath = path.join(dir, 'run.cpp');
  fs.writeFileSync(cppPath, cpp + main);
  const exe = path.join(dir, 'run');
  execFileSync('g++', ['-O2', '-std=c++17', '-Wall', '-Wno-unused-function', '-Wno-unused-variable', '-I', __dirname, cppPath, '-o', exe], { stdio: 'inherit' });
  execFileSync(exe, ins.map((n) => job.inputs[n]).concat([job.outFile]), { stdio: 'inherit' });
}

// The finishing chain every look ends with (same order as the panel's Post).
function finish(src, o, out) {
  const s = (o.h || 540) / 540;
  const steps = [];
  const glow = (o.glow || 0) > 0.001 || (o.streaks || 0) > 0.001;
  if (glow) {
    steps.push({ kernel: 'GRExtract', inputs: [src], out: 'fx_ex', params: { thresh: o.thresh == null ? 0.55 : o.thresh } });
    steps.push({ kernel: 'GRBlur', inputs: ['fx_ex'], out: 'fx_a', params: { dx: 4 * s, dy: 0 } });
    steps.push({ kernel: 'GRBlur', inputs: ['fx_a'], out: 'fx_b', params: { dx: 0, dy: 4 * s } });
    steps.push({ kernel: 'GRBlur', inputs: ['fx_b'], out: 'fx_a', params: { dx: 8 * s, dy: 0 } });
    steps.push({ kernel: 'GRBlur', inputs: ['fx_a'], out: 'fx_b', params: { dx: 0, dy: 8 * s } });
    steps.push({ kernel: 'GRStreak', inputs: ['fx_ex'], out: 'fx_s', params: { stepPx: 4 * s } });
    steps.push({ kernel: 'GRStreak', inputs: ['fx_s'], out: 'fx_t', params: { stepPx: 16 * s } });
    steps.push({ kernel: 'GRStreak', inputs: ['fx_t'], out: 'fx_s', params: { stepPx: 56 * s } });
    steps.push({ kernel: 'GRStreak', inputs: ['fx_s'], out: 'fx_t', params: { stepPx: 160 * s } });
  }
  steps.push({
    kernel: 'GRComposite', inputs: [src, glow ? 'fx_b' : src, glow ? 'fx_t' : src], out,
    params: {
      iTime: o.iTime || 0, glow: o.glow || 0, streaks: o.streaks || 0, rgb: o.rgb || 0, scanlines: o.scanlines || 0,
      scanline: o.scanline || 0, grain: o.grain || 0, vignette: o.vignette || 0, flicker: o.flicker || 0,
      bright: o.bright == null ? 1 : o.bright, contrast: o.contrast == null ? 1 : o.contrast,
      satur: o.satur == null ? 1 : o.satur, hue: o.hue || 0, streakTint: o.streakTint || [0.75, 0.9, 1], useGlow: glow ? 1 : 0,
    },
  });
  return steps;
}

module.exports = { run, finish, source };
