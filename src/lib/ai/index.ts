/**
 * IA — 4 níveis de dificuldade para Tira o Cocó do Meio.
 *
 * Fácil: ~30% aleatório; caso contrário ganha ou bloqueia ameaça simples.
 * Médio: Minimax profundidade 4 + avaliação heurística.
 * Difícil: Minimax + Alpha-Beta profundidade ≥ 8, ordenação de jogadas, deteção de ciclos.
 * Perfeito: Usa a tabela do solver (análise retrógrada dos 3 360 estados).
 *
 * Todas as funções são PURAS e aceitam uma seed para RNG reprodutível.
 * A IA só usa o motor (getLegalMoves, applyMove, getWinningMoves).
 */

import {
  applyMove,
  getLegalMoves,
  getThreats,
  getWinningMoves,
  isGameOver,
  type GameState,
  type Move,
  type PlayerId,
} from '@/lib/engine';
import { createRng, pick, shuffle } from '@/lib/ai/rng';
import { solvePosition } from '@/lib/ai/solver';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'perfect';

function other(p: PlayerId): PlayerId {
  return p === 'P1' ? 'P2' : 'P1';
}

/**
 * Escolhe o movimento para a IA dado o estado e a dificuldade.
 * @param seed seed para RNG reprodutível (omite para aleatório temporal)
 */
export function chooseMove(
  state: GameState,
  difficulty: Difficulty,
  seed?: number,
): Move | null {
  const rng = createRng(seed ?? (Math.random() * 1e9) | 0);
  const legal = getLegalMoves(state, state.currentPlayer);
  if (legal.length === 0) return null;

  switch (difficulty) {
    case 'easy':
      return chooseEasy(state, rng, legal);
    case 'medium':
      return chooseMedium(state, rng, legal);
    case 'hard':
      return chooseHard(state, rng, legal);
    case 'perfect':
      return choosePerfect(state, rng, legal);
  }
}

// ============ FÁCIL ============
function chooseEasy(
  state: GameState,
  rng: () => number,
  legal: Move[],
): Move {
  // ~30% jogada aleatória
  if (rng() < 0.3) {
    return pick(rng, legal);
  }
  const me = state.currentPlayer;
  const opp = other(me);
  // 1. Ganhar imediatamente se possível
  const wins = getWinningMoves(state, me);
  if (wins.length > 0) return pick(rng, wins);
  // 2. Bloquear ameaça imediata do adversário
  const oppThreats = getThreats(state, opp);
  if (oppThreats.length > 0) {
    // Bloquear ocupando o destino da ameaça
    const blockMove = legal.find((m) =>
      oppThreats.some((t) => m.to === t.to),
    );
    if (blockMove) return blockMove;
  }
  // 3. Caso contrário, jogada aleatória
  return pick(rng, legal);
}

// ============ MÉDIO ============

function chooseMedium(
  state: GameState,
  rng: () => number,
  legal: Move[],
): Move {
  const me = state.currentPlayer;
  // 1. Ganhar imediatamente
  const wins = getWinningMoves(state, me);
  if (wins.length > 0) return pick(rng, wins);
  // 2. Bloquear
  const opp = other(me);
  const oppThreats = getThreats(state, opp);
  if (oppThreats.length > 0) {
    const blockMove = legal.find((m) =>
      oppThreats.some((t) => m.to === t.to),
    );
    if (blockMove) return blockMove;
  }
  // 3. Minimax profundidade 4
  const DEPTH = 4;
  let bestScore = -Infinity;
  let bestMoves: Move[] = [];
  for (const mv of shuffle(rng, legal)) {
    const { state: child } = applyMove(state, mv);
    const score = -minimax(child, DEPTH - 1, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [mv];
    } else if (score === bestScore) {
      bestMoves.push(mv);
    }
  }
  return pick(rng, bestMoves.length > 0 ? bestMoves : legal);
}

// ============ DIFÍCIL ============

