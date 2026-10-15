/**
 * Store de definições (settings) — persistida em localStorage.
 * Spec §27 (acessibilidade), §8.3 (design system).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  FREE_BACKGROUND_ID,
  FREE_LINE_STYLE_ID,
  FREE_PIECE_STYLE_ID,
} from '@/lib/cosmetics';

export type CosmeticKind = 'background' | 'line' | 'piece';

export interface Settings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  symbolsOnPieces: boolean; // triângulo no P1, círculo no P2 (spec §27)
  reduceMotion: boolean;
  colorblindMode: boolean;
  vibration: boolean;
  language: 'pt' | 'en' | 'fr';
  aiThinkingDelay: number; // ms (400-900, spec §6)
  backgroundId: string;
  lineStyleId: string;
  pieceStyleId: string;
  ownedCosmetics: string[];
  theme: 'light' | 'dark';
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
  ownCosmetic: (id: string) => void;
  equipCosmetic: (kind: CosmeticKind, id: string) => void;
}

const DEFAULTS: Settings = {
  soundEnabled: true,
  musicEnabled: false,
  symbolsOnPieces: true,
  reduceMotion: false,
  colorblindMode: false,
  vibration: true,
  language: 'pt',
  aiThinkingDelay: 650,
  backgroundId: FREE_BACKGROUND_ID,
  lineStyleId: FREE_LINE_STYLE_ID,
  pieceStyleId: FREE_PIECE_STYLE_ID,
  ownedCosmetics: [FREE_BACKGROUND_ID, FREE_LINE_STYLE_ID, FREE_PIECE_STYLE_ID],
  theme: 'dark',
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set({ ...DEFAULTS }),
      ownCosmetic: (id) =>
        set((s) =>
          s.ownedCosmetics.includes(id) ? s : { ownedCosmetics: [...s.ownedCosmetics, id] },
        ),
      equipCosmetic: (kind, id) =>
        set(
          kind === 'background'
            ? { backgroundId: id }
            : kind === 'line'
              ? { lineStyleId: id }
              : { pieceStyleId: id },
        ),
    }),
    {
      name: 'tira-coco-settings',
    },
  ),
);
