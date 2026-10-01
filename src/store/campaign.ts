/**
 * Store da Campanha — regista progresso por nível.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CampaignStore {
  /** Níveis completados (IDs) */
  completed: number[];
  /** Nível atualmente desbloqueado (próximo a jogar) */
  currentLevel: number;
  /** Tentativas por nível */
  attemptsByLevel: Record<number, number>;

  completeLevel: (id: number) => void;
  recordAttempt: (id: number) => void;
  reset: () => void;
}

export const useCampaign = create<CampaignStore>()(
  persist(
    (set, get) => ({
      completed: [],
      currentLevel: 1,
      attemptsByLevel: {},

      completeLevel: (id) =>
        set((s) => {
          const completed = s.completed.includes(id) ? s.completed : [...s.completed, id];
          const currentLevel = Math.max(s.currentLevel, id + 1);
          return { completed, currentLevel };
        }),

      recordAttempt: (id) =>
        set((s) => ({
          attemptsByLevel: {
            ...s.attemptsByLevel,
            [id]: (s.attemptsByLevel[id] ?? 0) + 1,
          },
        })),

      reset: () => set({ completed: [], currentLevel: 1, attemptsByLevel: {} }),
    }),
    { name: 'tira-coco-campaign' },
  ),
);
