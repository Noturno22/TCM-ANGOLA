import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'assets', 'sounds');
const RATE = 22050;
const MASTER = 0.8;

const T = (freq, dur, type = 'sine', vol = 0.1, delay = 0) => ({ freq, dur, type, vol, delay, noise: false });
const N = (dur, vol = 0.035, delay = 0) => ({ freq: 0, dur, type: 'noise', vol, delay, noise: true });

const seq = (notes, gap) => {
  let t = 0;
  return notes.map((n) => {
    const out = { ...n, delay: t + (n.delay ?? 0) };
    t += n.dur + gap;
    return out;
  });
};

const SOUNDS = {
  select: [T(660, 0.1, 'sine', 0.1), T(880, 0.08, 'sine', 0.06, 0.03)],
  move: [T(392, 0.14, 'sine', 0.1), T(294, 0.16, 'sine', 0.07, 0.06)],
  error: [N(0.18, 0.035), T(175, 0.2, 'sine', 0.08)],
  threat: [T(294, 0.16, 'sine', 0.08), T(220, 0.22, 'sine', 0.06, 0.06)],
  win: seq([
    T(392, 0.14, 'sine', 0.1), T(494, 0.14, 'sine', 0.1),
    T(587, 0.14, 'sine', 0.1), T(784, 0.34, 'triangle', 0.11),
  ], 0.05),
  draw: [T(330, 0.18, 'sine', 0.09), T(330, 0.18, 'sine', 0.08, 0.22)],
  start: seq([
    T(294, 0.12, 'sine', 0.09), T(392, 0.12, 'sine', 0.09), T(494, 0.18, 'sine', 0.1),
  ], 0.04),
  click: [T(494, 0.06, 'sine', 0.045)],
  bonus: [T(880, 0.1, 'sine', 0.07), T(1174, 0.14, 'sine', 0.055, 0.06)],
  achievement: seq([
    T(494, 0.12, 'sine', 0.09), T(587, 0.12, 'sine', 0.09),
    T(698, 0.12, 'sine', 0.09), T(880, 0.28, 'triangle', 0.1),
  ], 0.06),
  achievementRare: seq([
    T(392, 0.1, 'sine', 0.08), T(494, 0.1, 'sine', 0.08),
    T(587, 0.1, 'sine', 0.08), T(698, 0.1, 'sine', 0.08),
    T(880, 0.14, 'sine', 0.09), T(1047, 0.42, 'triangle', 0.1),
  ], 0.04),
  countdown: [T(660, 0.07, 'sine', 0.05)],
  streak: seq([
    T(392, 0.12, 'sine', 0.09), T(494, 0.12, 'sine', 0.09),
    T(587, 0.16, 'sine', 0.09), T(784, 0.24, 'triangle', 0.1),
  ], 0.05),
  coco: [
    T(523, 0.12, 'sine', 0.08), T(659, 0.12, 'sine', 0.08, 0.16),
    T(523, 0.12, 'sine', 0.08, 0.32), T(784, 0.3, 'triangle', 0.1, 0.48),
  ],
};

function oscillator(type, phase) {
  const p = phase - Math.floor(phase);
  if (type === 'triangle') return 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25));
  return Math.sin(2 * Math.PI * p);
}

function envelope(t, dur, vol) {
  if (t < 0 || t > dur) return 0;
  const attack = Math.min(0.03, dur * 0.3);
  const release = Math.min(0.12, dur * 0.5);
  let edge = 1;
  if (t < attack) edge = 0.5 - 0.5 * Math.cos((Math.PI * t) / attack);
  else if (t > dur - release) edge = 0.5 - 0.5 * (Math.cos((Math.PI * (dur - t)) / release));
  const decay = 0.85 + 0.15 * (1 - t / dur);
  return vol * edge * decay;
}

function lowpass(samples, alpha) {
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    y += alpha * (samples[i] - y);
    samples[i] = y;
  }
}

let seed = 0x1a2b3c4d;
function noise() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
}

function render(notes) {
  const end = Math.max(...notes.map((n) => n.delay + n.dur)) + 0.04;
  const total = Math.ceil(end * RATE);
  const out = new Float32Array(total);
  let lp = 0;
  for (const n of notes) {
    const start = Math.round(n.delay * RATE);
    const len = Math.round(n.dur * RATE);
    for (let i = 0; i < len && start + i < total; i++) {
      const t = i / RATE;
      let v;
      if (n.noise) {
        lp += 0.08 * (noise() - lp);
        v = lp * (1 - i / len);
      } else {
        v = oscillator(n.type, n.freq * t);
      }
      out[start + i] += v * envelope(t, n.dur, n.vol);
    }
  }
  lowpass(out, 0.28);
  lowpass(out, 0.28);
  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
  if (peak > 0.9) {
    const k = 0.9 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= k;
  }
  for (let i = 0; i < out.length; i++) out[i] *= MASTER;
  return out;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, notes] of Object.entries(SOUNDS)) {
  writeFileSync(join(OUT, `${name}.wav`), wav(render(notes)));
}
console.log(`Generated ${Object.keys(SOUNDS).length} sounds in ${OUT}`);
