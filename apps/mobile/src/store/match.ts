/**
 * Store da partida online (mobile) — matchmaking + partida autoritativa.
 *
 * Port de `src/store/match.ts` (web). O estado do jogo chega sempre do servidor
 * (via Realtime/`fetchMatch`); este store mantém a fila, a partida ativa e os
 * canais. Sem backend/sessão, `enabled` é `false` e a UI não oferece online.
 */
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Square } from '@tira/engine';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useProfile } from '@/store/profile';
import {
  cancelMatchmaking,
  claimTimeout,
  fetchActiveMatchForUser,
  fetchMyProfileStats,
  joinMatchmaking,
  resignMatch,
  sideForUser,
  subscribeToMatch,
  subscribeToMyMatches,
  submitMove,
  unsubscribeChannel,
  type MoveErrorCode,
  type OnlineMatch,
} from '@/lib/online/match';

interface MatchStore {
  enabled: boolean;
  /** Sala em que estamos à procura / a jogar. */
  roomId: string | null;
  /** Aposta (KZ) da sala em que estamos à espera (retida no servidor). */
  queuedStake: number;
  /** À espera de adversário. */
  queued: boolean;
  match: OnlineMatch | null;
  loading: boolean;
  error: MoveErrorCode | 'unknown' | null;

  joinQueue: (roomId: string, stake?: number) => Promise<void>;
  cancelQueue: () => Promise<void>;
  loadActiveMatch: () => Promise<void>;
  playMove: (from: Square, to: Square) => Promise<void>;
  resign: () => Promise<void>;
  claimTimeout: () => Promise<void>;
  leave: () => void;
}

/** Canais Realtime fora do estado (não serializáveis). */
let matchChannel: RealtimeChannel | null = null;
let myMatchesChannel: RealtimeChannel | null = null;

function currentUserId(): string | null {
  return useAuth.getState().user?.id ?? null;
}

export const useMatch = create<MatchStore>((set, get) => ({
  enabled: isSupabaseConfigured,
  roomId: null,
  queuedStake: 0,
  queued: false,
  match: null,
  loading: false,
  error: null,

  joinQueue: async (roomId, stake = 0) => {
    if (!isSupabaseConfigured) return;
    get().leave();
    set({ roomId, queuedStake: stake, queued: false, loading: true, error: null });

    // Escuta novas partidas (caso o emparelhamento aconteça depois).
    unsubscribeChannel(myMatchesChannel);
    myMatchesChannel = subscribeToMyMatches((m) => {
      const uid = currentUserId();
      if (sideForUser(m, uid)) void get().loadActiveMatch();
    });

    const res = await joinMatchmaking(roomId);
    if (!res) {
      set({ queued: false, loading: false, error: 'unknown' });
      return;
    }
    if (res.status === 'error') {
      set({ queued: false, loading: false, error: res.code, queuedStake: 0 });
      return;
    }
    if (res.status === 'matched') {
      set({ queued: false });
      await get().loadActiveMatch();
      void syncProfileFromServer();
      return;
    }
    // A aposta (se houver) ficou retida no servidor → sincroniza as moedas.
    if (stake > 0) void syncProfileFromServer();
    set({ queued: true, loading: false });
  },

  cancelQueue: async () => {
    const stake = get().queuedStake;
    await cancelMatchmaking();
    unsubscribeChannel(myMatchesChannel);
    myMatchesChannel = null;
    set({ queued: false, loading: false, roomId: null, queuedStake: 0 });
    // A aposta retida é reembolsada no servidor → sincroniza as moedas.
    if (stake > 0) void syncProfileFromServer();
  },

  loadActiveMatch: async () => {
    const uid = currentUserId();
    if (!uid) return;
    const m = await fetchActiveMatchForUser();
    if (!m) {
      set({ loading: false });
      return;
    }
    applyMatch(set, m);
  },

  playMove: async (from, to) => {
    const m = get().match;
    if (!m || m.status !== 'active') return;
    set({ error: null });
    const res = await submitMove(m.id, from, to);
    if (!res.ok) {
      set({ error: res.code });
      return;
    }
    applyMatch(set, res.match);
  },

  resign: async () => {
    const m = get().match;
    if (!m) return;
    const updated = await resignMatch(m.id);
    if (updated) applyMatch(set, updated);
  },

  claimTimeout: async () => {
    const m = get().match;
    if (!m) return;
    const updated = await claimTimeout(m.id);
    if (updated) applyMatch(set, updated);
  },

  leave: () => {
    unsubscribeChannel(matchChannel);
    unsubscribeChannel(myMatchesChannel);
    matchChannel = null;
    myMatchesChannel = null;
    set({ roomId: null, queuedStake: 0, queued: false, match: null, loading: false, error: null });
  },
}));

/** Atualiza a partida ativa e (re)liga a subscrição Realtime. */
function applyMatch(set: (partial: Partial<MatchStore>) => void, m: OnlineMatch): void {
  unsubscribeChannel(matchChannel);
  matchChannel = subscribeToMatch(m.id, (updated) => {
    set({ match: updated });
  });
  set({ match: m, queued: false, loading: false });

  // Sincroniza o perfil local com os prémios liquidados pelo servidor.
  if (m.status === 'finished' && m.settled) {
    void syncProfileFromServer();
  }
}

/** Recarrega os números do perfil (elo/xp/moedas) a partir do servidor. */
async function syncProfileFromServer(): Promise<void> {
  const stats = await fetchMyProfileStats();
  if (!stats) return;
  useProfile.getState().applyServerStats(stats);
}
