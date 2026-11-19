import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, type Cell, type GameState, type PlayerId } from '@tira/engine';
import { isTrappedInMiddle, CENTER_SQUARE } from './cocoDoMeio';

function makeState(board: Cell[], player: PlayerId): GameState {
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

/** Coloca as peças a partir de sets de casas (1-9); restantes vazias. */
function boardFrom(p1: number[], p2: number[]): Cell[] {
  const board: Cell[] = Array(9).fill(null);
  for (const sq of p1) board[sq - 1] = 'P1';
  for (const sq of p2) board[sq - 1] = 'P2';
  return board;
}

describe('isTrappedInMiddle', () => {
  it('true: peça no meio e só há jogadas a sair do meio (P1 em 1,3,5; P2 em 2,4,6)', () => {
    // P1@1 e P1@3 bloqueadas (vizinhas todas ocupadas); só P1@5 tem jogadas.
    const state = makeState(boardFrom([1, 3, 5], [2, 4, 6]), 'P1');
    expect(isTrappedInMiddle(state)).toBe(true);
  });

  it('false: existe jogada de outra peça (P2 em 2,4,7 → P1 pode ir 3→6)', () => {
    const state = makeState(boardFrom([1, 3, 5], [2, 4, 7]), 'P1');
    expect(isTrappedInMiddle(state)).toBe(false);
  });

  it('false: jogador sem peça no meio', () => {
    const state = makeState(boardFrom([1, 3, 7], [2, 4, 6]), 'P1');
    expect(isTrappedInMiddle(state)).toBe(false);
  });

  it('false: jogo terminado', () => {
    const state = { ...makeState(boardFrom([1, 3, 5], [2, 4, 6]), 'P1'), status: 'WIN_P1' as const };
    expect(isTrappedInMiddle(state)).toBe(false);
  });

  it('false: sem movimentos legais (tabuleiro cheio)', () => {
    const state = makeState(boardFrom([1, 3, 5], [2, 4, 6, 7, 8, 9]), 'P1');
    expect(isTrappedInMiddle(state)).toBe(false);
  });

  it('true (espelho): P2 encurralada no meio (P2 em 5,7,9; P1 em 4,6,8)', () => {
    const state = makeState(boardFrom([4, 6, 8], [5, 7, 9]), 'P2');
    expect(isTrappedInMiddle(state)).toBe(true);
  });

  it('exporta a casa central correta', () => {
    expect(CENTER_SQUARE).toBe(5);
  });
});
