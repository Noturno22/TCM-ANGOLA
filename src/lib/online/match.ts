/**
 * Online — Fase 2: matchmaking e partida autoritativa (Supabase).
 *
 * O cliente NUNCA escreve no estado da partida: envia movimentos para a Edge
 * Function `submit-move` (autoridade, usa o motor real) e recebe o novo estado.
 * Se a função não estiver publicada, cai para a RPC SQL `submit_move`. O motor
 * (@tira/engine) é usado aqui apenas para reconstruir o `GameState` para a UI.
 *
 * Tal como na Fase 1, tudo degrada de forma graciosa: sem backend/sessão
 * as funções devolvem `null`/`{ ok: false }`.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_CONFIG,
  type Cell,
  type GameState,
  type Line,
  type PlayerId,
  type Square,
} from '@tira/engine';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export type MatchSide = 'P1' | 'P2';
export type MatchStatus = 'active' | 'finished' | 'aborted';
export type MatchWinner = MatchSide | 'draw' | null;

export interface OnlineMatch {
  id: string;
  roomId: string;
  stake: number;
  status: MatchStatus;
  p1Id: string;
  p2Id: string;
  turn: MatchSide;
  board: number[];
  moveCount: number;
  winner: MatchWinner;
  winLine: number[] | null;
  timePerTurn: number;
  turnStartedAt: string;
  settled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MoveErrorCode =
  | 'not_authenticated'
  | 'match_not_active'
  | 'not_a_participant'
  | 'not_your_turn'
  | 'turn_expired'
  | 'invalid_square'
  | 'not_your_piece'
  | 'destination_occupied'
  | 'path_blocked'
  | 'unknown_match'
  | 'unknown_room'
  | 'not_enough_coins'
  | 'age_restricted';

const KNOWN_ERROR_CODES: MoveErrorCode[] = [
  'not_authenticated',
  'match_not_active',
  'not_a_participant',
  'not_your_turn',
  'turn_expired',
  'invalid_square',
  'not_your_piece',
  'destination_occupied',
  'path_blocked',
  'unknown_match',
  'unknown_room',
  'not_enough_coins',
  'age_restricted',
];

/** Extrai um código de erro conhecido da mensagem (ou null). */
export function parseErrorCode(message: string | null | undefined): MoveErrorCode | null {
  if (!message) return null;
  const m = message.toLowerCase();
  for (const code of KNOWN_ERROR_CODES) {
    if (m.includes(code)) return code;
  }
  return null;
}

/** Valor numérico de cada lado no tabuleiro (1 / -1). */
export const SIDE_VALUE: Record<MatchSide, number> = { P1: 1, P2: -1 };

/** Normaliza o tabuleiro (aceita array ou string Postgres "{1,1,...}"). */
export function normalizeBoard(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map((n) => Number(n));
  if (typeof raw === 'string') {
    return raw
      .replace(/[{}]/g, '')
      .split(',')
      .filter((s) => s.length > 0)
      .map((s) => Number(s));
  }
  return [];
}

/** Converte o tabuleiro numérico em células do motor. */
export function toCells(raw: unknown): Cell[] {
  const board = normalizeBoard(raw);
  const cells: Cell[] = [];
  for (let i = 0; i < 9; i++) {
    const v = board[i];
    cells.push(v === 1 ? 'P1' : v === -1 ? 'P2' : null);
  }
  return cells;
}

/** Reconstrói um `GameState` do motor a partir de uma partida online. */
export function matchToGameState(m: OnlineMatch): GameState {
  const board = toCells(m.board);
  let status: GameState['status'];
  let winner: PlayerId | null = null;

  if (m.winner === 'P1' || m.winner === 'P2') {
    winner = m.winner;
    status = m.winner === 'P1' ? 'WIN_P1' : 'WIN_P2';
  } else if (m.winner === 'draw') {
    status = 'DRAW';
  } else {
    status = m.turn === 'P1' ? 'PLAYER_1_TURN' : 'PLAYER_2_TURN';
  }

  const winningLine: Line | null =
    m.winLine && m.winLine.length === 3
      ? ([m.winLine[0], m.winLine[1], m.winLine[2]] as unknown as Line)
      : null;

  return {
    board,
    currentPlayer: m.turn,
    status,
    winner,
    winningLine,
    moveCount: m.moveCount,
    history: [],
    positionCounts: {},
    config: DEFAULT_CONFIG,
  };
}

