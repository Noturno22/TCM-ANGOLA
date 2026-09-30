/**
 * Store do Desafio Relâmpago — 5 puzzles cronometrados.
 * Regista o melhor tempo e histórico de tentativas.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LightningResult {
  date: string; // ISO
  totalTimeSec: number;
  solved: number; // quantos dos 5 resolveu
  skipped: number;
  puzzles: { id: string; solved: boolean; timeSec: number }[];
}

interface LightningStore {
  bestTimeSec: number | null;
  bestSolved: number;
  totalRuns: number;
  history: LightningResult[];

  recordRun: (result: LightningResult) => void;
  reset: () => void;
}

export const useLightning = create<LightningStore>()(
  persist(
    (set) => ({
      bestTimeSec: null,
      bestSolved: 0,
      totalRuns: 0,
      history: [],

      recordRun: (result) =>
        set((s) => {
          const newHistory = [result, ...s.history].slice(0, 20);
          const newBest =
            result.solved > s.bestSolved ||
            (result.solved === s.bestSolved &&
              s.bestTimeSec !== null &&
              result.totalTimeSec < s.bestTimeSec)
              ? result
              : null;
          return {
            history: newHistory,
            totalRuns: s.totalRuns + 1,
            bestSolved: Math.max(s.bestSolved, result.solved),
            bestTimeSec:
              newBest && result.solved > 0
                ? s.bestTimeSec !== null
                  ? Math.min(s.bestTimeSec, result.totalTimeSec)
                  : result.totalTimeSec
                : s.bestTimeSec,
          };
        }),

      reset: () => set({ bestTimeSec: null, bestSolved: 0, totalRuns: 0, history: [] }),
    }),
    { name: 'tira-coco-lightning' },
  ),
);
