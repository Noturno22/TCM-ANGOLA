'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Cell, Move, PlayerId, Square } from '@tira/engine';
import { useSettings } from '@/store/settings';
import { getBackground, getLineStyle, getPieceStyle } from '@/lib/cosmetics';
import { cn } from '@/lib/utils';

interface BoardProps {
  board: readonly Cell[];
  selectedSquare: Square | null;
  validTargets: Square[];
  lastMove: Move | null;
  winningLine: readonly number[] | null;
  threatSquares: Square[];
  onSquareClick: (sq: Square) => void;
  flipped?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

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
  const { symbolsOnPieces, reduceMotion, colorblindMode, backgroundId, lineStyleId, pieceStyleId } =
    useSettings();

  const bg = getBackground(backgroundId);
  const lineStyle = getLineStyle(lineStyleId);
  const pieceStyle = getPieceStyle(pieceStyleId);

  const sizeClasses = {
    sm: 'w-full max-w-[280px] aspect-square',
    md: 'w-full max-w-[360px] aspect-square',
    lg: 'w-full max-w-[440px] aspect-square',
  };

  const cells = useMemo(
    () => (flipped ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [7, 8, 9, 4, 5, 6, 1, 2, 3]),
    [flipped],
  );

  const cellPos = (sq: Square) => SQUARE_POS[flipped ? sq : 10 - sq];

  const posOf = (sq: Square) => {
    const p = cellPos(sq);
    return { left: `${(p.col / 3) * 100}%`, top: `${(p.row / 3) * 100}%` };
  };

  const [animMove, setAnimMove] = useState<{
    from: Square;
    to: Square;
    player: PlayerId;
  } | null>(null);

