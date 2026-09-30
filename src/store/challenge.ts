/**
 * Store de desafios (puzzles) — persistida em localStorage.
 * Regista quais puzzles já foram resolvidos.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TOTAL_PUZZLES } from '@/lib/puzzles';

interface ChallengeStore {
  /** IDs dos puzzles resolvidos */
  solved: string[];
  /** Data do último puzzle resolvido (ISO) */
  lastSolvedAt: string | null;
  /** Número de tentativas totais */
  totalAttempts: number;
  /** Número de acertos totais */
  totalSolved: number;

  markSolved: (id: string) => void;
  recordAttempt: () => void;
  isSolved: (id: string) => boolean;
  reset: () => void;
}

export const useChallenge = create<ChallengeStore>()(
  persist(
    (set, get) => ({
      solved: [],
      lastSolvedAt: null,
      totalAttempts: 0,
      totalSolved: 0,

      markSolved: (id) =>
        set((s) => ({
          solved: s.solved.includes(id) ? s.solved : [...s.solved, id],
          lastSolvedAt: new Date().toISOString(),
          totalSolved: s.totalSolved + (s.solved.includes(id) ? 0 : 1),
        })),

      recordAttempt: () =>
        set((s) => ({ totalAttempts: s.totalAttempts + 1 })),

      isSolved: (id) => get().solved.includes(id),

      reset: () => set({ solved: [], lastSolvedAt: null, totalAttempts: 0, totalSolved: 0 }),
    }),
    { name: 'tira-coco-challenges' },
  ),
);
