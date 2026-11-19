'use client';

import { useEffect, useId, useMemo, useState } from 'react';
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

/** `#RRGGBB` + alpha hex (`00`-`FF`), ou `null` se a cor não for hex. */
function hexAlpha(hex: string, alpha: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : null;
}

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

  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  const bg = getBackground(backgroundId);
  const lineStyle = getLineStyle(lineStyleId);
  const pieceStyle = getPieceStyle(pieceStyleId);
  const metallic = lineStyle.id === 'line_solid';

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

  const lineGroupStyle: React.CSSProperties = {
    stroke: metallic ? `url(#${uid}-silver)` : lineStyle.stroke,
    strokeWidth: metallic ? 8 : lineStyle.strokeWidth,
    strokeLinecap: lineCap,
    strokeDasharray: lineStyle.strokeDasharray,
    ...(lineStyle.glow ? { filter: lineStyle.glow } : {}),
  };

  const lineOutlineStyle: React.CSSProperties = {
    stroke: 'rgba(0,0,0,0.55)',
    strokeWidth: (metallic ? 8 : lineStyle.strokeWidth) + 2.5,
    strokeLinecap: lineCap,
    strokeDasharray: lineStyle.strokeDasharray,
  };

  return (
    <div
      className={cn('relative', sizeClasses[size], colorblindMode && 'colorblind')}
      role="grid"
      aria-label="Tabuleiro de Tira o Cocó do Meio, 3 por 3 casas"
    >
      {/* Chão: brilho verde por baixo do tabuleiro */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-6%] left-[4%] right-[4%] z-0 h-[15%] rounded-[50%] bg-[#2dff7e] opacity-40 blur-2xl"
      />

      {/* Anéis neon atrás do tabuleiro */}
      <BoardRings uid={uid} reduceMotion={reduceMotion} />

      {/* Camada 3D — moldura dourada + interior */}
      <div className="absolute inset-0 z-10" style={{ perspective: '1400px' }}>
        <div
          className="absolute inset-0"
          style={{ transform: 'rotateX(5deg)', transformStyle: 'preserve-3d' }}
        >
          {/* Aresta escura externa (sombra + halo verde) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[26px]"
            style={{
              background: 'linear-gradient(180deg, #0c1310 0%, #040706 100%)',
              boxShadow:
                '0 26px 50px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.85), 0 0 32px rgba(45,255,120,0.32)',
            }}
          />

          {/* Banda dourada metálica */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[5px] rounded-[20px]"
            style={{
              background:
                'linear-gradient(148deg, #fdf0bd 0%, #e6c266 14%, #b98d2c 32%, #7a5a17 48%, #a97e26 62%, #f0d183 82%, #8a641a 100%)',
              boxShadow:
                'inset 0 1.5px 2px rgba(255,255,255,0.7), inset 0 -2px 5px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.6)',
            }}
          />

          {/* Acentos angulares dourados (setas laterais + cantos) */}
          <FrameAccents uid={uid} />

          {/* Interior */}
          <div
            className="absolute inset-[16px] rounded-[14px]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Superfície de jogo (cosmético) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]"
              style={{
                ...bg.css,
                boxShadow:
                  'inset 0 10px 24px rgba(0,0,0,0.72), inset 0 -6px 18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.65)',
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 34%)',
                }}
              />
            </div>

            {/* Linhas metálicas + brilho central */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 300 300"
              preserveAspectRatio="none"
              aria-hidden
              focusable="false"
            >
              <defs>
                <linearGradient id={`${uid}-silver`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f5f8f7" />
                  <stop offset="0.42" stopColor="#c6cdcb" />
                  <stop offset="0.58" stopColor="#939b99" />
                  <stop offset="1" stopColor="#5b6361" />
                </linearGradient>
                <radialGradient id={`${uid}-flare`}>
                  <stop offset="0" stopColor="#fff9d8" stopOpacity="0.95" />
                  <stop offset="0.35" stopColor="#ffd85e" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#ffcb2e" stopOpacity="0" />
                </radialGradient>
                <filter id={`${uid}-soft`} x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="2.6" />
                </filter>
              </defs>

              {/* Contorno escuro (profundidade) — só no estilo sólido */}
              {metallic && (
                <g style={lineOutlineStyle}>
                  <line x1="50" y1="50" x2="250" y2="50" />
                  <line x1="50" y1="150" x2="250" y2="150" />
                  <line x1="50" y1="250" x2="250" y2="250" />
                  <line x1="50" y1="50" x2="50" y2="250" />
                  <line x1="150" y1="50" x2="150" y2="250" />
                  <line x1="250" y1="50" x2="250" y2="250" />
                  <line x1="50" y1="50" x2="250" y2="250" />
                  <line x1="250" y1="50" x2="50" y2="250" />
                </g>
              )}

              <g style={lineGroupStyle}>
                <line x1="50" y1="50" x2="250" y2="50" />
                <line x1="50" y1="150" x2="250" y2="150" />
                <line x1="50" y1="250" x2="250" y2="250" />
                <line x1="50" y1="50" x2="50" y2="250" />
                <line x1="150" y1="50" x2="150" y2="250" />
                <line x1="250" y1="50" x2="250" y2="250" />
                <line x1="50" y1="50" x2="250" y2="250" />
                <line x1="250" y1="50" x2="50" y2="250" />
              </g>

              {/* Brilho quente no centro */}
              <g className="board-flare">
                <circle cx="150" cy="150" r="34" fill={`url(#${uid}-flare)`} />
                <path
                  d="M150 112 L154.8 145.2 L188 150 L154.8 154.8 L150 188 L145.2 154.8 L112 150 L145.2 145.2 Z"
                  fill="#fff8d6"
                  opacity="0.92"
                  filter={`url(#${uid}-soft)`}
                />
              </g>
            </svg>

            {/* Grelha de casas — camada interativa acima do decorativo */}
            <div className="absolute inset-0 z-10 grid grid-cols-3 grid-rows-3">
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
                      !disabled && 'hover:bg-white/[0.045]',
                      isSelected && 'bg-gold/[0.14]',
                      valid && !cell && 'cursor-pointer',
                      win && 'bg-gold/[0.16]',
                      threat && !valid && 'bg-p2/[0.1]',
                      pos.row === 0 && 'rounded-t-[14px]',
                      pos.row === 2 && 'rounded-b-[14px]',
                      pos.col === 0 && 'rounded-l-[14px]',
                      pos.col === 2 && 'rounded-r-[14px]',
                    )}
                    style={{
                      gridColumn: pos.col + 1,
                      gridRow: pos.row + 1,
                    }}
                  >
                    {isSelected && (
                      <span className="pointer-events-none absolute inset-[26%] rounded-full ring-2 ring-gold" />
                    )}

                    {valid && !cell && (
                      <span className="pointer-events-none absolute h-3.5 w-3.5 animate-pulse-glow rounded-full bg-p1" />
                    )}

                    {fromLast && !cell && (
                      <span className="pointer-events-none absolute inset-[30%] rounded-full border border-dashed border-white/25" />
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
        </div>
      </div>
    </div>
  );
}

/** Anéis neon verdes atrás do tabuleiro (SVG com glow). */
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
        opacity="0.7"
      />
      <circle
        cx="200"
        cy="200"
        r="165"
        fill="none"
        stroke={`url(#${uid}-ring)`}
        strokeWidth="3"
        opacity="0.9"
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

/** Setas/chanfros dourados sobre a moldura (esquerda, direita e cantos). */
function FrameAccents({ uid }: { uid: string }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      viewBox="0 0 300 300"
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-fgold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d5" />
          <stop offset="0.45" stopColor="#e9c05a" />
          <stop offset="1" stopColor="#8a641a" />
        </linearGradient>
      </defs>
      <g fill={`url(#${uid}-fgold)`} stroke="rgba(0,0,0,0.5)" strokeWidth="1">
        {/* Setas laterais a apontar para o interior */}
        <path d="M4 130 L26 150 L4 170 L12 150 Z" />
        <path d="M296 130 L274 150 L296 170 L288 150 Z" />
        {/* Chanfros diagonais: topo-esquerda e base-direita */}
        <path d="M8 46 L44 10 L52 19 L17 55 Z" />
        <path d="M292 254 L256 290 L248 281 L283 245 Z" />
      </g>
    </svg>
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
  const base =
    (typeof style.backgroundColor === 'string' && style.backgroundColor) ||
    (isP1 ? '#00A859' : '#ED3237');
  const glow = hexAlpha(base, 'b3');
  const cosmeticShadow =
    style.boxShadow && style.boxShadow !== 'none' ? `${style.boxShadow}, ` : '';
  const scale = selected || winning ? 1.1 : lastMoved ? 1.05 : 1;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full transition-transform duration-200',
        dims[size],
      )}
      style={{
        ...style,
        backgroundColor: base,
        backgroundImage:
          'radial-gradient(circle at 32% 24%, rgba(255,255,255,0.62), rgba(255,255,255,0.16) 32%, rgba(255,255,255,0) 58%),' +
          'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,0.3) 100%)',
        boxShadow:
          `${cosmeticShadow}` +
          `0 0 16px ${glow ?? 'transparent'}, 0 10px 14px rgba(0,0,0,0.45),` +
          'inset 0 -5px 9px rgba(0,0,0,0.38), inset 0 4px 8px rgba(255,255,255,0.32)',
        transform: `scale(${scale})`,
      }}
    >
      {withSymbol && (
        <svg
          viewBox="0 0 24 24"
          className={cn('relative text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]', symbol[size])}
          fill="currentColor"
          aria-hidden
        >
          {isP1 ? (
            <path
              d="M12 4.6 L21 19.4 H3 Z"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
          ) : (
            <rect x="5" y="5" width="14" height="14" rx="3.6" />
          )}
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
