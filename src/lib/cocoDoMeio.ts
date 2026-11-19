import { getLegalMoves, isGameOver, type GameState, type PlayerId, type Square } from '@tira/engine';

/** A casa 5 é o "meio" do tabuleiro (o cocó). */
export const CENTER_SQUARE: Square = 5;

/**
 * "Tira o Coco do Meio": o jogador da vez está com a peça no meio e
 * encurralado — todos os movimentos legais saem do meio (from === 5),
 * ou seja, a única jogada possível é tirar o cocó de casa.
 */
export function isTrappedInMiddle(state: GameState): boolean {
  if (isGameOver(state)) return false;
  if (state.board[CENTER_SQUARE - 1] !== state.currentPlayer) return false;
  const moves = getLegalMoves(state, state.currentPlayer as PlayerId);
  if (moves.length === 0) return false;
  return moves.every((m) => m.from === CENTER_SQUARE);
}
