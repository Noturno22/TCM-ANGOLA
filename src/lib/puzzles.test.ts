import { describe, it, expect } from 'vitest';
import {
  applyMove,
  validateMove,
  DEFAULT_CONFIG,
  type GameState,
  type PlayerId,
  type Cell,
} from '@tira/engine';
import { PUZZLES } from './puzzles';

function makePuzzleState(board: Cell[], player: PlayerId): GameState {
  return {
    board,
    currentPlayer: player,
    status: player === 'P1' ? 'PLAYER_1_TURN' : 'PLAYER_2_TURN',
    winner: null,
    winningLine: null,
    moveCount: 0,
    history: [],
    positionCounts: {},
    config: DEFAULT_CONFIG,
  };
}

describe('Desafios Diários', () => {
  for (const puzzle of PUZZLES) {
    it(`${puzzle.id} (${puzzle.title}): a solução é legal e vence`, () => {
      const state = makePuzzleState(puzzle.board, puzzle.turn as PlayerId);
      const result = validateMove(state, puzzle.solution, 'P1');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const { state: next } = applyMove(state, puzzle.solution);
      expect(next.status).toBe('WIN_P1');
    });
  }
});
