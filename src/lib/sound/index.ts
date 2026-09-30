/**
 * Gestor de som — efeitos sonoros sintetizados via Web Audio API.
 * Sem assets externos; todos os sons são gerados proceduralmente.
 * Espec §28: seleção, movimento, erro, ameaça, vitória, empate, início.
 */

import { useEffect } from 'react';
import { useSettings } from '@/store/settings';

export type SoundEvent =
  | 'select'
  | 'move'
  | 'error'
  | 'threat'
  | 'win'
  | 'draw'
  | 'start'
  | 'click'
  | 'bonus'
  | 'achievement';

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export function isSoundEnabled() {
  return enabled;
}

/**
 * Lê o estado do som diretamente do localStorage (compatível com uso fora do React).
 * fallback para a flag em memória.
 */
function isSoundOn(): boolean {
  if (typeof window === 'undefined') return enabled;
  try {
    const raw = localStorage.getItem('tira-coco-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const val = parsed?.state?.soundEnabled;
      if (typeof val === 'boolean') return val;
    }
  } catch {
    // ignore
  }
  return enabled;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  delay = 0,
) {
  const c = getCtx();
  if (!c || !enabled) return;
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(volume * 0.7, now + duration * 0.3);
  gain.gain.setValueAtTime(volume * 0.7, now + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playSequence(
  notes: { freq: number; dur: number; type?: OscillatorType; vol?: number }[],
  gap = 0.05,
) {
  let t = 0;
  for (const n of notes) {
    playTone(n.freq, n.dur, n.type ?? 'sine', n.vol ?? 0.15, t);
    t += n.dur + gap;
  }
}

function playNoise(duration: number, volume = 0.1) {
  const c = getCtx();
  if (!c || !enabled) return;
  const now = c.currentTime;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  noise.start(now);
  noise.stop(now + duration);
}

export function playSound(event: SoundEvent) {
  if (!isSoundOn()) return;
  switch (event) {
    case 'select':
      playTone(880, 0.08, 'sine', 0.12);
      playTone(1320, 0.06, 'sine', 0.08, 0.02);
      break;
    case 'move':
      playTone(523, 0.1, 'triangle', 0.14);
      playTone(392, 0.12, 'triangle', 0.1, 0.05);
      break;
    case 'error':
      playNoise(0.15, 0.08);
      playTone(196, 0.15, 'sawtooth', 0.1);
      break;
    case 'threat':
      playTone(330, 0.12, 'sawtooth', 0.1);
      playTone(247, 0.18, 'sawtooth', 0.08, 0.05);
      break;
    case 'win':
      playSequence([
        { freq: 523, dur: 0.12, type: 'triangle', vol: 0.16 },
        { freq: 659, dur: 0.12, type: 'triangle', vol: 0.16 },
        { freq: 784, dur: 0.12, type: 'triangle', vol: 0.16 },
        { freq: 1047, dur: 0.3, type: 'triangle', vol: 0.18 },
      ], 0.04);
      break;
    case 'draw':
      playTone(440, 0.15, 'sine', 0.14);
      playTone(440, 0.15, 'sine', 0.14, 0.2);
      break;
    case 'start':
      playSequence([
        { freq: 392, dur: 0.1, type: 'sine', vol: 0.14 },
        { freq: 523, dur: 0.1, type: 'sine', vol: 0.14 },
        { freq: 659, dur: 0.15, type: 'sine', vol: 0.16 },
      ], 0.03);
      break;
    case 'click':
      playTone(660, 0.04, 'square', 0.06);
      break;
    case 'bonus':
      playTone(1318, 0.08, 'square', 0.1);
      playTone(1760, 0.12, 'square', 0.08, 0.05);
      break;
    case 'achievement':
      playSequence([
        { freq: 659, dur: 0.1, type: 'triangle', vol: 0.14 },
        { freq: 784, dur: 0.1, type: 'triangle', vol: 0.14 },
        { freq: 988, dur: 0.1, type: 'triangle', vol: 0.14 },
        { freq: 1318, dur: 0.25, type: 'triangle', vol: 0.16 },
      ], 0.05);
      break;
  }
}

export function useSound() {
  const soundEnabled = useSettings((s) => s.soundEnabled);
  useEffect(() => {
    setSoundEnabled(soundEnabled);
  }, [soundEnabled]);
  return { play: playSound };
}
