/**
 * Store do Torneio Semanal — guarda a chave e o estado de participação.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { advanceMatch, createTournament, type TournamentBracket } from '@/lib/tournament';

interface TournamentStore {
  bracket: TournamentBracket | null;
  joined: boolean;
  currentMatchId: string | null;

  join: () => void;
  leave: () => void;
  setBracket: (br: TournamentBracket | null) => void;
  advance: (matchId: string, winnerId: string) => void;
  setCurrentMatchId: (id: string | null) => void;
  reset: () => void;
}

export const useTournament = create<TournamentStore>()(
  persist(
    (set, get) => ({
      bracket: null,
      joined: false,
      currentMatchId: null,

      join: () =>
        set({
          bracket: createTournament({ prize: 50000, entryFee: 0 }),
          joined: true,
          currentMatchId: null,
        }),

      leave: () => set({ bracket: null, joined: false, currentMatchId: null }),

      setBracket: (br) => set({ bracket: br }),

      advance: (matchId, winnerId) => {
        const b = get().bracket;
        if (!b) return;
        set({ bracket: advanceMatch(b, matchId, winnerId) });
      },

      setCurrentMatchId: (id) => set({ currentMatchId: id }),

      reset: () => set({ bracket: null, joined: false, currentMatchId: null }),
    }),
    { name: 'tira-coco-tournament' },
  ),
);