/** Lado do utilizador na partida (ou null se não participa). */
export function sideForUser(m: OnlineMatch, userId: string | null | undefined): MatchSide | null {
  if (!userId) return null;
  if (m.p1Id === userId) return 'P1';
  if (m.p2Id === userId) return 'P2';
  return null;
}

/** Segundos restantes no turno (nunca negativo). 0 = sem limite. */
export function timeLeftSeconds(m: OnlineMatch, nowMs: number = Date.now()): number {
  if (m.timePerTurn <= 0) return 0;
  const started = Date.parse(m.turnStartedAt);
  if (Number.isNaN(started)) return m.timePerTurn;
  const elapsed = (nowMs - started) / 1000;
  return Math.max(0, Math.ceil(m.timePerTurn - elapsed));
}

/** Converte a linha de `matches` num `OnlineMatch`. Função pura (testável). */
export function mapMatchRow(row: Record<string, unknown>): OnlineMatch {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    stake: (row.stake as number) ?? 0,
    status: row.status as MatchStatus,
    p1Id: row.p1_id as string,
    p2Id: row.p2_id as string,
    turn: row.turn as MatchSide,
    board: normalizeBoard(row.board),
    moveCount: (row.move_count as number) ?? 0,
    winner: (row.winner as MatchWinner) ?? null,
    winLine: row.win_line ? normalizeBoard(row.win_line) : null,
    timePerTurn: (row.time_per_turn as number) ?? 0,
    turnStartedAt: row.turn_started_at as string,
    settled: (row.settled as boolean) ?? false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function client(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient();
}

const MATCH_COLUMNS =
  'id, room_id, stake, status, p1_id, p2_id, turn, board, move_count, winner, win_line, time_per_turn, turn_started_at, settled, created_at, updated_at';

export type MatchmakingResult =
  | { status: 'queued' }
  | { status: 'matched'; matchId: string; side: MatchSide }
  | { status: 'error'; code: MoveErrorCode | 'unknown' }
  | null;

/** Entra na fila da sala (ou emparelha imediatamente). */
export async function joinMatchmaking(roomId: string): Promise<MatchmakingResult> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb.rpc('join_matchmaking', { p_room_id: roomId });
  if (error) return { status: 'error', code: parseErrorCode(error.message) ?? 'unknown' };
  if (!data) return { status: 'error', code: 'unknown' };
  const res = data as { status: string; match_id?: string; side?: MatchSide };
  if (res.status === 'matched' && res.match_id) {
    return { status: 'matched', matchId: res.match_id, side: res.side ?? 'P2' };
  }
  if (res.status === 'queued') return { status: 'queued' };
  return { status: 'error', code: 'unknown' };
}

/** Pot apostado numa partida (o que o vencedor leva). 0 = sem aposta. */
export function potForStake(stake: number): number {
  return stake > 0 ? stake * 2 : 0;
}

/** Sai da fila. */
export async function cancelMatchmaking(): Promise<void> {
  const sb = client();
  if (!sb) return;
  await sb.rpc('cancel_matchmaking');
}

/** Partida por id. `null` em erro. */
export async function fetchMatch(matchId: string): Promise<OnlineMatch | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb
    .from('matches')
    .select(MATCH_COLUMNS)
    .eq('id', matchId)
    .maybeSingle();
  if (error || !data) return null;
  return mapMatchRow(data);
}

