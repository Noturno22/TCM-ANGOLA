/**
 * Tira o Cocó do Meio — Tabuleiro nativo (React Native + react-native-svg)
 *
 * Port fiel de src/components/game/Board.tsx (protótipo web) para SVG nativo.
 * RENDER PURO e estático: o tabuleiro apenas visualiza o `GameState` recebido
 * — nunca reimplementa regras (regra de ouro: packages/engine).
 *
 * Cores, raios e geometria vêm de @tira/design-tokens.
 */

import { Circle, G, Rect, Svg, Text } from 'react-native-svg';
import type { Cell, GameState, Move, PlayerId, Square, Threat } from '@tira/engine';
import {
  boardGeometry,
  colors,
  radii,
  squarePosition,
  targetMark,
  typography,
} from '@tira/design-tokens';

export interface BoardProps {
  /** Estado real do motor (`@tira/engine`) — o tabuleiro só o visualiza. */
  state: GameState;
  /** Casa selecionada (1–9), se alguma. */
  selectedSquare?: Square | null;
  /** Movimentos legais do jogador atual (ex.: `getLegalMoves(state)`). */
  legalMoves?: readonly Move[];
  /** Última jogada aplicada (realça origem tracejada + destino). */
  lastMove?: Move | null;
  /** Ameaças ativas (ex.: `getThreats(state, player)`). */
  threats?: readonly Threat[];
  /** Inverter a perspetiva (peças do jogador de baixo). */
  flipped?: boolean;
  /** Mostrar ▲/● gravados nas peças (spec §27, omissão: ligado). */
  showSymbols?: boolean;
  /** Preset sm/md/lg (largura da grelha em dp) ou largura numérica em dp. */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Toco numa casa. Sem esta prop o tabuleiro é puramente estático. */
  onSquarePress?: (square: Square) => void;
  testID?: string;
}

