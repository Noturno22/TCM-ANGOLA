import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
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
  | 'streak'
  | 'coco';

const SOURCES: Record<SoundEvent, number> = {
  select: require('@/assets/sounds/select.wav'),
  move: require('@/assets/sounds/move.wav'),
  error: require('@/assets/sounds/error.wav'),
  threat: require('@/assets/sounds/threat.wav'),
  win: require('@/assets/sounds/win.wav'),
  draw: require('@/assets/sounds/draw.wav'),
  start: require('@/assets/sounds/start.wav'),
  click: require('@/assets/sounds/click.wav'),
  bonus: require('@/assets/sounds/bonus.wav'),
  achievement: require('@/assets/sounds/achievement.wav'),
  achievementRare: require('@/assets/sounds/achievementRare.wav'),
  countdown: require('@/assets/sounds/countdown.wav'),
  streak: require('@/assets/sounds/streak.wav'),
  coco: require('@/assets/sounds/coco.wav'),
};

const players = new Map<SoundEvent, AudioPlayer>();
let configured = false;

function configure(): void {
  if (configured) return;
  configured = true;
  void setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
  }).catch(() => undefined);
}

export function playSound(event: SoundEvent): void {
  if (!useSettings.getState().soundEnabled) return;
  try {
    configure();
    let player = players.get(event);
    if (!player) {
      player = createAudioPlayer(SOURCES[event]);
      player.volume = 0.85;
      players.set(event, player);
    }
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    return;
  }
}

export function releaseSounds(): void {
  players.forEach((player) => player.release());
  players.clear();
  configured = false;
}
