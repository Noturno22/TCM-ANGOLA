/**
 * Online — Fase 3: torneios online (Supabase).
 *
 * O cliente NUNCA escreve nas tabelas `tournaments`, `tournament_entries` ou
 * `tournament_matches`: tudo passa pelas RPCs `create_tournament`,
 * `join_tournament`, `leave_tournament`, `start_tournament`,
 * `start_tournament_match` e `report_tournament_result`. As jogas do bracket
 * são linhas normais em `public.matches` e reutilizam a autoridade da Fase 2.
 *
 * Tal como nas fases anteriores, tudo degrada de forma graciosa: sem
 * backend/sessão as funções devolvem `null`/`[]`/`{ ok:false }`.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export type TournamentFormat = 'single_elim';
export type TournamentStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type BracketMatchStatus = 'pending' | 'ready' | 'playing' | 'finished' | 'bye';

export interface Tournament {
  id: string;
  name: string;
  description: string;
  format: TournamentFormat;
  maxPlayers: number;
  entryFee: number;
  prize: number;
  pot: number;
  roomId: string;
  timePerTurn: number;
  status: TournamentStatus;
  championId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentEntry {
  id: string;
  tournamentId: string;
  userId: string;
  status: 'active' | 'eliminated';
  createdAt: string;
}

export interface BracketMatch {
  id: string;
  tournamentId: string;
  round: number;
  slot: number;
  p1Id: string | null;
  p2Id: string | null;
  winnerId: string | null;
  matchId: string | null;
  status: BracketMatchStatus;
}

/** Torneio + chave + inscrições, tudo o que a UI precisa para um ecrã. */
export interface TournamentDetail {
  tournament: Tournament;
  matches: BracketMatch[];
  entries: TournamentEntry[];
  /** Número de jogadores inscritos. */
  playerCount: number;
}

export type TournamentErrorCode =
  | 'not_authenticated'
  | 'unknown_tournament'
  | 'unknown_room'
  | 'unknown_bracket_match'
  | 'tournament_not_open'
  | 'tournament_already_started'
  | 'tournament_not_active'
  | 'tournament_full'
  | 'not_enough_coins'
  | 'age_restricted'
  | 'not_enough_players'
  | 'not_tournament_owner'
  | 'not_a_participant'
  | 'invalid_name'
  | 'too_many_invites'
  | 'match_not_ready'
  | 'match_not_started'
  | 'match_not_finished'
  | 'unknown';

const KNOWN_ERROR_CODES: TournamentErrorCode[] = [
  'not_authenticated',
  'unknown_tournament',
  'unknown_room',
  'unknown_bracket_match',
  'tournament_not_open',
  'tournament_already_started',
  'tournament_not_active',
  'tournament_full',
  'not_enough_coins',
  'age_restricted',
  'not_enough_players',
  'not_tournament_owner',
  'not_a_participant',
  'invalid_name',
  'too_many_invites',
  'match_not_ready',
  'match_not_started',
  'match_not_finished',
];

/** Extrai um código de erro conhecido da mensagem (ou null). */
export function parseTournamentErrorCode(
  message: string | null | undefined,
): TournamentErrorCode | null {
  if (!message) return null;
  const m = message.toLowerCase();
  for (const code of KNOWN_ERROR_CODES) {
    if (m.includes(code)) return code;
  }
  return null;
}