function chooseHard(
  state: GameState,
  rng: () => number,
  legal: Move[],
): Move {
  const me = state.currentPlayer;
  const wins = getWinningMoves(state, me);
  if (wins.length > 0) return pick(rng, wins);
  const opp = other(me);
  const oppThreats = getThreats(state, opp);
  if (oppThreats.length > 0) {
    const blockMove = legal.find((m) =>
      oppThreats.some((t) => m.to === t.to),
    );
    if (blockMove) return blockMove;
  }
  // Minimax + Alpha-Beta profundidade 8 com memoização leve
  const DEPTH = 8;
  const memo = new Map<string, number>();
  let bestScore = -Infinity;
  let bestMoves: Move[] = [];
  // Ordenação: priorizar centro e capturas de ameaças
  const ordered = orderMoves(legal, state);
  for (const mv of ordered) {
    const { state: child } = applyMove(state, mv);
    const score = -minimaxAB(child, DEPTH - 1, -Infinity, Infinity, memo);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [mv];
    } else if (score === bestScore) {
      bestMoves.push(mv);
    }
  }
  return pick(rng, bestMoves.length > 0 ? bestMoves : legal);
}

function orderMoves(moves: Move[], state: GameState): Move[] {
  const me = state.currentPlayer;
  // Pontuar cada movimento: vitória > centro > ameaça > resto
  const scored = moves.map((m) => {
    let s = 0;
    if (m.to === 5) s += 10;
    // Verificar se cria ameaça
    const { state: child } = applyMove(state, m);
    const myThreats = getThreats(child, me);
    s += myThreats.length * 5;
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.m);
}

// ============ PERFEITO ============

function choosePerfect(
  state: GameState,
  rng: () => number,
  legal: Move[],
): Move {
  const me = state.currentPlayer;
  // 1. Ganhar imediatamente
  const wins = getWinningMoves(state, me);
  if (wins.length > 0) {
    // Escolher a vitória mais rápida
    return wins[0];
  }
  // 2. Usar a tabela do solver: escolher o movimento que leva ao melhor resultado
  //    (WIN mais rápida; se não, DRAW evitando repetições; se não, LOSS mais lenta)
  let bestOutcome = -3; // -2 = loss, -1 = draw (slow), 0 = draw (fast), 1 = win (fast)
  let bestDist = 0;
  let bestMoves: Move[] = [];
  for (const mv of legal) {
    const { state: child } = applyMove(state, mv);
    if (isGameOver(child)) {
      // Se o jogo terminou e o vencedor é `me`, é WIN
      if (child.winner === me) {
        // WIN em 1 ply
        const candidate = { outcome: 'WIN' as const, dist: 1 };
        const rank = rankOutcome(candidate);
        if (rank > bestOutcome || (rank === bestOutcome && candidate.dist < bestDist)) {
          bestOutcome = rank;
          bestDist = candidate.dist;
          bestMoves = [mv];
        } else if (rank === bestOutcome && candidate.dist === bestDist) {
          bestMoves.push(mv);
        }
      }
      continue;
    }
    const solved = solvePosition(child);
    // O solver dá o resultado do ponto de vista do jogador a jogar (child.currentPlayer = oponente).
    // Se o oponente está em LOSS, eu (me) estou em WIN.
    const myOutcome =
      solved.outcome === 'WIN'
        ? 'LOSS'
        : solved.outcome === 'LOSS'
          ? 'WIN'
          : 'DRAW';
    const candidate = { outcome: myOutcome, dist: solved.distance };
    const rank = rankOutcome(candidate);
    if (rank > bestOutcome || (rank === bestOutcome && candidate.dist < bestDist)) {
      bestOutcome = rank;
      bestDist = candidate.dist;
      bestMoves = [mv];
    } else if (rank === bestOutcome && candidate.dist === bestDist) {
      bestMoves.push(mv);
    }
  }
  return pick(rng, bestMoves.length > 0 ? bestMoves : legal);
}

function rankOutcome(o: { outcome: string; dist: number }): number {
  if (o.outcome === 'WIN') return 2; // vitória — preferir dist menor
  if (o.outcome === 'DRAW') return 1; // empate — preferir dist maior (evitar pressa)
  return 0; // derrota — preferir dist maior (adiar)
}

// ============ MINIMAX (Médio) ============

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  if (isGameOver(state)) {
    // Retornar do ponto de vista de `state.currentPlayer` (que NÃO é quem ganhou se houve WIN)
    if (state.winner === state.currentPlayer) return 1000 + depth;
    if (state.winner && state.winner !== state.currentPlayer) return -1000 - depth;
    return 0; // empate
  }
  if (depth === 0) return evaluate(state);
  const me = state.currentPlayer;
  const legal = getLegalMoves(state, me);
  if (legal.length === 0) return evaluate(state);
  // Verificar vitória imediata
  const wins = getWinningMoves(state, me);
  if (wins.length > 0) return 1000 + depth;
  let best = -Infinity;
  for (const mv of legal) {
    const { state: child } = applyMove(state, mv);
    // Negamax: o valor para `me` é -valor para o oponente
    const score = -minimax(child, depth - 1, -beta, -alpha, !maximizing);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// ============ MINIMAX + ALPHA-BETA (Difícil) ============

function minimaxAB(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  memo: Map<string, number>,
): number {
  if (isGameOver(state)) {
    if (state.winner === state.currentPlayer) return 1000 + depth;
    if (state.winner && state.winner !== state.currentPlayer) return -1000 - depth;
    return 0;
  }
  if (depth === 0) return evaluate(state);
  const key = `${state.board.join('')}|${state.currentPlayer}|${depth}`;
  if (memo.has(key)) return memo.get(key)!;
  const me = state.currentPlayer;
  const legal = getLegalMoves(state, me);
  if (legal.length === 0) return evaluate(state);
  const wins = getWinningMoves(state, me);
  if (wins.length > 0) {
    const v = 1000 + depth;
    memo.set(key, v);
    return v;
  }
  let best = -Infinity;
  const ordered = orderMoves(legal, state);
  for (const mv of ordered) {
    const { state: child } = applyMove(state, mv);
    const score = -minimaxAB(child, depth - 1, -beta, -alpha, memo);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  memo.set(key, best);
  return best;
}

/**
 * Função de avaliação heurística (perspetiva do jogador atual).
 * Componentes: centro, ameaças, linhas abertas, mobilidade.
 */
function evaluate(state: GameState): number {
  const me = state.currentPlayer;
  const opp = other(me);
  let score = 0;
  // Centro (casa 5)
  if (state.board[4] === me) score += 30;
  if (state.board[4] === opp) score -= 30;
  // Ameaças (vitórias imediatas possíveis)
  const myThreats = getThreats(state, me).length;
  const oppThreats = getThreats(state, opp).length;
  score += myThreats * 50;
  score -= oppThreats * 60;
  // Mobilidade
  const myMoves = getLegalMoves(state, me).length;
  const oppMoves = getLegalMoves(state, opp).length;
  score += (myMoves - oppMoves) * 2;
  // Linhas abertas (2 peças + casa vazia)
  for (const line of [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9],
    [1, 5, 9],
    [3, 5, 7],
  ] as const) {
    const cells = line.map((s) => state.board[s - 1]);
    const myCount = cells.filter((c) => c === me).length;
    const oppCount = cells.filter((c) => c === opp).length;
    const emptyCount = cells.filter((c) => c === null).length;
    if (oppCount === 0 && myCount === 2 && emptyCount === 1) score += 10;
    if (myCount === 0 && oppCount === 2 && emptyCount === 1) score -= 12;
    if (oppCount === 0 && myCount === 3) score += 0; // já venceu
  }
  return score;
}
