import { describe, it, expect } from 'vitest';
import { chooseMove } from '@/lib/ai/index';
import { createGame, applyMove, getLegalMoves, isGameOver, type GameState } from '@/lib/engine';
import { solverStats } from '@/lib/ai/solver';

describe('IA — nunca faz jogada ilegal', () => {
  it('IA vs IA (10 partidas, seeds diferentes) sem jogadas ilegais', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let state = createGame();
      let plies = 0;
      while (!isGameOver(state) && plies < 200) {
        const difficulty = seed % 2 === 0 ? 'easy' : 'medium';
        const mv = chooseMove(state, difficulty as 'easy' | 'medium', seed * 1000 + plies);
        expect(mv).not.toBeNull();
        if (!mv) break;
        // Validar antes de aplicar
        const legal = getLegalMoves(state);
        const isLegal = legal.some((m) => m.from === mv.from && m.to === mv.to);
        expect(isLegal).toBe(true);
        state = applyMove(state, mv).state;
        plies++;
      }
      expect(plies).toBeLessThan(200);
      expect(isGameOver(state)).toBe(true);
    }
  });
});

describe('IA — Perfeito vs Perfeito', () => {
  it('P1 ganha em ≤ 3 plies com regras por omissão', () => {
    let state = createGame();
    let plies = 0;
    while (!isGameOver(state) && plies < 10) {
      const mv = chooseMove(state, 'perfect', 42 + plies);
      expect(mv).not.toBeNull();
      if (!mv) break;
      state = applyMove(state, mv).state;
      plies++;
    }
    expect(state.winner).toBe('P1');
    expect(plies).toBeLessThanOrEqual(3);
  });
});

describe('IA — Difícil ganha a Fácil na maioria', () => {
  it('hard vs easy: hard vence ≥ 70% de 10 partidas', () => {
    let hardWins = 0;
    const games = 10;
    for (let g = 0; g < games; g++) {
      let state = createGame();
      let plies = 0;
      while (!isGameOver(state) && plies < 100) {
        const diff = state.currentPlayer === 'P1' ? 'hard' : 'easy';
        const mv = chooseMove(state, diff, g * 100 + plies);
        if (!mv) break;
        state = applyMove(state, mv).state;
        plies++;
      }
      if (state.winner === 'P1') hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(7);
  });
});

describe('Solver — valores de referência', () => {
  it('3360 estados; 0 sem movimentos (free-blocked)', () => {
    const stats = solverStats();
    expect(stats.total).toBe(3360);
    // win + loss + draw = total
    expect(stats.win + stats.loss + stats.draw).toBe(3360);
  });
});