/** Converte uma linha de `tournaments`. Função pura (testável). */
export function mapTournamentRow(row: Record<string, unknown>): Tournament {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    format: (row.format as TournamentFormat) ?? 'single_elim',
    maxPlayers: (row.max_players as number) ?? 8,
    entryFee: (row.entry_fee as number) ?? 0,
    prize: (row.prize as number) ?? 0,
    pot: (row.pot as number) ?? 0,
    roomId: (row.room_id as string) ?? 'global',
    timePerTurn: (row.time_per_turn as number) ?? 0,
    status: (row.status as TournamentStatus) ?? 'open',
    championId: (row.champion_id as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

/** Converte uma linha de `tournament_matches`. Função pura (testável). */
export function mapBracketMatchRow(row: Record<string, unknown>): BracketMatch {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    round: (row.round as number) ?? 1,
    slot: (row.slot as number) ?? 1,
    p1Id: (row.p1_id as string | null) ?? null,
    p2Id: (row.p2_id as string | null) ?? null,
    winnerId: (row.winner_id as string | null) ?? null,
    matchId: (row.match_id as string | null) ?? null,
    status: (row.status as BracketMatchStatus) ?? 'pending',
  };
}

/** Converte uma linha de `tournament_entries`. Função pura (testável). */
export function mapTournamentEntryRow(row: Record<string, unknown>): TournamentEntry {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    userId: row.user_id as string,
    status: (row.status as 'active' | 'eliminated') ?? 'active',
    createdAt: row.created_at as string,
  };
}

/**
 * Agrupa os jogos por ronda (crescente) e por slot (crescente). Função pura.
 */
export function groupMatchesByRound(
  matches: readonly BracketMatch[],
): Array<{ round: number; matches: BracketMatch[] }> {
  const byRound = new Map<number, BracketMatch[]>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }
  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, list]) => ({
      round,
      matches: [...list].sort((a, b) => a.slot - b.slot),
    }));
}

/** Número total de rondas de uma chave (a maior ronda com jogos). */
export function bracketRoundCount(matches: readonly BracketMatch[]): number {
  let max = 0;
  for (const m of matches) if (m.round > max) max = m.round;
  return max;
}

/**
 * Etiqueta de uma ronda em função do total de rondas. Função pura.
 * A última é a final; a penúltima as meias-finais, etc.
 */
export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round + 1;
  switch (fromEnd) {
    case 1:
      return 'Final';
    case 2:
      return 'Meias-finais';
    case 3:
      return 'Quartas de final';
    case 4:
      return 'Oitavas de final';
    default:
      return `Ronda ${round}`;
  }
}

/**
 * Encontra o jogo por decidir do jogador: prefere um já em curso
 * (`playing`) e, na sua falta, um pronto a começar (`ready`). Função pura.
 */
export function findMyOpenMatch(
  matches: readonly BracketMatch[],
  userId: string | null | undefined,
): BracketMatch | null {
  if (!userId) return null;
  const mine = matches.filter(
    (m) =>
      m.winnerId === null &&
      (m.p1Id === userId || m.p2Id === userId) &&
      (m.status === 'ready' || m.status === 'playing'),
  );
  return mine.find((m) => m.status === 'playing') ?? mine.find((m) => m.status === 'ready') ?? null;
}

/** Etiqueta legível do estado do torneio. Função pura. */
export function tournamentStatusLabel(status: TournamentStatus): string {
  switch (status) {
    case 'open':
      return 'Inscrições abertas';
    case 'in_progress':
      return 'Em curso';
    case 'completed':
      return 'Terminado';
    case 'cancelled':
      return 'Cancelado';
  }
}

/** Estado legível de um jogo do bracket. Função pura. */
export function bracketMatchStatusLabel(status: BracketMatchStatus): string {
  switch (status) {
    case 'pending':
      return 'Por definir';
    case 'ready':
      return 'Pronto';
    case 'playing':
      return 'Em jogo';
    case 'finished':
      return 'Terminado';
    case 'bye':
      return 'Passa';
  }
}

function client(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient();
}

const TOURNAMENT_COLUMNS =
  'id, name, description, format, max_players, entry_fee, prize, pot, room_id, time_per_turn, status, champion_id, created_by, created_at, updated_at';

const BRACKET_COLUMNS =
  'id, tournament_id, round, slot, p1_id, p2_id, winner_id, match_id, status';

const ENTRY_COLUMNS = 'id, tournament_id, user_id, status, created_at';

