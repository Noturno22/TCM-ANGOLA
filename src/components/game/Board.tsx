'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { Cell, Move, PlayerId, Square } from '@tira/engine';
import { useSettings } from '@/store/settings';
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

const ORDER: readonly Square[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

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

const BOARD_W = 1520;
const BOARD_H = 1034;
const ROW_FY = [0.122, 0.361, 0.638] as const;
const COL_FX = [
  [0.301, 0.501, 0.703],
  [0.276, 0.501, 0.731],
  [0.247, 0.501, 0.764],
] as const;
const PIECE_BASE_DY = 0.07;
const PIECE_W_FRAC = 0.095;
const SPHERE_DY = 0.775;
const SPHERE_R_FRAC = 0.42;
const STAND_MID_DY = PIECE_BASE_DY / 2;

const PIECE_SRC: Record<PlayerId, string> = {
  P1: '/board/p1v.png',
  P2: '/board/p1r.png',
};

const PIECE_ASPECT: Record<PlayerId, number> = {
  P1: 985 / 759,
  P2: 991 / 730,
};

const GOLD = '#F2B01E';
const RED = '#ED3237';
const GREEN = '#10B25A';
const DASH = 'rgba(55, 52, 53, 0.3)';

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
  const { reduceMotion } = useSettings();
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState<number | null>(null);
  const preset = { sm: 280, md: 360, lg: 440 }[size];
  const total = containerW == null ? preset : Math.min(preset, containerW);
  const height = (total * BOARD_H) / BOARD_W;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerW((prev) => (prev != null && Math.abs(prev - w) < 0.5 ? prev : w));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isWinCell = (sq: number) => winningLine?.includes(sq as Square) ?? false;
  const isValidTarget = (sq: number) => validTargets.includes(sq as Square);
  const isThreat = (sq: number) =>
    !isValidTarget(sq) && threatSquares.includes(sq as Square);

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
    const timer = setTimeout(() => setAnimMove(null), 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [lastMove, reduceMotion, board]);

  const squarePoint = useMemo(
    () => (square: Square) => {
      const display = flipped ? square : ((10 - square) as Square);
      const { row, col } = SQUARE_POS[display];
      return { row, col, x: COL_FX[row][col] * total, y: ROW_FY[row] * height };
    },
    [flipped, total, height],
  );

  const pieceW = PIECE_W_FRAC * total;
  const cellSize = total / 3;
  const tintR = 0.33 * cellSize;
  const glowR = 0.3 * cellSize;
  const dashR = ((1 - 2 * 0.3) / 2) * cellSize;
  const validDotR = Math.max(4, total * 0.0194);
  const ringStroke = Math.max(1.5, total * 0.0056);
  const dashStroke = Math.max(1, total * 0.0028);

  const rowBands = [
    0,
    (ROW_FY[0] + ROW_FY[1]) / 2,
    (ROW_FY[1] + ROW_FY[2]) / 2,
    1,
  ];

  const cellRect = (row: number, col: number) => {
    const fx = COL_FX[row];
    const left = (col === 0 ? 0 : (fx[col - 1] + fx[col]) / 2) * total;
    const right = (col === 2 ? 1 : (fx[col] + fx[col + 1]) / 2) * total;
    return {
      left,
      top: rowBands[row] * height,
      width: right - left,
      height: (rowBands[row + 1] - rowBands[row]) * height,
    };
  };

  const animRect = animMove
    ? (() => {
        const from = squarePoint(animMove.from);
        const to = squarePoint(animMove.to);
        const ph = PIECE_ASPECT[animMove.player] * pieceW;
        const fromBase = (ROW_FY[from.row] + PIECE_BASE_DY) * height;
        const toBase = (ROW_FY[to.row] + PIECE_BASE_DY) * height;
        return {
          left: from.x - pieceW / 2,
          top: fromBase - ph,
          width: pieceW,
          height: ph,
          dx: to.x - from.x,
          dy: toBase - fromBase,
        };
      })()
    : null;

  return (
    <div
      ref={wrapperRef}
      className={cn('relative w-full select-none', {
        'max-w-[280px]': size === 'sm',
        'max-w-[360px]': size === 'md',
        'max-w-[440px]': size === 'lg',
      })}
      style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
      role="grid"
      aria-label="Tabuleiro de Tira o Cocó do Meio, 3 por 3 casas"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-6%] left-[4%] right-[4%] z-0 h-[15%] rounded-[50%] bg-[#2dff7e] opacity-25 blur-2xl"
      />
      <BoardRings uid={uid} reduceMotion={reduceMotion} />

      <div className="absolute inset-0 z-10" style={{ width: total, height }}>
        <Image
          src="/board/Tabuleiro.png"
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 440px"
          draggable={false}
          className="pointer-events-none object-fill"
          priority
        />

        <svg
          className="pointer-events-none absolute inset-0"
          width={total}
          height={height}
          viewBox={`0 0 ${total} ${height}`}
          aria-hidden
          focusable="false"
        >
          <defs>
            <radialGradient id={`${uid}-tint-sel`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor={GOLD} stopOpacity="0.14" />
              <stop offset="0.6" stopColor={GOLD} stopOpacity="0.07" />
              <stop offset="1" stopColor={GOLD} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${uid}-tint-win`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor={GOLD} stopOpacity="0.16" />
              <stop offset="0.6" stopColor={GOLD} stopOpacity="0.08" />
              <stop offset="1" stopColor={GOLD} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${uid}-tint-threat`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor={RED} stopOpacity="0.1" />
              <stop offset="0.6" stopColor={RED} stopOpacity="0.05" />
              <stop offset="1" stopColor={RED} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${uid}-win-glow`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor={GOLD} stopOpacity="0" />
              <stop offset="0.55" stopColor={GOLD} stopOpacity="0" />
              <stop offset="0.63" stopColor={GOLD} stopOpacity="0.55" />
              <stop offset="0.7" stopColor={GOLD} stopOpacity="0.55" />
              <stop offset="1" stopColor={GOLD} stopOpacity="0" />
            </radialGradient>
          </defs>

          {ORDER.map((square) => {
            const cell = board[square - 1];
            const p = squarePoint(square);
            const selected = selectedSquare === square;
            const valid = isValidTarget(square);
            const win = isWinCell(square);
            const threat = isThreat(square);
            const fromLast = lastMove?.from === square;

            const tint = threat
              ? `url(#${uid}-tint-threat)`
              : win
                ? `url(#${uid}-tint-win)`
                : selected
                  ? `url(#${uid}-tint-sel)`
                  : null;
            const standY = p.y + STAND_MID_DY * height;
            const baseY = (ROW_FY[p.row] + PIECE_BASE_DY) * height;
            const sphereY = baseY - SPHERE_DY * PIECE_ASPECT[cell ?? 'P1'] * pieceW;

            return (
              <g key={square}>
                {tint && <circle cx={p.x} cy={standY} r={tintR} fill={tint} />}
                {win && (
                  <motion.circle
                    cx={p.x}
                    cy={standY}
                    r={glowR}
                    fill={`url(#${uid}-win-glow)`}
                    initial={{ opacity: 0.7 }}
                    animate={reduceMotion ? { opacity: 0.8 } : { opacity: [0.6, 1, 0.6] }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                    }
                  />
                )}
                {selected && cell && (
                  <circle
                    cx={p.x}
                    cy={sphereY}
                    r={SPHERE_R_FRAC * pieceW}
                    fill="none"
                    stroke={GOLD}
                    strokeWidth={ringStroke}
                  />
                )}
                {valid && !cell && (
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r={validDotR}
                    fill={GREEN}
                    initial={{ opacity: 1 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.5, 1] }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                    }
                  />
                )}
                {fromLast && !cell && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={dashR}
                    fill="none"
                    stroke={DASH}
                    strokeWidth={dashStroke}
                    strokeDasharray="4 4"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {ORDER.map((square) => {
          const cell = board[square - 1];
          const p = squarePoint(square);
          const valid = isValidTarget(square);
          return (
            <button
              key={square}
              type="button"
              role="gridcell"
              disabled={disabled && !valid}
              aria-label={getCellLabel(square, cell, square === 5, selectedSquare === square, valid)}
              onClick={() => onSquareClick(square)}
              className={cn(
                'absolute flex items-center justify-center rounded-lg outline-none',
                'hover:bg-white/[0.045] focus-visible:ring-2 focus-visible:ring-gold/70',
                disabled && 'pointer-events-none',
              )}
              style={cellRect(p.row, p.col)}
            />
          );
        })}

        <div className="pointer-events-none absolute inset-0 z-20">
          {ORDER.map((square) => {
            const cell = board[square - 1];
            if (!cell) return null;
            if (animMove && animMove.to === square) return null;
            const p = squarePoint(square);
            const isSelected = selectedSquare === square;
            const win = isWinCell(square);
            const scale =
              isSelected || win ? 1.1 : lastMove?.to === square && !win ? 1.05 : 1;
            const ph = PIECE_ASPECT[cell] * pieceW;
            const baseY = (ROW_FY[p.row] + PIECE_BASE_DY) * height;
            return (
              <Image
                key={square}
                src={PIECE_SRC[cell]}
                alt=""
                width={pieceW}
                height={ph}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: p.x - pieceW / 2,
                  top: baseY - ph,
                  width: pieceW,
                  height: ph,
                  transform: `scale(${scale})`,
                }}
              />
            );
          })}

          <AnimatePresence>
            {animMove && animRect && (
              <motion.div
                key="anim-piece"
                className="absolute"
                style={{
                  left: animRect.left,
                  top: animRect.top,
                  width: animRect.width,
                  height: animRect.height,
                }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: animRect.dx, y: animRect.dy }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: 'easeOut' }}
              >
                <Image
                  src={PIECE_SRC[animMove.player]}
                  alt=""
                  width={animRect.width}
                  height={animRect.height}
                  draggable={false}
                  className="h-full w-full"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function BoardRings({ uid, reduceMotion }: { uid: string; reduceMotion: boolean }) {
  return (
    <svg
      className="pointer-events-none absolute -inset-[8%] z-0"
      viewBox="0 0 400 400"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2dff7e" stopOpacity="0.95" />
          <stop offset="0.26" stopColor="#2dff7e" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#2dff7e" stopOpacity="0.08" />
          <stop offset="0.74" stopColor="#2dff7e" stopOpacity="0.28" />
          <stop offset="1" stopColor="#2dff7e" stopOpacity="0.95" />
        </linearGradient>
        <filter id={`${uid}-ringBlur`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <circle
        cx="200"
        cy="200"
        r="176"
        fill="none"
        stroke={`url(#${uid}-ring)`}
        strokeWidth="11"
        filter={`url(#${uid}-ringBlur)`}
        opacity="0.45"
      />
      <circle
        cx="200"
        cy="200"
        r="165"
        fill="none"
        stroke={`url(#${uid}-ring)`}
        strokeWidth="3"
        opacity="0.6"
      />
      <circle
        cx="200"
        cy="200"
        r="151"
        fill="none"
        stroke="#2dff7e"
        strokeOpacity="0.2"
        strokeWidth="1.5"
        strokeDasharray="6 15"
        className={cn(!reduceMotion && 'arena-spin')}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
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
