/**
 * Store de progressão — desbloqueio progressivo de dificuldades.
 * O jogador precisa de vencer N vezes uma dificuldade para desbloquear a seguinte.
 *
 * Fácil: sempre desbloqueada
 * Médio: desbloqueada após 2 vitórias no Fácil
 * Difícil: desbloqueada após 3 vitórias no Médio
 * Perfeito: desbloqueada após 5 vitórias no Difícil
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Difficulty } from '@/lib/ai';

interface ProgressionStore {
  /** Vitórias por dificuldade (apenas PvE humano) */
  winsByDifficulty: Record<Difficulty, number>;
  /** Dificuldades desbloqueadas */
  unlocked: Record<Difficulty, boolean>;

  recordWin: (difficulty: Difficulty) => void;
  isUnlocked: (difficulty: Difficulty) => boolean;
  reset: () => void;
}

const UNLOCK_THRESHOLDS: Partial<Record<Difficulty, { difficulty: Difficulty; wins: number }>> = {
  medium: { difficulty: 'easy', wins: 2 },
  hard: { difficulty: 'medium', wins: 3 },
  perfect: { difficulty: 'hard', wins: 5 },
};

export const useProgression = create<ProgressionStore>()(
  persist(
    (set, get) => ({
      winsByDifficulty: { easy: 0, medium: 0, hard: 0, perfect: 0 },
      unlocked: { easy: true, medium: false, hard: false, perfect: false },

      recordWin: (difficulty) => {
        const newWins = {
          ...get().winsByDifficulty,
          [difficulty]: get().winsByDifficulty[difficulty] + 1,
        };
        const newUnlocked = { ...get().unlocked };
        // Verificar se desbloqueia a próxima dificuldade
        for (const [nextDiff, req] of Object.entries(UNLOCK_THRESHOLDS)) {
          if (!newUnlocked[nextDiff as Difficulty]) {
            if (newWins[req.difficulty] >= req.wins) {
              newUnlocked[nextDiff as Difficulty] = true;
            }
          }
        }
        set({ winsByDifficulty: newWins, unlocked: newUnlocked });
      },

      isUnlocked: (difficulty) => get().unlocked[difficulty],

      reset: () =>
        set({
          winsByDifficulty: { easy: 0, medium: 0, hard: 0, perfect: 0 },
          unlocked: { easy: true, medium: false, hard: false, perfect: false },
        }),
    }),
    { name: 'tira-coco-progression' },
  ),
);

/**
 * Devolve o requisito para desbloquear uma dificuldade (ou null se sempre desbloqueada).
 */
export function getUnlockRequirement(difficulty: Difficulty): { difficulty: Difficulty; wins: number } | null {
  return UNLOCK_THRESHOLDS[difficulty] ?? null;
}

/**
 * Texto descritivo do requisito de desbloqueio.
 */
export function getUnlockText(difficulty: Difficulty): string {
  const req = getUnlockRequirement(difficulty);
  if (!req) return 'Sempre disponível';
  const diffLabel = req.difficulty === 'easy' ? 'Fácil' : req.difficulty === 'medium' ? 'Médio' : req.difficulty === 'hard' ? 'Difícil' : 'Perfeito';
  return `Vence ${req.wins}x no ${diffLabel}`;
}