/** Lista torneios (abertos e em curso primeiro). `null` em caso de erro. */
export async function fetchTournaments(): Promise<Tournament[] | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb
    .from('tournaments')
    .select(TOURNAMENT_COLUMNS)
    .in('status', ['open', 'in_progress'])
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error || !data) return null;
  return data.map((r) => mapTournamentRow(r as Record<string, unknown>));
}

/** Chave completa de um torneio. `null` em caso de erro. */
export async function fetchTournamentBracket(
  tournamentId: string,
): Promise<BracketMatch[] | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb
    .from('tournament_matches')
    .select(BRACKET_COLUMNS)
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('slot', { ascending: true });
  if (error || !data) return null;
  return data.map((r) => mapBracketMatchRow(r as Record<string, unknown>));
}

/** Inscrições de um torneio. `null` em caso de erro. */
export async function fetchTournamentEntries(
  tournamentId: string,
): Promise<TournamentEntry[] | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb
    .from('tournament_entries')
    .select(ENTRY_COLUMNS)
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  if (error || !data) return null;
  return data.map((r) => mapTournamentEntryRow(r as Record<string, unknown>));
}

/** Torneio + chave + inscrições. `null` em caso de erro. */
export async function fetchTournamentDetail(
  tournamentId: string,
): Promise<TournamentDetail | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb
    .from('tournaments')
    .select(TOURNAMENT_COLUMNS)
    .eq('id', tournamentId)
    .maybeSingle();
  if (error || !data) return null;

  const tournament = mapTournamentRow(data as Record<string, unknown>);
  const [matches, entries] = await Promise.all([
    fetchTournamentBracket(tournamentId),
    fetchTournamentEntries(tournamentId),
  ]);

  return {
    tournament,
    matches: matches ?? [],
    entries: entries ?? [],
    playerCount: entries?.length ?? 0,
  };
}

export type CreateTournamentInput = {
  name: string;
  description?: string;
  entryFee?: number;
  prize?: number;
  maxPlayers?: number;
  roomId?: string;
};

export type CreateTournamentResult =
  | { ok: true; tournamentId: string }
  | { ok: false; code: TournamentErrorCode };

/** Cria um torneio aberto. */
export async function createTournament(
  input: CreateTournamentInput,
): Promise<CreateTournamentResult> {
  const sb = client();
  if (!sb) return { ok: false, code: 'unknown' };
  const { data, error } = await sb.rpc('create_tournament', {
    p_name: input.name,
    p_entry_fee: input.entryFee ?? 0,
    p_prize: input.prize ?? 0,
    p_max_players: input.maxPlayers ?? 8,
    p_room_id: input.roomId ?? 'global',
    p_description: input.description ?? '',
  });
  if (error) return { ok: false, code: parseTournamentErrorCode(error.message) ?? 'unknown' };
  const id = (data as { tournament_id?: string } | null)?.tournament_id;
  if (!id) return { ok: false, code: 'unknown' };
  return { ok: true, tournamentId: id };
}

export type JoinTournamentResult =
  | { ok: true; status: 'joined' | 'already_joined'; count: number }
  | { ok: false; code: TournamentErrorCode };

/** Inscreve o jogador (desconta a taxa de inscrição). */
export async function joinTournament(
  tournamentId: string,
): Promise<JoinTournamentResult> {
  const sb = client();
  if (!sb) return { ok: false, code: 'unknown' };
  const { data, error } = await sb.rpc('join_tournament', {
    p_tournament_id: tournamentId,
  });
  if (error) return { ok: false, code: parseTournamentErrorCode(error.message) ?? 'unknown' };
  const res = data as { status?: string; count?: number } | null;
  if (res?.status === 'joined' || res?.status === 'already_joined') {
    return { ok: true, status: res.status, count: (res.count as number) ?? 0 };
  }
  return { ok: false, code: 'unknown' };
}

