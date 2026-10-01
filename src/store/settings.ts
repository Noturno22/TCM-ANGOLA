/**
 * Store de definições (settings) — persistida em localStorage.
 * Spec §27 (acessibilidade), §8.3 (design system).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

export interface Settings {
  theme: ThemeMode;
  soundEnabled: boolean;
  musicEnabled: boolean;
  symbolsOnPieces: boolean; // ▲ no P1, ● no P2 (spec §27)
  reduceMotion: boolean;
  colorblindMode: boolean;
  vibration: boolean;
  language: 'pt' | 'en';
  aiThinkingDelay: number; // ms (400-900, spec §6)
}

interface SettingsStore extends Settings {
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

const DEFAULTS: Settings = {
  theme: 'light',
  soundEnabled: true,
  musicEnabled: false,
  symbolsOnPieces: true,
  reduceMotion: false,
  colorblindMode: false,
  vibration: true,
  language: 'pt',
  aiThinkingDelay: 650,
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'tira-coco-settings',
    },
  ),
);
