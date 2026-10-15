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
  | 'achievement'
  | 'achievementRare'
  | 'countdown'
  | 'streak';

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
    case 'achievementRare':
      // Fanfarra maior para conquistas raras (beat_perfect, streak_5)
      playSequence([
        { freq: 523, dur: 0.08, type: 'triangle', vol: 0.14 },
        { freq: 659, dur: 0.08, type: 'triangle', vol: 0.14 },
        { freq: 784, dur: 0.08, type: 'triangle', vol: 0.14 },
        { freq: 1047, dur: 0.08, type: 'triangle', vol: 0.14 },
        { freq: 1318, dur: 0.12, type: 'triangle', vol: 0.16 },
        { freq: 1568, dur: 0.4, type: 'triangle', vol: 0.18 },
      ], 0.03);
      break;
    case 'countdown':
      // Tick-tack para últimos segundos do relógio
      playTone(880, 0.05, 'square', 0.08);
      break;
    case 'streak':
      // Ascendente para sequência de vitórias
      playSequence([
        { freq: 523, dur: 0.1, type: 'sine', vol: 0.14 },
        { freq: 659, dur: 0.1, type: 'sine', vol: 0.14 },
        { freq: 784, dur: 0.15, type: 'sine', vol: 0.16 },
        { freq: 1047, dur: 0.2, type: 'sine', vol: 0.18 },
      ], 0.04);
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

// ============ MÚSICA DE FUNDO ADAPTATIVA ============
// Loop sintetizado, discreto, inspirado em sons angolanos contemporâneos.
// Máquina de estados dirigida por setMusicState(state): andamento (cadência/BPM),
// densidade rítmica, registo e volume mudam com a presença do jogador e a partida.
// Estados: absent (calmo), idle (neutro), match (focado), move (acento curto),
//          win (triunfante), loss (sombrio).

let musicGain: GainNode | null = null;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let moveReturnTimer: ReturnType<typeof setTimeout> | null = null;
let musicRunning = false;
let musicEnabled = false;
let musicStep = 0;

/** Estados musicais adaptativos (dirigidos por setMusicState). */
export type MusicState = 'absent' | 'idle' | 'match' | 'move' | 'win' | 'loss';

/** Estados contextuais (persistentes); 'move' é sempre transitório. */
type BaseMusicState = Exclude<MusicState, 'move'>;

/**
 * Progressões de acordes por estado musical.
 * - 'calm': Am-F-C-G (relaxante, menu)
 * - 'tension': Am-G-Em-F (menos resolução, durante partida)
 * - 'victory': C-G-Am-F (resolutiva, mais animada)
 * - 'loss': Dm-Am-Bb-A (menor, sombria)
 */
const CHORDS_CALM: number[][] = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
];
const CHORDS_TENSION: number[][] = [
  [220.0, 261.63, 329.63], // Am
  [196.0, 246.94, 293.66], // G
  [164.81, 196.0, 246.94], // Em
  [174.61, 220.0, 261.63], // F
];
const CHORDS_VICTORY: number[][] = [
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
];
const CHORDS_LOSS: number[][] = [
  [146.83, 174.61, 220.0], // Dm
  [220.0, 261.63, 329.63], // Am
  [233.08, 293.66, 349.23], // Bb
  [220.0, 277.18, 329.63], // A
];

interface MusicParams {
  /** Cadência entre acordes em ms (andamento: menor valor = mais rápido/focado). */
  chordMs: number;
  padVol: number;
  arpVol: number;
  /** Nº de notas do arpejo por acorde (densidade rítmica). */
  arpCount: number;
  /** Registo do arpejo: 2 = oitava acima, 1 = base, 0.5 = oitava abaixo. */
  arpMul: number;
  masterVol: number;
  chords: number[][];
}

const MUSIC_PARAMS: Record<BaseMusicState, MusicParams> = {
  absent: { chordMs: 6000, padVol: 0.016, arpVol: 0.007, arpCount: 2, arpMul: 1, masterVol: 0.3, chords: CHORDS_CALM },
  idle: { chordMs: 4000, padVol: 0.03, arpVol: 0.015, arpCount: 4, arpMul: 2, masterVol: 0.5, chords: CHORDS_CALM },
  match: { chordMs: 2600, padVol: 0.038, arpVol: 0.022, arpCount: 6, arpMul: 2, masterVol: 0.62, chords: CHORDS_TENSION },
  win: { chordMs: 2000, padVol: 0.05, arpVol: 0.03, arpCount: 8, arpMul: 2, masterVol: 0.75, chords: CHORDS_VICTORY },
  loss: { chordMs: 5000, padVol: 0.028, arpVol: 0.01, arpCount: 2, arpMul: 0.5, masterVol: 0.4, chords: CHORDS_LOSS },
};

/** Último estado contextual persistente (o que se volta ao sair de 'absent'/'move'). */
let contextState: BaseMusicState = 'idle';
/** Estado corrente da máquina (pode ser 'move', transitório, ou 'absent'). */
let currentMusicState: MusicState = 'idle';

function paramsFor(state: MusicState): MusicParams {
  return MUSIC_PARAMS[state === 'move' ? contextState : state];
}

/** Devolve o estado musical corrente (útil para wiring/depuração). */
export function getMusicState(): MusicState {
  return currentMusicState;
}

function isMusicOn(): boolean {
  if (typeof window === 'undefined') return musicEnabled;
  try {
    const raw = localStorage.getItem('tira-coco-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const val = parsed?.state?.musicEnabled;
      if (typeof val === 'boolean') return val;
    }
  } catch {
    // ignore
  }
  return musicEnabled;
}