  useEffect(() => {
    if (!lastMove || reduceMotion) {
      const raf = requestAnimationFrame(() => setAnimMove(null));
      return () => cancelAnimationFrame(raf);
    }
    const player = board[lastMove.to - 1];
    if (!player) {
      const raf = requestAnimationFrame(() => setAnimMove(null));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() =>
      setAnimMove({ from: lastMove.from, to: lastMove.to, player }),
    );
    const t = setTimeout(() => setAnimMove(null), 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [lastMove, reduceMotion, board]);

  const isWinCell = (sq: number) => winningLine?.includes(sq as Square) ?? false;
  const isValidTarget = (sq: number) => validTargets.includes(sq as Square);
  const isThreat = (sq: number) => threatSquares.includes(sq as Square);
  const isLastMoveFrom = (sq: number) => lastMove?.from === sq;
  const isLastMoveTo = (sq: number) => lastMove?.to === sq;
  const isAnimDest = (sq: number) => animMove?.to === sq;
  const animFromCell = animMove ? cellPos(animMove.from) : null;
  const animToCell = animMove ? cellPos(animMove.to) : null;

  const lineCap = (lineStyle.strokeLinecap ?? 'round') as 'butt' | 'round' | 'square';

  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden',
        sizeClasses[size],
        colorblindMode && 'colorblind',
      )}
      style={{
        ...bg.css,
        boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.08)',
      }}
      role="grid"
      aria-label="Tabuleiro de Tira o Cocó do Meio, 3 por 3 casas"
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 300 300"
        preserveAspectRatio="none"
        aria-hidden
      >
        <g
          style={{
            stroke: lineStyle.stroke,
            strokeWidth: lineStyle.strokeWidth,
            strokeLinecap: lineCap,
            strokeDasharray: lineStyle.strokeDasharray,
            ...(lineStyle.glow ? { filter: lineStyle.glow } : {}),
          }}
        >
          <line x1="50" y1="50" x2="250" y2="50" />
          <line x1="50" y1="150" x2="250" y2="150" />
          <line x1="50" y1="250" x2="250" y2="250" />
          <line x1="50" y1="50" x2="50" y2="250" />
          <line x1="150" y1="50" x2="150" y2="250" />
          <line x1="250" y1="50" x2="250" y2="250" />
          <line x1="50" y1="50" x2="250" y2="250" />
          <line x1="250" y1="50" x2="50" y2="250" />
        </g>
      </svg>

      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {cells.map((sq) => {
          const cell = board[sq - 1];
          const isSelected = selectedSquare === sq;
          const valid = isValidTarget(sq);
          const win = isWinCell(sq);
          const threat = isThreat(sq);
          const fromLast = isLastMoveFrom(sq);
          const toLast = isLastMoveTo(sq);
          const pos = cellPos(sq as Square);

          return (
            <button
              key={sq}
              type="button"
              role="gridcell"
              disabled={disabled && !valid}
              aria-label={getCellLabel(sq, cell, sq === 5, isSelected, valid)}
              onClick={() => onSquareClick(sq as Square)}
              className={cn(
                'relative flex items-center justify-center',
                'transition-colors duration-150',
                !disabled && 'hover:bg-black/[0.035]',
                isSelected && 'bg-gold/[0.14]',
                valid && !cell && 'cursor-pointer',
                win && 'bg-gold/[0.16]',
                threat && !valid && 'bg-p2/[0.08]',
              )}
              style={{ gridColumn: pos.col + 1, gridRow: pos.row + 1 }}
            >
              {isSelected && (
                <span className="pointer-events-none absolute inset-[30%] rounded-full ring-2 ring-gold" />
              )}

              {valid && !cell && (
                <span className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-p1 animate-pulse-glow" />
              )}

              {fromLast && !cell && (
                <span className="pointer-events-none absolute inset-[30%] rounded-full border border-dashed border-[#373435]/30" />
              )}

              {cell && !isAnimDest(sq) && (
                <Piece
                  player={cell}
                  withSymbol={symbolsOnPieces}
                  size={size}
                  style={cell === 'P1' ? pieceStyle.p1 : pieceStyle.p2}
                  selected={isSelected}
                  winning={win}
                  lastMoved={toLast && !win}
                />
              )}

              {win && (
                <motion.span
                  className="pointer-events-none absolute inset-[12%] rounded-full"
                  initial={{ boxShadow: '0 0 0 0 rgba(242,176,30,0)' }}
                  animate={{
                    boxShadow: [
                      '0 0 0 0 rgba(242,176,30,0.35)',
                      '0 0 22px 4px rgba(242,176,30,0.55)',
                      '0 0 0 0 rgba(242,176,30,0.35)',
                    ],
                  }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {animMove && animFromCell && animToCell && (
          <motion.div
            key="moving-piece"
            className="pointer-events-none absolute z-20 flex items-center justify-center"
            style={{ width: '33.3333%', height: '33.3333%', ...posOf(animMove.to) }}
            initial={{
              x: `${(animFromCell.col - animToCell.col) * 100}%`,
              y: `${(animFromCell.row - animToCell.row) * 100}%`,
            }}
            animate={{ x: 0, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
          >
            <Piece
              player={animMove.player}
              withSymbol={symbolsOnPieces}
              size={size}
              style={animMove.player === 'P1' ? pieceStyle.p1 : pieceStyle.p2}
              winning={isWinCell(animMove.to)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Piece({
  player,
  withSymbol,
  size,
  style,
  selected,
  winning,
  lastMoved,
}: {
  player: PlayerId;
  withSymbol: boolean;
  size: 'sm' | 'md' | 'lg';
  style: React.CSSProperties;
  selected?: boolean;
  winning?: boolean;
  lastMoved?: boolean;
}) {
  const dims = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  const symbol = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };
  const isP1 = player === 'P1';
  return (
    <div
      className={cn(
        'relative rounded-full flex items-center justify-center transition-transform',
        dims[size],
        isP1 ? 'piece-p1' : 'piece-p2',
        selected && 'scale-110',
        winning && 'scale-110',
        lastMoved && 'scale-105',
      )}
      style={style}
    >
      {withSymbol && (
        <svg
          viewBox="0 0 24 24"
          className={cn('relative text-white/90', symbol[size])}
          fill="currentColor"
          aria-hidden
        >
          {isP1 ? <path d="M12 4 L21 20 H3 Z" /> : <circle cx="12" cy="12" r="8" />}
        </svg>
      )}
    </div>
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
