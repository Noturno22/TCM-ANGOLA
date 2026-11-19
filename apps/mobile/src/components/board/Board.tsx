/**
 * Tira o Cocó do Meio — Tabuleiro nativo (React Native)
 *
 * Tabuleiro renderizado a partir dos assets PNG fornecidos:
 *  - fundo: `assets/images/Tabuleiro.png` (1520×1034, perspetiva trapezoidal)
 *  - peças: `assets/images/p/p1v.png` (P1 verde) e `p1r.png` (P2 vermelho)
 *  - âncoras das casas = interseções das linhas prateadas do PNG, medidas por
 *    pixel-scanning e calibradas com `referencia.png`
 *
 * Camadas: imagem de fundo → Svg de estados (tint/anéis/pontos) → camada de
 * toque (9 Pressable) → peças PNG (com animação da última jogada, port do
 * Board web: animMove 260ms + timeout 300ms).
 *
 * RENDER PURO do `GameState` — nunca reimplementa regras (regra de ouro:
 * packages/engine). API `BoardProps` intacta (10 ecrãs usam o componente).
 */
import { forwardRef, Fragment, useEffect, useState, type ComponentProps } from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';
import type { ImageSourcePropType, LayoutChangeEvent } from 'react-native';
import { Circle, Defs, RadialGradient, Stop, Svg } from 'react-native-svg';
import type { Cell, GameState, Move, PlayerId, Square, Threat } from '@tira/engine';
import { boardGeometry, colors, squarePosition } from '@tira/design-tokens';
import { useSettings } from '@/store/settings';

export interface BoardProps {
  /** Estado real do motor (`@tira/engine`) — o tabuleiro só o visualiza. */
  state: GameState;
  /** Casa selecionada (1–9), se alguma. */
  selectedSquare?: Square | null;
  /** Movimentos legais do jogador atual (ex.: `getLegalMoves(state)`). */
  legalMoves?: readonly Move[];
  /** Última jogada aplicada (realça origem tracejada + anima destino). */
  lastMove?: Move | null;
  /** Ameaças ativas (ex.: `getThreats(state, player)`). */
  threats?: readonly Threat[];
  /** Inverter a perspetiva (peças do jogador de baixo). */
  flipped?: boolean;
  /** Símbolos já vêm gravados no PNG — mantido por API. */
  showSymbols?: boolean;
  /** Preset sm/md/lg (largura do tabuleiro em dp) ou largura numérica em dp. */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Toco numa casa. Sem esta prop o tabuleiro é puramente estático. */
  onSquarePress?: (square: Square) => void;
  testID?: string;
}