function playChordPad(freqs: number[], duration: number, volume: number) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  for (const freq of freqs) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.5);
    g.gain.linearRampToValueAtTime(volume * 0.7, now + duration * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(musicGain ?? c.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
}

function playArpeggioNote(freq: number, time: number, volume: number, mul: number) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime + time;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq * mul;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(volume, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  osc.connect(g);
  g.connect(musicGain ?? c.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

function effectiveMusicState(): MusicState {
  return currentMusicState === 'move' ? contextState : currentMusicState;
}

function stepMusic() {
  if (!isMusicOn()) return;
  const c = getCtx();
  if (!c || !musicGain) return;
  const p = paramsFor(effectiveMusicState());
  const chord = p.chords[musicStep % p.chords.length];
  playChordPad(chord, p.chordMs / 1000 + 0.8, p.padVol);
  const stepGap = p.chordMs / 1000 / p.arpCount;
  for (let i = 0; i < p.arpCount; i++) {
    playArpeggioNote(chord[i % chord.length], i * stepGap, p.arpVol, p.arpMul);
  }
  musicStep++;
}

function scheduleNextStep(delayMs: number) {
  if (musicTimer) clearTimeout(musicTimer);
  if (!musicRunning) return;
  musicTimer = setTimeout(() => {
    stepMusic();
    scheduleNextStep(paramsFor(effectiveMusicState()).chordMs);
  }, delayMs);
}

function rampMaster(target: number, seconds: number) {
  const c = getCtx();
  if (!c || !musicGain) return;
  const now = c.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(target, now + seconds);
}

function playStingNote(freq: number, time: number, dur: number) {
  const c = getCtx();
  if (!c || !musicGain) return;
  const now = c.currentTime + time;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(0.06, now + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(now);
  osc.stop(now + dur);
}

/**
 * Acento de movimento: duck da música + stinger curto; regressa ao contexto em 600ms.
 */
function triggerMoveAccent() {
  const c = getCtx();
  if (!c) return;
  const baseVol = paramsFor(contextState).masterVol;
  if (musicGain) {
    const now = c.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(baseVol * 0.35, now + 0.06);
    musicGain.gain.linearRampToValueAtTime(baseVol, now + 0.55);
  }
  playStingNote(659.25, 0, 0.12);
  playStingNote(880, 0.09, 0.14);
  playStingNote(1174.66, 0.18, 0.22);
  currentMusicState = 'move';
  if (moveReturnTimer) clearTimeout(moveReturnTimer);
  moveReturnTimer = setTimeout(() => {
    moveReturnTimer = null;
    if (currentMusicState === 'move') {
      currentMusicState = contextState;
      rampMaster(paramsFor(contextState).masterVol, 0.4);
    }
  }, 600);
}

/**
 * Dirige a máquina de estados da música.
 * - 'absent': jogador ausente (aba escondida / inatividade) — o mais calmo
 * - 'idle': presente no site sem jogar — neutro
 * - 'match': em partida — focado (andamento e densidade subidos)
 * - 'move': acento transitório (duck + stinger), regressa ao estado contextual
 * - 'win' / 'loss': triunfante / sombrio
 * Transições usam rampas no master gain (crossfade ~0.4-0.9s), sem cortes secos.
 */
export function setMusicState(state: MusicState) {
  if (state === 'move') {
    triggerMoveAccent();
    return;
  }
  if (moveReturnTimer) {
    clearTimeout(moveReturnTimer);
    moveReturnTimer = null;
  }
  if (state === 'absent') {
    currentMusicState = 'absent';
    rampMaster(MUSIC_PARAMS.absent.masterVol, 1.2);
    if (musicRunning) scheduleNextStep(MUSIC_PARAMS.absent.chordMs * 0.25);
    return;
  }
  const prev = contextState;
  contextState = state;
  currentMusicState = state;
  const p = paramsFor(state);
  rampMaster(p.masterVol, 0.9);
  if (musicRunning && prev !== state) {
    scheduleNextStep(p.chordMs * 0.25);
  }
}

/**
 * Regressa da presença 'absent' ao estado contextual anterior (ex.: 'match'),
 * sem o cegar com 'idle' quando uma partida continua.
 */
export function resumeMusicPresence() {
  if (currentMusicState !== 'absent') return;
  setMusicState(contextState);
}

export function startMusic() {
  if (!isMusicOn()) return;
  const c = getCtx();
  if (!c) return;
  if (musicRunning) return;
  musicGain = c.createGain();
  const target = paramsFor(effectiveMusicState()).masterVol;
  musicGain.gain.setValueAtTime(0.0001, c.currentTime);
  musicGain.gain.linearRampToValueAtTime(target, c.currentTime + 1.2);
  musicGain.connect(c.destination);
  musicStep = 0;
  musicRunning = true;
  stepMusic();
  scheduleNextStep(paramsFor(effectiveMusicState()).chordMs);
  musicEnabled = true;
}

export function stopMusic() {
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
  if (moveReturnTimer) {
    clearTimeout(moveReturnTimer);
    moveReturnTimer = null;
  }
  if (musicGain) {
    try {
      musicGain.disconnect();
    } catch {
      // ignore
    }
    musicGain = null;
  }
  musicRunning = false;
  musicEnabled = false;
}

export function setMusicEnabled(v: boolean) {
  musicEnabled = v;
  if (v) startMusic();
  else stopMusic();
}

/**
 * Hook para sincronizar a música com as settings.
 * Deve ser usado num componente de topo (ex.: AppShell).
 */
export function useMusicSync() {
  const musicOn = useSettings((s) => s.musicEnabled);
  const soundOn = useSettings((s) => s.soundEnabled);
  useEffect(() => {
    if (musicOn && soundOn) {
      startMusic();
    } else {
      stopMusic();
    }
  }, [musicOn, soundOn]);
}

