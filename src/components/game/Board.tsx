'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Cell, Move, PlayerId, Square } from '@/lib/engine';
import { useSettings } from '@/store/settings';
import { cn } from '@/lib/utils';

interface BoardProps {
  board: readonly Cell[];
  selectedSquare: Square | null;
  validTargets: Square[];
  lastMove: Move | null;
  winningLine: readonly number[] | null;
  threatSquares: Square[]; // casas que completariam linha para o adversário (tutorial)
  onSquareClick: (sq: Square) => void;
  /** Inverter a perspetiva (as peças do utilizador ficam em baixo) */
  flipped?: boolean;
  /** Desativar interação */
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/** Mapeia casa (1-9) para posição no grid 3x3 (linha, coluna). */
const SQUARE_POS: Record<number, { row: number; col: number }> = {
  1: { row: 0, col: 0 },
  2: { row: 0, col: 1 },
  3: { row: 0, col: 2 },
  4: { row: 1, col: 0 },
  5: { row: 1, col: 1 },
  6: { row: 1, col: 2 },
  7: { row: 2, col: 0 },
  8: { row: 2, col: 1 },
  9: { row: 2, col: 2 },
};

export function Board({
  board,
  selectedSquare,
  validTargets,
  lastMove,
  winningLine,
  threatSquares,
  onSquareClick,
  flipped = false,
  disabled = false,
  size = 'md',
}: BoardProps) {
  const { symbolsOnPieces, reduceMotion, colorblindMode } = useSettings();

  const sizeClasses = {
    sm: 'w-full max-w-[280px] aspect-square',
    md: 'w-full max-w-[360px] aspect-square',
    lg: 'w-full max-w-[440px] aspect-square',
  };

  const cells = useMemo(() => {
    // Ordem das casas consoante flipped
    const order = flipped
      ? [9, 8, 7, 6, 5, 4, 3, 2, 1]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    return order;
  }, [flipped]);

  const isWinCell = (sq: number) =>
    winningLine?.includes(sq as Square) ?? false;
  const isValidTarget = (sq: number) =>
    validTargets.includes(sq as Square);
  const isThreat = (sq: number) => threatSquares.includes(sq as Square);
  const isLastMoveFrom = (sq: number) => lastMove?.from === sq;
  const isLastMoveTo = (sq: number) => lastMove?.to === sq;

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden board-frame p-2',
        'bg-surface-2',
        colorblindMode && 'colorblind',
      )}
      role="grid"
      aria-label="Tabuleiro de Tira o Cocó do Meio, 3 por 3 casas"
    >
      <div className={cn('relative grid grid-cols-3 grid-rows-3 gap-1', sizeClasses[size])}>
        {cells.map((sq) => {
          const cell = board[sq - 1];
          const isSelected = selectedSquare === sq;
          const valid = isValidTarget(sq);
          const win = isWinCell(sq);
          const threat = isThreat(sq);
          const isCenter = sq === 5;
          const fromLast = isLastMoveFrom(sq);
          const toLast = isLastMoveTo(sq);

          return (
            <button
              key={sq}
              type="button"
              role="gridcell"
              disabled={disabled && !valid}
              aria-label={getCellLabel(sq, cell, isCenter, isSelected, valid)}
              onClick={() => onSquareClick(sq as Square)}
              className={cn(
                'relative flex items-center justify-center rounded-md',
                'transition-colors duration-150',
                'aspect-square',
                // Fundo da casa — simples e limpo
                'bg-surface',
                // Hover
                !disabled && 'hover:bg-surface-2',
                // Seleção
                isSelected && 'bg-gold/20 ring-2 ring-gold',
                // Destino válido
                valid && 'bg-p1/10 cursor-pointer hover:bg-p1/20',
                // Vitória
                win && 'bg-gold/30',
                // Ameaça (tutorial)
                threat && !valid && 'bg-p2/10 ring-1 ring-p2/40',
                // Última jogada
                toLast && 'bg-p1/5',
              )}
              style={{
                gridColumn: SQUARE_POS[flipped ? (10 - sq) : sq].col + 1,
                gridRow: SQUARE_POS[flipped ? (10 - sq) : sq].row + 1,
              }}
            >
              {/* Casa central com alvo (bullseye) */}
              {isCenter && !cell && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <TargetMark />
                </div>
              )}

              {/* Indicador de destino válido */}
              {valid && !cell && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-p1/60 animate-pulse-glow" />
                </div>
              )}

              {/* Traço da última jogada */}
              {fromLast && !cell && (
                <div className="pointer-events-none absolute inset-1 rounded-lg border border-dashed border-gold/40" />
              )}

              {/* Peça */}
              <AnimatePresence mode="popLayout">
                {cell && (
                  <motion.div
                    key={`${sq}-${cell}`}
                    layoutId={`piece-${sq}-${cell}`}
                    initial={reduceMotion ? false : { scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={reduceMotion ? undefined : { scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="pointer-events-none"
                  >
                    <Piece
                      player={cell}
                      withSymbol={symbolsOnPieces}
                      size={size}
                      selected={isSelected}
                      winning={win}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Brilho da vitória */}
              {win && (
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  initial={{ boxShadow: '0 0 0 0 rgba(242,176,30,0)' }}
                  animate={{
                    boxShadow: [
                      '0 0 0 0 rgba(242,176,30,0.4)',
                      '0 0 24px 4px rgba(242,176,30,0.6)',
                      '0 0 0 0 rgba(242,176,30,0.4)',
                    ],
                  }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Piece({
  player,
  withSymbol,
  size,
  selected,
  winning,
}: {
  player: PlayerId;
  withSymbol: boolean;
  size: 'sm' | 'md' | 'lg';
  selected?: boolean;
  winning?: boolean;
}) {
  const dims = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10 sm:w-11 sm:h-11',
    lg: 'w-13 h-13 sm:w-15 sm:h-15',
  };
  const isP1 = player === 'P1';
  return (
    <div
      className={cn(
        'relative rounded-full flex items-center justify-center transition-transform',
        dims[size],
        isP1 ? 'piece-p1 bg-p1' : 'piece-p2 bg-p2',
        'piece-' + (isP1 ? 'p1' : 'p2'),
        selected && 'scale-110',
        winning && 'scale-125',
      )}
    >
      {/* Símbolo gravado (spec §27: peças não se distinguem só pela cor) */}
      {withSymbol && (
        <span
          className={cn(
            'relative font-bold text-white/90',
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-base' : 'text-xl',
          )}
          aria-hidden
        >
          {isP1 ? '▲' : '●'}
        </span>
      )}
    </div>
  );
}

function TargetMark() {
  return (
    <svg viewBox="0 0 40 40" className="w-1/2 h-1/2 opacity-60" aria-hidden>
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold" />
      <circle cx="20" cy="20" r="4" fill="currentColor" className="text-gold" />
    </svg>
  );
}

function getCellLabel(
  sq: number,
  cell: Cell,
  isCenter: boolean,
  isSelected: boolean,
  isValid: boolean,
): string {
  const pos = isCenter ? 'centro' : `casa ${sq}`;
  if (cell) {
    const owner = cell === 'P1' ? 'Jogador 1' : 'Jogador 2';
    return `${pos}, ${owner}${isSelected ? ', selecionada' : ''}`;
  }
  return `${pos}, vazia${isValid ? ', destino válido' : ''}`;
}
