// Edge Function: submit-move
//
// Autoridade das regras para partidas online. Usa o motor real (`@tira/engine`,
// cópia em `_shared/engine.ts`) para validar e aplicar o movimento; depois
// persiste o novo estado com a service role e liquida o resultado via RPC
// `_settle_match` (Elo/XP/moedas). O cliente nunca escreve no tabuleiro.
//
// Deploy: supabase functions deploy submit-move --project-ref <REF>
// (verificação de JWT ATIVA — o cliente envia a sessão).

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  DEFAULT_CONFIG,
  applyMove,
  isGameOver,
  validateMove,
  type Cell,
  type GameState,
  type MoveErrorCode,
  type PlayerId,
  type Square,
} from '../_shared/engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MATCH_COLUMNS =
  'id, room_id, stake, status, p1_id, p2_id, turn, board, move_count, pos_counts, winner, win_line, time_per_turn, turn_started_at, settled, created_at, updated_at';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Traduz o código do motor para o vocabulário usado pelo cliente. */
function mapMoveError(code: MoveErrorCode): string {
  switch (code) {
    case 'GAME_OVER':
      return 'match_not_active';
    case 'NOT_YOUR_TURN':
      return 'not_your_turn';
    case 'NOT_YOUR_PIECE':
      return 'not_your_piece';
    case 'DESTINATION_OCCUPIED':
      return 'destination_occupied';
    case 'PATH_BLOCKED':
      return 'path_blocked';
    case 'INVALID_SQUARE':
    case 'SAME_SQUARE':
    default:
      return 'invalid_square';
  }
}

const toCells = (b: number[]): Cell[] =>
  b.map((v) => (v === 1 ? 'P1' : v === -1 ? 'P2' : null));

const toSmallint = (cells: readonly Cell[]): number[] =>
  cells.map((c) => (c === 'P1' ? 1 : c === 'P2' ? -1 : 0));

interface SubmitBody {
  match_id?: string;
  from?: number;
  to?: number;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'not_authenticated' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: 'not_authenticated' }, 401);

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const matchId = (body.match_id ?? '').trim();
  const from = Math.trunc(Number(body.from));
  const to = Math.trunc(Number(body.to));
  if (!matchId) return json({ error: 'unknown_match' }, 400);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || from > 9 || to < 1 || to > 9) {
    return json({ error: 'invalid_square' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: match, error: matchError } = await admin
    .from('matches')
    .select(MATCH_COLUMNS)
    .eq('id', matchId)
    .maybeSingle();

  if (matchError) return json({ error: 'unknown_match' }, 500);
  if (!match) return json({ error: 'unknown_match' }, 404);
  if (match.status !== 'active') return json({ error: 'match_not_active' }, 409);

  const side: PlayerId | null =
    match.p1_id === user.id ? 'P1' : match.p2_id === user.id ? 'P2' : null;
  if (!side) return json({ error: 'not_a_participant' }, 403);
  if (match.turn !== side) return json({ error: 'not_your_turn' }, 409);

  if (match.time_per_turn > 0) {
    const started = Date.parse(match.turn_started_at as string);
    if (!Number.isNaN(started) && Date.now() > started + match.time_per_turn * 1000) {
      return json({ error: 'turn_expired' }, 409);
    }
  }

  const state: GameState = {
    board: toCells(match.board as number[]),
    currentPlayer: match.turn as PlayerId,
    status: side === 'P1' ? 'PLAYER_1_TURN' : 'PLAYER_2_TURN',
    winner: null,
    winningLine: null,
    moveCount: match.move_count as number,
    history: [],
    positionCounts: (match.pos_counts ?? {}) as Record<string, number>,
    config: DEFAULT_CONFIG,
  };

  const validation = validateMove(state, { from: from as Square, to: to as Square });
  if (!validation.ok) return json({ error: mapMoveError(validation.code) }, 400);

  const { state: next } = applyMove(state, { from: from as Square, to: to as Square });
  const finished = isGameOver(next);

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from('matches')
    .update({
      board: toSmallint(next.board),
      turn: next.currentPlayer,
      status: finished ? 'finished' : 'active',
      winner: finished ? next.winner ?? 'draw' : null,
      win_line: next.winningLine ?? null,
      move_count: next.moveCount,
      pos_counts: next.positionCounts,
      turn_started_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', matchId)
    .select(MATCH_COLUMNS)
    .single();

  if (updateError || !updated) {
    return json({ error: 'update_failed', detail: updateError?.message }, 500);
  }

  await admin.from('match_moves').insert({
    match_id: matchId,
    seq: next.moveCount - 1,
    player_id: user.id,
    side,
    from_square: from,
    to_square: to,
  });

  if (finished) {
    await admin.rpc('_settle_match', { p_match_id: matchId });
  }

  return json({ match: updated });
});
