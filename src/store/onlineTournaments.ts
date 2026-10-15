/**
 * Store de torneios online (Fase 3) — lista, detalhe/chave e ações.
 *
 * Sem backend configurado ou sem sessão, `enabled` fica `false` e a UI
 * mantém um estado vazio em vez de rebentar. As jogas do bracket usam a
 * partida autoritativa da Fase 2 (`useMatch`).
 */
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchProfiles } from '@/lib/online/rooms';
import { fetchMatch } from '@/lib/online/match';
import {
  createTournament,
  fetchTournamentDetail,
  fetchTournaments,
  joinTournament,
  leaveTournament,
  reportTournamentResult,
  startTournament,
  startTournamentMatch,
  subscribeToTournament,
  unsubscribeTournamentChannel,
  type CreateTournamentInput,
  type CreateTournamentResult,
  type JoinTournamentResult,
  type StartTournamentMatchResult,
  type Tournament,
  type TournamentDetail,
  type TournamentErrorCode,
} from '@/lib/online/tournaments';

export interface PlayerPublicInfo {
  username: string | null;
  level: number;
  elo: number;
}

interface OnlineTournamentsStore {
  /** Backend configurado (Supabase). */
  enabled: boolean;

  list: Tournament[];
  listLoaded: boolean;
  listLoading: boolean;

  selectedId: string | null;
  detail: TournamentDetail | null;
  detailLoading: boolean;
  /** Perfis públicos dos participantes do torneio aberto. */
  profiles: Record<string, PlayerPublicInfo>;

  error: TournamentErrorCode | null;

  load: () => Promise<void>;
  open: (id: string) => Promise<void>;
  close: () => void;
  create: (input: CreateTournamentInput) => Promise<CreateTournamentResult>;
  join: (id: string) => Promise<JoinTournamentResult>;
  leave: (id: string) => Promise<boolean>;
  start: (id: string) => Promise<boolean>;
  /** Abre (ou retoma) a partida online de um jogo do bracket. */
  playMatch: (tournamentMatchId: string) => Promise<StartTournamentMatchResult>;
  /** Regista o resultado de um jogo do bracket já terminado. */
  report: (tournamentMatchId: string) => Promise<{ ok: boolean; code?: TournamentErrorCode }>;
  /** Fecha jogos do bracket cujo jogo online já terminou. */
  syncResults: () => Promise<void>;
  subscribe: (id: string) => void;
  unsubscribe: () => void;
}

/** Canal Realtime fora do estado (não serializável). */
let channel: RealtimeChannel | null = null;

export const useOnlineTournaments = create<OnlineTournamentsStore>((set, get) => ({
  enabled: isSupabaseConfigured,
  list: [],
  listLoaded: false,
  listLoading: false,
  selectedId: null,
  detail: null,
  detailLoading: false,
  profiles: {},
  error: null,

  load: async () => {
    if (!isSupabaseConfigured) return;
    set({ listLoading: true });
    const list = await fetchTournaments();
    if (list) {
      set({ list, listLoaded: true, listLoading: false });
    } else {
      set({ listLoading: false });
    }
  },

  open: async (id) => {
    if (!isSupabaseConfigured) return;
    set({ selectedId: id, detailLoading: true, error: null });
    get().subscribe(id);
    const detail = await fetchTournamentDetail(id);
    if (!detail) {
      set({ detailLoading: false });
      return;
    }
    set({ detail, detailLoading: false });
    await loadProfiles(set, detail);
    await get().syncResults();
  },

  close: () => {
    get().unsubscribe();
    set({ selectedId: null, detail: null, detailLoading: false, profiles: {}, error: null });
  },

  create: async (input) => {
    const result = await createTournament(input);
    if (result.ok) {
      await get().load();
      await get().open(result.tournamentId);
    }
    return result;
  },

  join: async (id) => {
    const result = await joinTournament(id);
    if (result.ok) {
      await get().load();
      if (get().selectedId === id) await refreshDetail(set, get, id);
    }
    return result;
  },

  leave: async (id) => {
    const ok = await leaveTournament(id);
    if (ok) {
      await get().load();
      if (get().selectedId === id) await refreshDetail(set, get, id);
    }
    return ok;
  },

  start: async (id) => {
    const ok = await startTournament(id);
    if (ok) {
      await get().load();
      if (get().selectedId === id) await refreshDetail(set, get, id);
    }
    return ok;
  },

  playMatch: async (tournamentMatchId) => startTournamentMatch(tournamentMatchId),

  report: async (tournamentMatchId) => reportTournamentResult(tournamentMatchId),

  syncResults: async () => {
    const detail = get().detail;
    if (!detail) return;
    const pending = detail.matches.filter(
      (m) => m.winnerId === null && m.matchId !== null && m.status === 'playing',
    );
    if (pending.length === 0) return;

    let reported = false;
    for (const bm of pending) {
      const match = await fetchMatch(bm.matchId as string);
      if (match && match.status === 'finished') {
        const res = await reportTournamentResult(bm.id);
        if (res.ok) reported = true;
      }
    }
    if (reported && get().selectedId) await refreshDetail(set, get, get().selectedId as string);
  },

  subscribe: (id) => {
    if (!isSupabaseConfigured) return;
    if (channel) {
      void channel.unsubscribe();
      channel = null;
    }
    channel = subscribeToTournament(id, () => {
      void refreshDetail(set, get, id);
    });
  },

  unsubscribe: () => {
    unsubscribeTournamentChannel(channel);
    channel = null;
  },
}));

type Set = (partial: Partial<OnlineTournamentsStore>) => void;
type Get = () => OnlineTournamentsStore;

/** Recarrega o detalhe do torneio aberto (sem tocar no estado de loading). */
async function refreshDetail(set: Set, get: Get, id: string): Promise<void> {
  const detail = await fetchTournamentDetail(id);
  if (!detail || get().selectedId !== id) return;
  set({ detail });
  await loadProfiles(set, detail);
}

/** Junta os perfis públicos dos participantes ao estado. */
async function loadProfiles(set: Set, detail: TournamentDetail): Promise<void> {
  const ids = detail.entries.map((e) => e.userId);
  if (ids.length === 0) return;
  const profiles = await fetchProfiles(ids);
  set({ profiles });
}