/** Desinscreve o jogador (reembolso se o torneio ainda estiver aberto). */
export async function leaveTournament(tournamentId: string): Promise<boolean> {
  const sb = client();
  if (!sb) return false;
  const { error } = await sb.rpc('leave_tournament', { p_tournament_id: tournamentId });
  return !error;
}

export type UpdateTournamentInput = {
  tournamentId: string;
  name: string;
  description?: string;
};

/** Edita nome/descrição — só o criador e só enquanto o torneio está aberto. */
export async function updateTournament(
  input: UpdateTournamentInput,
): Promise<{ ok: boolean; code?: TournamentErrorCode }> {
  const sb = client();
  if (!sb) return { ok: false, code: 'unknown' };
  const { error } = await sb.rpc('update_tournament', {
    p_tournament_id: input.tournamentId,
    p_name: input.name,
    p_description: input.description ?? '',
  });
  if (error) return { ok: false, code: parseTournamentErrorCode(error.message) ?? 'unknown' };
  return { ok: true };
}

export type InviteTournamentResult =
  | { ok: true; invited: number }
  | { ok: false; code: TournamentErrorCode };

/** Convida amigos (notificação) — criador ou inscrito, torneio ainda aberto. */
export async function inviteTournamentFriends(
  tournamentId: string,
  userIds: readonly string[],
): Promise<InviteTournamentResult> {
  const sb = client();
  if (!sb) return { ok: false, code: 'unknown' };
  const { data, error } = await sb.rpc('invite_to_tournament', {
    p_tournament_id: tournamentId,
    p_user_ids: [...userIds],
  });
  if (error) return { ok: false, code: parseTournamentErrorCode(error.message) ?? 'unknown' };
  const count = Number((data as { count?: number } | null)?.count ?? 0);
  return { ok: true, invited: Number.isFinite(count) ? count : 0 };
}

/** Inicia o torneio (só o criador) e gera a chave. */
export async function startTournament(tournamentId: string): Promise<boolean> {
  const sb = client();
  if (!sb) return false;
  const { error } = await sb.rpc('start_tournament', { p_tournament_id: tournamentId });
  return !error;
}

export type StartTournamentMatchResult =
  | { ok: true; matchId: string }
  | { ok: false; code: TournamentErrorCode };

/** Abre o jogo online de um par já emparelhado no bracket. */
export async function startTournamentMatch(
  tournamentMatchId: string,
): Promise<StartTournamentMatchResult> {
  const sb = client();
  if (!sb) return { ok: false, code: 'unknown' };
  const { data, error } = await sb.rpc('start_tournament_match', {
    p_tournament_match_id: tournamentMatchId,
  });
  if (error) return { ok: false, code: parseTournamentErrorCode(error.message) ?? 'unknown' };
  const matchId = (data as { match_id?: string } | null)?.match_id;
  if (!matchId) return { ok: false, code: 'unknown' };
  return { ok: true, matchId };
}

/** Regista o resultado de um jogo do bracket e avança o vencedor. */
export async function reportTournamentResult(
  tournamentMatchId: string,
): Promise<{ ok: boolean; code?: TournamentErrorCode }> {
  const sb = client();
  if (!sb) return { ok: false, code: 'unknown' };
  const { error } = await sb.rpc('report_tournament_result', {
    p_tournament_match_id: tournamentMatchId,
  });
  if (error) return { ok: false, code: parseTournamentErrorCode(error.message) ?? 'unknown' };
  return { ok: true };
}

/** Subscreve alterações a um torneio (torneio + jogos + inscrições). */
export function subscribeToTournament(id: string, onChange: () => void): RealtimeChannel | null {
  const sb = client();
  if (!sb) return null;
  return sb
    .channel(`tournament:${id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${id}`,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tournament_entries',
        filter: `tournament_id=eq.${id}`,
      },
      () => onChange(),
    )
    .subscribe();
}

/** Remove um canal com segurança. */
export function unsubscribeTournamentChannel(channel: RealtimeChannel | null): void {
  if (channel) void channel.unsubscribe();
}