const ORDER: readonly Square[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const FLIPPED_ORDER: readonly Square[] = [9, 8, 7, 6, 5, 4, 3, 2, 1];

const PIECE_SYMBOL: Record<PlayerId, string> = {
  P1: '▲',
  P2: '●',
};

function gridSizeFor(size: 'sm' | 'md' | 'lg' | number): number {
  if (typeof size === 'number') return size;
  return boardGeometry.gridSizePresets[size];
}

/** Casa → centro (x, y) no sistema de coordenadas do Svg. */
function squareCenter(
  square: Square,
  flipped: boolean,
  framePadding: number,
  cell: number,
  gap: number,
): { x: number; y: number } {
  const display = flipped ? ((10 - square) as Square) : square;
  const { row, col } = squarePosition[display];
  return {
    x: framePadding + col * (cell + gap) + cell / 2,
    y: framePadding + row * (cell + gap) + cell / 2,
  };
}

/** Rótulo de acessibilidade — igual à lógica do Board.tsx web. */
function cellLabel(
  square: Square,
  cellState: Cell,
  isSelected: boolean,
  isValidTarget: boolean,
): string {
  const pos = square === boardGeometry.centerSquare ? 'centro' : `casa ${square}`;
  if (cellState) {
    const owner = cellState === 'P1' ? 'Jogador 1' : 'Jogador 2';
    return `${pos}, ${owner}${isSelected ? ', selecionada' : ''}`;
  }
  return `${pos}, vazia${isValidTarget ? ', destino válido' : ''}`;
}

export function Board({
  state,
  selectedSquare = null,
  legalMoves = [],
  lastMove = null,
  threats = [],
  flipped = false,
  showSymbols = true,
  size = 'md',
  onSquarePress,
  testID,
}: BoardProps) {
  const board = state.board;
  const winLine = state.winningLine;
  const gridSize = gridSizeFor(size);
  const gap = boardGeometry.gap;
  const padding = boardGeometry.framePadding;
  const cell = (gridSize - 2 * gap) / 3;
  const total = gridSize + 2 * padding;

  const validTargets: readonly Square[] =
    selectedSquare == null
      ? []
      : legalMoves.filter((m) => m.from === selectedSquare).map((m) => m.to);
  const threatSquares: readonly Square[] = threats.map((t) => t.to);

  const order = flipped ? FLIPPED_ORDER : ORDER;

  return (
    <Svg
      width={total}
      height={total}
      viewBox={`0 0 ${total} ${total}`}
      testID={testID}
      accessibilityLabel="Tabuleiro de Tira o Cocó do Meio, 3 por 3 casas"
    >
      {/* Moldura: fundo + anel dourado (web: .board-frame + bg-surface-2) */}
      <G>
        <Rect
          x={0}
          y={0}
          width={total}
          height={total}
          rx={radii.lg}
          fill={colors.surfaceAlt}
        />
        <Rect
          x={boardGeometry.frameRingWidth / 2}
          y={boardGeometry.frameRingWidth / 2}
          width={total - boardGeometry.frameRingWidth}
          height={total - boardGeometry.frameRingWidth}
          rx={radii.lg}
          fill="none"
          stroke={colors.gold}
          strokeWidth={boardGeometry.frameRingWidth}
        />
        <Rect
          x={0.5}
          y={0.5}
          width={total - 1}
          height={total - 1}
          rx={radii.lg}
          fill="none"
          stroke="rgba(0, 0, 0, 0.10)"
          strokeWidth={1}
        />
      </G>

      {/* Casas */}
      <G>
        {order.map((square, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          const x = padding + col * (cell + gap);
          const y = padding + row * (cell + gap);
          const cellState = board[square - 1];
          const center = { x: x + cell / 2, y: y + cell / 2 };

          const isSelected = selectedSquare === square;
          const isValidTarget = validTargets.includes(square);
          const isWin = winLine?.includes(square) ?? false;
          const isThreat = !isValidTarget && threatSquares.includes(square);
          const isFromLast = lastMove?.from === square;
          const isToLast = lastMove?.to === square;
          const isCenterSquare =
            square === boardGeometry.centerSquare && cellState === null;

          // Prioridade visual igual ao Board.tsx web (cn: selecionado > vitória
          // > destino válido > ameaça > última jogada > base)
          let fill: string = colors.surface;
          if (isSelected) fill = colors.boardSelectedCell;
          else if (isWin) fill = colors.boardWinningCell;
          else if (isValidTarget) fill = colors.boardValidCell;
          else if (isThreat) fill = colors.boardThreatCell;
          else if (isToLast) fill = colors.boardLastMoveCell;

          return (
            <G key={square}>
              <Rect
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx={boardGeometry.cellRadius}
                fill={fill}
                stroke={isSelected ? colors.gold : isThreat ? colors.boardThreatRing : undefined}
                strokeWidth={isSelected ? 2 : isThreat ? 1 : 0}
                {...(onSquarePress
                  ? {
                      onPress: () => onSquarePress(square),
                      accessible: true,
                      accessibilityLabel: cellLabel(
                        square,
                        cellState,
                        isSelected,
                        isValidTarget,
                      ),
                      testID: testID ? `${testID}-sq-${square}` : undefined,
                    }
                  : {})}
              />

              {/* Alvo na casa central vazia (web: TargetMark) */}
              {isCenterSquare && (
                <G opacity={targetMark.opacity}>
                  <Circle
                    cx={center.x}
                    cy={center.y}
                    r={(targetMark.outerRadius / targetMark.viewBox) * targetMark.cellRatio * cell}
                    fill="none"
                    stroke={colors.gold}
                    strokeWidth={
                      (targetMark.strokeWidth / targetMark.viewBox) * targetMark.cellRatio * cell
                    }
                  />
                  <Circle
                    cx={center.x}
                    cy={center.y}
                    r={(targetMark.midRadius / targetMark.viewBox) * targetMark.cellRatio * cell}
                    fill="none"
                    stroke={colors.gold}
                    strokeWidth={
                      (targetMark.strokeWidth / targetMark.viewBox) * targetMark.cellRatio * cell
                    }
                  />
                  <Circle
                    cx={center.x}
                    cy={center.y}
                    r={(targetMark.innerRadius / targetMark.viewBox) * targetMark.cellRatio * cell}
                    fill={colors.gold}
                  />
                </G>
              )}

              {/* Ponto de destino válido (web: bg-p1/60) */}
              {isValidTarget && !cellState && (
                <Circle
                  cx={center.x}
                  cy={center.y}
                  r={(cell * boardGeometry.validDotDiameterRatio) / 2}
                  fill={colors.boardValidDot}
                />
              )}

              {/* Traço da origem da última jogada (web: borda tracejada gold/40) */}
              {isFromLast && !cellState && (
                <Rect
                  x={x + boardGeometry.lastMoveDashInset}
                  y={y + boardGeometry.lastMoveDashInset}
                  width={cell - 2 * boardGeometry.lastMoveDashInset}
                  height={cell - 2 * boardGeometry.lastMoveDashInset}
                  rx={radii.lg}
                  fill="none"
                  stroke={colors.boardLastMoveDash}
                  strokeWidth={1}
                  strokeDasharray={[4, 4]}
                />
              )}

              {/* Peça (esfera com realce especular — web: .piece-p1/.piece-p2) */}
              {cellState && (
                <Piece
                  cx={center.x}
                  cy={center.y}
                  cell={cell}
                  player={cellState}
                  showSymbol={showSymbols}
                  selected={isSelected}
                  winning={isWin}
                />
              )}
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

function Piece({
  cx,
  cy,
  cell,
  player,
  showSymbol,
  selected,
  winning,
}: {
  cx: number;
  cy: number;
  cell: number;
  player: PlayerId;
  showSymbol: boolean;
  selected: boolean;
  winning: boolean;
}) {
  const scale = winning
    ? boardGeometry.winningPieceScale
    : selected
      ? boardGeometry.selectedPieceScale
      : 1;
  const r = (cell * boardGeometry.pieceDiameterRatio * scale) / 2;
  const fill = player === 'P1' ? colors.p1 : colors.p2;

  return (
    <G>
      {/* Sombra de contacto */}
      <Circle cx={cx} cy={cy + r * 0.06} r={r} fill="rgba(0, 0, 0, 0.15)" />
      {/* Esfera */}
      <Circle cx={cx} cy={cy} r={r} fill={fill} stroke="rgba(0, 0, 0, 0.25)" strokeWidth={1} />
      {/* Realce especular (web: inset 0 2px 4px mais claro) */}
      <Circle cx={cx - r * 0.28} cy={cy - r * 0.28} r={r * 0.38} fill="rgba(255, 255, 255, 0.28)" />
      {/* Sombra interior inferior (web: inset 0 -2px 4px mais escuro) */}
      <Circle cx={cx} cy={cy + r * 0.4} r={r * 0.55} fill="rgba(0, 0, 0, 0.10)" />
      {/* Símbolo gravado (spec §27) */}
      {showSymbol && (
        <Text
          x={cx}
          y={cy}
          fontSize={r * 0.9}
          fontFamily={typography.fontFamily.body}
          fontWeight={typography.fontWeight.bold}
          fill="rgba(255, 255, 255, 0.9)"
          textAnchor="middle"
          alignmentBaseline="central"
        >
          {PIECE_SYMBOL[player]}
        </Text>
      )}
    </G>
  );
}
