import { getLegalMoves, isGameOver, type GameState, type PlayerId, type Square } from '@tira/engine';

export const CENTER_SQUARE: Square = 5;

export function isTrappedInMiddle(state: GameState): boolean {
  if (isGameOver(state)) return false;
  if (state.board[CENTER_SQUARE - 1] !== state.currentPlayer) return false;
  const moves = getLegalMoves(state, state.currentPlayer as PlayerId);
  if (moves.length === 0) return false;
  return moves.every((m) => m.from === CENTER_SQUARE);
}