const ORDER: readonly Square[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Tabuleiro.png — dimensões nativas e frações de casa (pixel-scanning). */
const BOARD_W = 1520;
const BOARD_H = 1034;
/** Y das 3 linhas horizontais prateadas (frações da altura). */
const ROW_FY = [0.122, 0.361, 0.638] as const;
/** X das interseções com as verticais (que se abrem em perspetiva). */
const COL_FX = [
  [0.301, 0.501, 0.703],
  [0.276, 0.501, 0.731],
  [0.247, 0.501, 0.764],
] as const;
/** Base da peça assenta 7% da altura abaixo da linha (calibrado c/ referencia). */
const PIECE_BASE_DY = 0.07;
/** Largura da peça como fração da largura do tabuleiro (~0.095 na referência). */
const PIECE_W_FRAC = 0.095;
/** Centro da esfera, fração da altura da peça medida da base. */
const SPHERE_DY = 0.775;
/** Raio da esfera (com halo) como fração da largura da peça. */
const SPHERE_R_FRAC = 0.42;
/** Tint/glow centrados no meio da zona de apoio (linha + meio do offset). */
const STAND_MID_DY = PIECE_BASE_DY / 2;

const PIECE_SRC: Record<PlayerId, ImageSourcePropType> = {
  P1: require('@/assets/images/p/p1v.png'),
  P2: require('@/assets/images/p/p1r.png'),
};
/** Altura/largura das peças (p1v 759×985, p1r 730×991). */
const PIECE_ASPECT: Record<PlayerId, number> = {
  P1: 985 / 759,
  P2: 991 / 730,
};

function gridSizeFor(size: 'sm' | 'md' | 'lg' | number): number {
  if (typeof size === 'number') return size;
  return boardGeometry.gridSizePresets[size];
}

/** Casa → ponto de interseção no tabuleiro (frações → dp). */
function squarePoint(
  square: Square,
  flipped: boolean,
  width: number,
  height: number,
): { row: number; col: number; x: number; y: number } {
  const display = flipped ? square : ((10 - square) as Square);
  const { row, col } = squarePosition[display];
  return { row, col, x: COL_FX[row][col] * width, y: ROW_FY[row] * height };
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

/**
 * `Circle` que descarta `collapsable`: o `Animated.createAnimatedComponent`
 * do react-native-web injeta `collapsable: false` em todas as props e o
 * react-native-svg encaminha-as ao DOM, onde o React recusa atributos
 * não-booleanos (erro de console/web apontando para o JSX deste mapa).
 */
const SvgCircle = forwardRef<
  Circle,
  ComponentProps<typeof Circle> & { collapsable?: boolean }
>(function SvgCircle({ collapsable: _collapsable, ...rest }, ref) {
  return <Circle {...rest} ref={ref} />;
});
SvgCircle.displayName = 'SvgCircle';

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

export function Board({
  state,
  selectedSquare = null,
  legalMoves = [],
  lastMove = null,
  threats = [],
  flipped = false,
  size = 'md',
  onSquarePress,
  testID,
}: BoardProps) {
  const { reduceMotion } = useSettings();
  const board = state.board;
  const winLine = state.winningLine;

  /** Largura pedida pelo ecrã — o tabuleiro encolhe se o contentor for menor. */
  const preferred = gridSizeFor(size);
  const [containerW, setContainerW] = useState<number | null>(null);
  const total = containerW == null ? preferred : Math.min(preferred, containerW);
  const height = Math.round((total * BOARD_H) / BOARD_W);

  /** Encaixa ao contentor (largura medida no layout — nunca transborda). */
  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerW((prev) => (prev != null && Math.abs(prev - w) < 0.5 ? prev : w));
  };

  const validTargets: readonly Square[] =
    selectedSquare == null
      ? []
      : legalMoves.filter((m) => m.from === selectedSquare).map((m) => m.to);
  const threatSquares: readonly Square[] = threats.map((t) => t.to);

  const isWinCell = (sq: number) => winLine?.includes(sq as Square) ?? false;
  const isValidTarget = (sq: number) => validTargets.includes(sq as Square);
  const isThreat = (sq: number) =>
    !isValidTarget(sq) && threatSquares.includes(sq as Square);

  const hasWinGlow = winLine != null;
  const hasValidDot = validTargets.some((sq) => !board[sq - 1]);

  const glowOpacity = useState(() => new Animated.Value(0.7))[0];
  const dotOpacity = useState(() => new Animated.Value(1))[0];

  useEffect(() => {
    if (reduceMotion) {
      glowOpacity.setValue(0.7);
      dotOpacity.setValue(1);
      return;
    }
    const animations: Animated.CompositeAnimation[] = [];
    if (hasWinGlow) {
      glowOpacity.setValue(0.6);
      animations.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowOpacity, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.6,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ]),
        ),
      );
    } else {
      glowOpacity.setValue(0.7);
    }
    if (hasValidDot) {
      dotOpacity.setValue(1);
      animations.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(dotOpacity, {
              toValue: 0.5,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(dotOpacity, {
              toValue: 1,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ]),
        ),
      );
    } else {
      dotOpacity.setValue(1);
    }
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [hasWinGlow, hasValidDot, reduceMotion, glowOpacity, dotOpacity]);

  /* Animação da última jogada (port do web: from → to, 260ms / fim 300ms) */
  const [animMove, setAnimMove] = useState<{
    from: Square;
    to: Square;
    player: PlayerId;
  } | null>(null);
  const [animProgress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!lastMove || reduceMotion) {
      setAnimMove(null);
      return;
    }
    const player = board[lastMove.to - 1];
    if (!player) {
      setAnimMove(null);
      return;
    }
    animProgress.setValue(0);
    setAnimMove({ from: lastMove.from, to: lastMove.to, player });
    const anim = Animated.timing(animProgress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    anim.start();
    const timer = setTimeout(() => setAnimMove(null), 300);
    return () => {
      anim.stop();
      clearTimeout(timer);
    };
  }, [lastMove, reduceMotion, board, animProgress]);

  const pieceW = PIECE_W_FRAC * total;
  const cellSize = total / boardGeometry.gridSize;
  /** Bandas verticais de toque (meios entre linhas + extremos). */
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
    const top = rowBands[row] * height;
    const bottom = rowBands[row + 1] * height;
    return { left, top, width: right - left, height: bottom - top };
  };

  const animRect = animMove
    ? (() => {
        const fp = squarePoint(animMove.from, flipped, total, height);
        const tp = squarePoint(animMove.to, flipped, total, height);
        const fBase = (ROW_FY[fp.row] + PIECE_BASE_DY) * height;
        const tBase = (ROW_FY[tp.row] + PIECE_BASE_DY) * height;
        return {
          left: fp.x - pieceW / 2,
          top: fBase - PIECE_ASPECT[animMove.player] * pieceW,
          width: pieceW,
          height: PIECE_ASPECT[animMove.player] * pieceW,
          dx: tp.x - fp.x,
          dy: tBase - fBase,
        };
      })()
    : null;

  return (
    <View
      accessibilityLabel="Tabuleiro de Tira o Cocó do Meio, 3 por 3 casas"
      testID={testID}
      collapsable={false}
      onLayout={handleLayout}
      style={{ alignSelf: 'stretch', alignItems: 'center' }}
    >
      <View style={{ width: total, height }}>
        {/* 1. Fundo — Tabuleiro.png */}
        <Image
          source={require('@/assets/images/Tabuleiro.png')}
          resizeMode="stretch"
          style={{ position: 'absolute', left: 0, top: 0, width: total, height }}
        />

        {/* 2. Estados visuais (camada transparente sobre o fundo) */}
        <Svg
          pointerEvents="none"
          width={total}
          height={height}
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          <Defs>
            <RadialGradient id="tira-tint-sel" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={colors.gold} stopOpacity="0.14" />
              <Stop offset="0.6" stopColor={colors.gold} stopOpacity="0.07" />
              <Stop offset="1" stopColor={colors.gold} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="tira-tint-win" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={colors.gold} stopOpacity="0.16" />
              <Stop offset="0.6" stopColor={colors.gold} stopOpacity="0.08" />
              <Stop offset="1" stopColor={colors.gold} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="tira-tint-threat" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={colors.p2} stopOpacity="0.1" />
              <Stop offset="0.6" stopColor={colors.p2} stopOpacity="0.05" />
              <Stop offset="1" stopColor={colors.p2} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="tira-win-glow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#F2B01E" stopOpacity="0" />
              <Stop offset="0.55" stopColor="#F2B01E" stopOpacity="0" />
              <Stop offset="0.63" stopColor="#F2B01E" stopOpacity="0.55" />
              <Stop offset="0.7" stopColor="#F2B01E" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#F2B01E" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {ORDER.map((square) => {
            const cell = board[square - 1];
            const p = squarePoint(square, flipped, total, height);

            const isSelected = selectedSquare === square;
            const isValid = isValidTarget(square);
            const isWin = isWinCell(square);
            const isThreatSq = isThreat(square);
            const isFromLast = lastMove?.from === square;

            // Prioridade idêntica ao cn() do web: ameaça > vitória > seleção
            const tint = isThreatSq
              ? 'url(#tira-tint-threat)'
              : isWin
                ? 'url(#tira-tint-win)'
                : isSelected
                  ? 'url(#tira-tint-sel)'
                  : null;

            const standY = p.y + STAND_MID_DY * height;
            const baseY = (ROW_FY[p.row] + PIECE_BASE_DY) * height;
            const ph = PIECE_ASPECT[cell ?? 'P1'] * pieceW;
            const sphereY = baseY - SPHERE_DY * ph;
            const dashR = ((1 - 2 * boardGeometry.markerInset) / 2) * cellSize;
            const glowR = 0.3 * cellSize;
            const tintR = 0.33 * cellSize;

            return (
              <Fragment key={square}>
                {tint && <Circle cx={p.x} cy={standY} r={tintR} fill={tint} />}
                {isWin && (
                  <AnimatedCircle
                    cx={p.x}
                    cy={standY}
                    r={glowR}
                    fill="url(#tira-win-glow)"
                    opacity={glowOpacity}
                  />
                )}
                {isSelected && cell && (
                  <Circle
                    cx={p.x}
                    cy={sphereY}
                    r={SPHERE_R_FRAC * pieceW}
                    fill="none"
                    stroke={colors.gold}
                    strokeWidth={boardGeometry.ringStroke}
                  />
                )}
                {isValid && !cell && (
                  <AnimatedCircle
                    cx={p.x}
                    cy={p.y}
                    r={boardGeometry.validDotSize / 2}
                    fill={colors.boardValidDot}
                    opacity={dotOpacity}
                  />
                )}
                {isFromLast && !cell && (
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={dashR}
                    fill="none"
                    stroke={colors.boardLastMoveDash}
                    strokeWidth={boardGeometry.markerStroke}
                    strokeDasharray="4 4"
                  />
                )}
              </Fragment>
            );
          })}
        </Svg>

        {/* 3. Camada de toque — 9 casas */}
        {onSquarePress
          ? ORDER.map((square) => {
              const cell = board[square - 1];
              const p = squarePoint(square, flipped, total, height);
              const isSelected = selectedSquare === square;
              const isValid = isValidTarget(square);
              return (
                <Pressable
                  key={square}
                  onPress={() => onSquarePress(square)}
                  accessibilityRole="button"
                  accessibilityLabel={cellLabel(square, cell, isSelected, isValid)}
                  testID={testID ? `${testID}-sq-${square}` : undefined}
                  style={{
                    position: 'absolute',
                    ...cellRect(p.row, p.col),
                    backgroundColor: 'transparent',
                  }}
                />
              );
            })
          : null}

        {/* 4. Peças PNG (camada não-interativa por cima da toque) */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, width: total, height }}
        >
          {ORDER.map((square) => {
            const cell = board[square - 1];
            if (!cell) return null;
            if (animMove && animMove.to === square) return null;
            const p = squarePoint(square, flipped, total, height);
            const isSelected = selectedSquare === square;
            const isWin = isWinCell(square);
            const isToLast = lastMove?.to === square;
            const scale =
              isSelected || isWin
                ? boardGeometry.winningPieceScale
                : isToLast
                  ? boardGeometry.lastMovedPieceScale
                  : 1;
            const ph = PIECE_ASPECT[cell] * pieceW;
            const baseY = (ROW_FY[p.row] + PIECE_BASE_DY) * height;
            return (
              <Image
                key={square}
                source={PIECE_SRC[cell]}
                resizeMode="contain"
                style={{
                  position: 'absolute',
                  left: p.x - pieceW / 2,
                  top: baseY - ph,
                  width: pieceW,
                  height: ph,
                  transform: [{ scale }],
                }}
              />
            );
          })}

          {/* 5. Peça em movimento (animação da última jogada) */}
          {animMove && animRect ? (
            <Animated.Image
              key="anim-piece"
              source={PIECE_SRC[animMove.player]}
              resizeMode="contain"
              style={{
                position: 'absolute',
                left: animRect.left,
                top: animRect.top,
                width: animRect.width,
                height: animRect.height,
                transform: [
                  {
                    translateX: animProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, animRect.dx],
                    }),
                  },
                  {
                    translateY: animProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, animRect.dy],
                    }),
                  },
                ],
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
