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
        'relative rounded-2xl gold-frame p-3 sm:p-4',
        'bg-gradient-to-br from-surface to-background',
        colorblindMode && 'colorblind',
      )}
      role="grid"
      aria-label="Tabuleiro de Tira o Cocó do Meio, 3 por 3 casas"
    >
      {/* Padrão angolano decorativo nos cantos */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden opacity-20">
        <div className="absolute -top-2 -left-2 w-10 h-10 angolan-diamond" />
        <div className="absolute -top-2 -right-2 w-10 h-10 angolan-diamond" />
        <div className="absolute -bottom-2 -left-2 w-10 h-10 angolan-diamond" />
        <div className="absolute -bottom-2 -right-2 w-10 h-10 angolan-diamond" />
      </div>

      <div className={cn('relative grid grid-cols-3 grid-rows-3 gap-1.5 sm:gap-2', sizeClasses[size])}>
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
                'relative flex items-center justify-center rounded-xl',
                'transition-all duration-200',
                'aspect-square',
                'group',
                // Fundo da casa
                'bg-gradient-to-br from-background/60 to-surface-2/40',
                'border border-border/40',
                // Hover
                !disabled && 'hover:border-gold/50 hover:from-surface-2/60',
                // Seleção
                isSelected && 'ring-2 ring-gold ring-offset-2 ring-offset-background',
                // Destino válido
                valid && 'ring-2 ring-p1/70 cursor-pointer hover:scale-[1.03]',
                // Vitória
                win && 'bg-gold/20 border-gold',
                // Ameaça (tutorial)
                threat && !valid && 'ring-2 ring-p2/50 animate-pulse-glow',
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
    sm: 'w-8 h-8',
    md: 'w-11 h-11 sm:w-12 sm:h-12',
    lg: 'w-14 h-14 sm:w-16 sm:h-16',
  };
  const isP1 = player === 'P1';
  return (
    <div
      className={cn(
        'relative rounded-full flex items-center justify-center',
        dims[size],
        isP1 ? 'piece-glow-p1 bg-gradient-to-br from-p1 to-emerald-700' : 'piece-glow-p2 bg-gradient-to-br from-p2 to-red-900',
        'piece-' + (isP1 ? 'p1' : 'p2'),
        selected && 'ring-2 ring-gold ring-offset-2 ring-offset-transparent scale-110',
        winning && 'scale-125',
      )}
      style={{
        background: isP1
          ? 'radial-gradient(circle at 30% 30%, oklch(0.78 0.2 152), oklch(0.55 0.18 152) 60%, oklch(0.4 0.12 152))'
          : 'radial-gradient(circle at 30% 30%, oklch(0.7 0.22 27), oklch(0.5 0.22 27) 60%, oklch(0.35 0.15 27))',
      }}
    >
      {/* Realce especular */}
      <div
        className="absolute top-1 left-1 w-1/3 h-1/3 rounded-full bg-white/50 blur-[1px]"
        aria-hidden
      />
      {/* Símbolo gravado (spec §27: peças não se distinguem só pela cor) */}
      {withSymbol && (
        <span
          className={cn(
            'relative font-bold text-white/90 drop-shadow',
            size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : 'text-2xl',
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