/** Estatísticas do perfil do próprio (após liquidação online). `null` em erro. */
export async function fetchMyProfileStats(): Promise<{
  elo: number;
  level: number;
  xp: number;
  coins: number;
} | null> {
  const sb = client();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('elo, level, xp, coins')
    .eq('id', uid)
    .maybeSingle();
  if (error || !data) return null;
  return {
    elo: (data.elo as number) ?? 1000,
    level: (data.level as number) ?? 1,
    xp: (data.xp as number) ?? 0,
    coins: (data.coins as number) ?? 0,
  };
}

/** Partida ativa mais recente do utilizador. `null` se não houver. */
export async function fetchActiveMatchForUser(): Promise<OnlineMatch | null> {
  const sb = client();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await sb
    .from('matches')
    .select(MATCH_COLUMNS)
    .eq('status', 'active')
    .or(`p1_id.eq.${uid},p2_id.eq.${uid}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapMatchRow(data);
}

export type SubmitMoveResult =
  | { ok: true; match: OnlineMatch }
  | { ok: false; code: MoveErrorCode | 'unknown' };

/** Envia um movimento ao servidor (autoritativo). */
export async function submitMove(
  matchId: string,
  from: Square,
  to: Square,
): Promise<SubmitMoveResult> {
  const sb = client();
  if (!sb) return { ok: false, code: 'unknown' };

  // Autoridade preferida: Edge Function `submit-move` (usa o motor real).
  try {
    const { data, error } = await sb.functions.invoke('submit-move', {
      body: { match_id: matchId, from, to },
    });
    if (!error && data) {
      const payload = data as { match?: Record<string, unknown> };
      const row = payload.match ?? (data as Record<string, unknown>);
      if (row.id) return { ok: true, match: mapMatchRow(row) };
    }
  } catch {
    // Função indisponível → recorre à RPC SQL abaixo.
  }

  // Fallback: RPC SQL `submit_move` (as mesmas regras, em PL/pgSQL).
  const { data, error } = await sb.rpc('submit_move', {
    p_match_id: matchId,
    p_from: from,
    p_to: to,
  });
  if (error) return { ok: false, code: parseErrorCode(error.message) ?? 'unknown' };
  if (!data) return { ok: false, code: 'unknown' };
  const fresh = await fetchMatch(matchId);
  if (!fresh) return { ok: false, code: 'unknown' };
  return { ok: true, match: fresh };
}

/** Desiste da partida (o adversário vence). */
export async function resignMatch(matchId: string): Promise<OnlineMatch | null> {
  const sb = client();
  if (!sb) return null;
  const { error } = await sb.rpc('resign_match', { p_match_id: matchId });
  if (error) return null;
  return fetchMatch(matchId);
}

/** Reclama vitória se o adversário deixou o relógio expirar. */
export async function claimTimeout(matchId: string): Promise<OnlineMatch | null> {
  const sb = client();
  if (!sb) return null;
  const { error } = await sb.rpc('claim_timeout', { p_match_id: matchId });
  if (error) return null;
  return fetchMatch(matchId);
}

/** Subscreve alterações a uma partida (UPDATE). */
export function subscribeToMatch(
  matchId: string,
  onUpdate: (match: OnlineMatch) => void,
): RealtimeChannel | null {
  const sb = client();
  if (!sb) return null;
  return sb
    .channel(`match:${matchId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      (payload) => onUpdate(mapMatchRow(payload.new as Record<string, unknown>)),
    )
    .subscribe();
}

/** Subscreve novas partidas em que o utilizador entra (RLS limita as linhas visíveis). */
export function subscribeToMyMatches(onNew: (match: OnlineMatch) => void): RealtimeChannel | null {
  const sb = client();
  if (!sb) return null;
  return sb
    .channel('my-matches')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'matches' },
      (payload) => onNew(mapMatchRow(payload.new as Record<string, unknown>)),
    )
    .subscribe();
}

/** Remove um canal com segurança. */
export function unsubscribeChannel(channel: RealtimeChannel | null): void {
  if (channel) void channel.unsubscribe();
}
