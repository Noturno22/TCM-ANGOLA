/**
 * Game — port do GameScreen web: partida offline completa (PvP / PvE / CvC /
 * Treino Livre) com relógio por jogada, modo tutorial (ameaças), ações
 * (anular/ameaças/reiniciar/desistir/sair) e overlay de fim de jogo.
 * Regras sempre via @tira/engine (Board só visualiza o GameState).
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Bot,
  ChevronLeft,
  Clock,
  Eye,
  Flag,
  Frown,
  Handshake,
  LogOut,
  MessageCircle,
  RotateCcw,
  Trophy,
  Undo2,
  User,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { getLegalMoves, isGameOver, type Move, type Square } from '@tira/engine';
import { Board } from '@/components/board/Board';
import { CocoDoMeioPopup } from '@/components/game/CocoDoMeioPopup';
import {
  ConfirmSheet,
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { useGame } from '@/game/useGame';
import { isTrappedInMiddle } from '@/lib/cocoDoMeio';
import type { I18nKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/hook';
import { useGameStore } from '@/store/game';
import { useSettings } from '@/store/settings';
import { boardGeometry, colors, radii, spacing, typography, type ColorToken } from '@/theme';

const useNativeDriver = Platform.OS !== 'web';

function goBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

function formatClock(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Botão de ação do GameScreen web (GameButton h-12 text-xs px-3 + ícone
 * lucide w-4 mr-1): ícone lucide 16dp + rótulo 13.5 (text-xs).
 */
function ActionButton({
  icon: Icon,
  label,
  variant = 'outline',
  disabled,
  onPress,
  fullWidth,
  labelSize = typography.fontSize.xs, // web ações: text-xs = 13.5 @ base 18
  gap = 4, // web ações: mr-1 = 4px
}: {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  variant?: 'outline' | 'p1' | 'p2';
  disabled?: boolean;
  onPress?: () => void;
  fullWidth?: boolean;
  labelSize?: number;
  gap?: number;
}) {
  const fg = variant === 'outline' ? colors.text : colors.white;
  return (
    <TiraButton
      variant={variant}
      size="lg"
      fullWidth={fullWidth}
      style={fullWidth ? undefined : { flex: 1 }}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
        <Icon size={16} color={fg} strokeWidth={2} />
        <Text
          style={{
            color: fg,
            fontSize: labelSize,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily.body,
          }}
        >
          {label}
        </Text>
      </View>
    </TiraButton>
  );
}

export default function GameScreen() {
  const { t } = useT();
  const {
    state,
    mode,
    difficulty,
    humanSide,
    selectedSquare,
    validTargets,
    lastMove,
    winner,
    isAiThinking,
    moveCount,
    currentThreats,
    showThreats,
    timePerTurn,
    startTime,
    selectSquare,
    attemptMove,
    resign,
    forfeit,
    restart,
    undo,
    toggleThreats,
  } = useGame();

  const [p1Time, setP1Time] = useState(timePerTurn);
  const [p2Time, setP2Time] = useState(timePerTurn);
  const hasClock = timePerTurn > 0;
  const gameOver = isGameOver(state);
  const isHumanTurnNow = mode === 'pvp' || ((mode === 'pve' || mode === 'practice') && state.currentPlayer === humanSide);
  const isBoardDisabled = gameOver || mode === 'cvc' || ((mode === 'pve' || mode === 'practice') && state.currentPlayer !== humanSide);

  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.lg, // 440
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );

  /* Relógio por turno (45s normal / 15s rápido / 0 sem relógio) */
  useEffect(() => {
    if (!hasClock || gameOver) return;
    const interval = setInterval(() => {
      if (state.currentPlayer === 'P1') {
        setP1Time((v) => Math.max(0, v - 1));
      } else {
        setP2Time((v) => Math.max(0, v - 1));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.currentPlayer, gameOver, hasClock]);

  /* Reset relógio ao mudar o turno — padrão "adjust state during render" */
  const [lastPlayer, setLastPlayer] = useState(state.currentPlayer);
  if (hasClock && lastPlayer !== state.currentPlayer) {
    setLastPlayer(state.currentPlayer);
    if (state.currentPlayer === 'P1') setP1Time(timePerTurn);
    else setP2Time(timePerTurn);
  }

  /* Reset relógios quando começa uma nova partida (start/restart) */
  const [prevStartTime, setPrevStartTime] = useState(startTime);
  if (prevStartTime !== startTime) {
    setPrevStartTime(startTime);
    setP1Time(timePerTurn);
    setP2Time(timePerTurn);
    setLastPlayer(state.currentPlayer);
  }

  /* Countdown háptico nos últimos 5s (apenas vez do humano) */
  const timeLeft = state.currentPlayer === 'P1' ? p1Time : p2Time;
  useEffect(() => {
    if (!hasClock || gameOver || !isHumanTurnNow) return;
    if (timeLeft <= 5 && timeLeft > 0) {
      Haptics.selectionAsync().catch(() => undefined);
    }
  }, [timeLeft, hasClock, gameOver, isHumanTurnNow]);

  /* Timeout: jogada legal aleatória (selectSquare + attemptMove — o store
     exige selectedSquare antes de attemptMove) */
  useEffect(() => {
    if (!hasClock || gameOver || !isHumanTurnNow) return;
    const left = state.currentPlayer === 'P1' ? p1Time : p2Time;
    if (left !== 0) return;
    const legal = getLegalMoves(state, state.currentPlayer);
    if (legal.length === 0) return;
    const move = legal[Math.floor(Math.random() * legal.length)];
    selectSquare(move.from);
    attemptMove(move.to);
  }, [p1Time, p2Time, hasClock, gameOver, isHumanTurnNow, state, selectSquare, attemptMove]);

  /* Háptica de fim de jogo (vitória/empate = sucesso, derrota = aviso) */
  useEffect(() => {
    if (!gameOver) return;
    const success = winner === null || mode === 'pvp' || winner === humanSide;
    Haptics.notificationAsync(
      success
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => undefined);
  }, [gameOver, winner, mode, humanSide]);

  const onSquarePress = useCallback(
    (sq: Square) => {
      if (isBoardDisabled) return;
      const cell = state.board[sq - 1];
      if (cell === state.currentPlayer) {
        Haptics.selectionAsync().catch(() => undefined);
        selectSquare(sq);
      } else if (selectedSquare && validTargets.includes(sq)) {
        const before = useGameStore.getState().moveCount;
        attemptMove(sq);
        const after = useGameStore.getState().moveCount;
        if (after > before) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        }
      }
    },
    [isBoardDisabled, state, selectedSquare, validTargets, selectSquare, attemptMove],
  );

  /* Derivados de apresentação */
  const legalMoves: Move[] = selectedSquare
    ? validTargets.map((to) => ({ from: selectedSquare, to }))
    : [];
  const flipped = (mode === 'pve' || mode === 'practice') && humanSide === 'P2';
  const p1Active = state.currentPlayer === 'P1' && !gameOver;
  const p2Active = state.currentPlayer === 'P2' && !gameOver;

  const modeLabel =
    mode === 'pvp'
      ? t('mode.pvp')
      : mode === 'pve'
        ? t('game.vs_ai')
        : mode === 'cvc'
          ? t('mode.cvc')
          : t('mode.practice');
  const titleText = mode === 'pvp' ? modeLabel : `${modeLabel} · ${t(`diff.${difficulty}`)}`;
  const subtitleText =
    t('game.match', { n: moveCount }) + (showThreats ? ` · ${t('mode.tutorial')}` : '');

  const p1Label =
    mode === 'pvp'
      ? t('game.player1')
      : mode === 'cvc'
        ? `${t('game.ia')} (P1)`
        : humanSide === 'P1'
          ? t('game.you')
          : `${t('game.ia')} ${t(`diff.${difficulty}`)}`;
  const p2Label =
    mode === 'pvp'
      ? t('game.player2')
      : mode === 'cvc'
        ? `${t('game.ia')} (P2)`
        : humanSide === 'P2'
          ? t('game.you')
          : `${t('game.ia')} ${t(`diff.${difficulty}`)}`;

  function statusText(): string {
    if (state.status === 'WIN_P1' || state.status === 'WIN_P2') {
      if (mode === 'pvp') return t('game.player_won', { n: state.winner === 'P1' ? 1 : 2 });
      if (mode === 'cvc') return t('result.win');
      return state.winner === humanSide ? t('game.win_status') : t('game.lose_status');
    }
    if (state.status === 'DRAW') return t('game.draw');
    if (mode === 'cvc') return isAiThinking ? t('game.ai_thinking') : 'IA vs IA';
    if (isAiThinking) return t('game.ai_thinking');
    if (isHumanTurnNow) {
      if (showThreats && currentThreats.length > 0) return t('game.threat_warning');
      return t('game.your_turn');
    }
    return t('game.opponent_turn');
  }
  const statusVariant: TiraTextStatusVariant = gameOver
    ? 'gold'
    : p1Active
      ? 'p1'
      : p2Active
        ? 'p2'
        : 'muted';

  /* Confirmações de Desistir/Sair — ConfirmSheet (RN Alert é no-op no web) */
  const [confirmAction, setConfirmAction] = useState<'resign' | 'exit' | null>(null);

  const confirmResign = () => setConfirmAction('resign');
  const confirmExit = () => setConfirmAction('exit');

  const isExitConfirm = confirmAction === 'exit';
  const runConfirmAction = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'resign') {
      resign();
      return;
    }
    if (action === 'exit') {
      if (!gameOver) resign();
      goBack();
    }
  };

  return (
    <TiraScreen
      showBack
      backgroundImage={require('@/assets/images/Background.png')}
      title={
        <TiraText
          size="xs"
          variant="muted"
          weight="semibold"
          style={{ textTransform: 'uppercase', letterSpacing: 1 }}
        >
          {titleText}
        </TiraText>
      }
      subtitle={<TiraText size="xs" variant="gold">{subtitleText}</TiraText>}
      headerLeft={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nav.back')}
          onPress={goBack}
          style={({ pressed }) => ({
            width: 48, // web: w-12 h-12 rounded-full bg-surface/60
            height: 48,
            borderRadius: radii.pill,
            backgroundColor: alpha(colors.surface, 0.6),
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
        </Pressable>
      }
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Como jogar"
          onPress={() => router.push('/how-to-play')}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: radii.pill,
            backgroundColor: alpha(colors.surface, 0.6),
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <MessageCircle size={16} color={colors.text} strokeWidth={2} />
        </Pressable>
      }
      style={{ gap: spacing[4] }}
      overlay={
        <>
          <CocoDoMeioPopup active={!gameOver && isTrappedInMiddle(state)} />
          {gameOver ? <GameOverOverlay /> : null}
        </>
      }
    >
      {/* Jogadores + relógios */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: spacing[3] }}>
        <PlayerCard
          label={p1Label}
          isP1
          active={p1Active}
          time={p1Time}
          showClock={hasClock}
          isHuman={mode === 'pvp' || (mode !== 'cvc' && humanSide === 'P1')}
        />
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[1] }}>
          <TiraHeading level="h3" color="textMuted" style={{ fontSize: 22.5, letterSpacing: 0.45, lineHeight: 31.5 }}>
            VS
          </TiraHeading>
        </View>
        <PlayerCard
          label={p2Label}
          isP1={false}
          active={p2Active}
          time={p2Time}
          showClock={hasClock}
          isHuman={mode === 'pvp' || (mode !== 'cvc' && humanSide === 'P2')}
        />
      </View>

      {/* Estado / mensagem */}
      <View
        style={{
          minHeight: 28,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
        }}
      >
        {isAiThinking ? <ActivityIndicator size="small" color={colors.gold} /> : null}
        <TiraText size="sm" weight="medium" variant={statusVariant}>
          {statusText()}
        </TiraText>
      </View>

      {/* Tabuleiro */}
      <View style={{ alignItems: 'center' }}>
        <Board
          state={state}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          threats={showThreats ? currentThreats : []}
          flipped={flipped}
          size={boardSize}
          onSquarePress={onSquarePress}
          testID="game-board"
        />
      </View>

      {/* Contadores */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: spacing[6],
        }}
      >
        <Counter value={moveCount} label={t('game.moves')} color="text" />
        <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: alpha(colors.border, 0.4) }} />
        <Counter value={state.history.length} label={t('profile.history')} color="gold" />
        {showThreats ? (
          <>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: alpha(colors.border, 0.4) }} />
            <Counter
              value={currentThreats.length}
              label={t('game.threats')}
              color={currentThreats.length > 0 ? 'p2' : 'textMuted'}
            />
          </>
        ) : null}
      </View>

      {/* Ações — anular / ameaças / reiniciar (web: lucide Undo2/Eye/RotateCcw) */}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <ActionButton
          icon={Undo2}
          label={t('game.undo')}
          disabled={moveCount === 0 || gameOver || mode === 'cvc'}
          onPress={undo}
        />
        <ActionButton
          icon={Eye}
          label={showThreats ? t('game.hide') : t('game.threats')}
          onPress={toggleThreats}
        />
        <ActionButton icon={RotateCcw} label={t('game.restart')} onPress={restart} />
      </View>

      {/* Ações — desistir / sair (web: lucide Flag/LogOut) */}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <ActionButton
          icon={Flag}
          variant="p2"
          label={t('game.resign')}
          disabled={gameOver || mode === 'cvc'}
          onPress={confirmResign}
        />
        <ActionButton icon={LogOut} label={t('game.exit')} onPress={confirmExit} />
      </View>

      {/* Confirmação Desistir/Sair — Modal próprio (funciona no web também) */}
      <ConfirmSheet
        visible={confirmAction !== null}
        title={isExitConfirm ? t('game.exit.confirm') : t('game.resign.confirm')}
        description={isExitConfirm ? t('game.exit.desc') : t('game.resign.desc')}
        cancelLabel={isExitConfirm ? t('common.continue') : t('common.cancel')}
        confirmLabel={isExitConfirm ? t('game.exit') : t('common.yes_resign')}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmAction}
      />
    </TiraScreen>
  );
}

type TiraTextStatusVariant = 'gold' | 'p1' | 'p2' | 'muted';

function Counter({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: ColorToken;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 2, minWidth: 64 }}>
      <TiraHeading level="h2" color={color} style={{ fontSize: 22.5, letterSpacing: 0.45, lineHeight: 31.5 }}>
        {value}
      </TiraHeading>
      <TiraText size="xs" variant="muted" style={{ textTransform: 'uppercase' }}>
        {label}
      </TiraText>
    </View>
  );
}

function PlayerCard({
  label,
  isP1,
  active,
  time,
  showClock,
  isHuman,
}: {
  label: string;
  isP1: boolean;
  active: boolean;
  time: number;
  showClock: boolean;
  isHuman: boolean;
}) {
  const { t } = useT();
  const lowTime = time <= 10;
  const accent: ColorToken = isP1 ? 'p1' : 'p2';
  return (
    <View
      style={{
        flex: 1,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: active ? alpha(colors[accent], 0.6) : alpha(colors.border, 0.4),
        backgroundColor: active ? alpha(colors[accent], 0.1) : alpha(colors.surface, 0.4),
        padding: spacing[3],
        gap: spacing[2],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radii.pill,
            backgroundColor: isP1 ? colors.p1 : colors.p2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isHuman ? (
            <User size={16} color={colors.white} strokeWidth={2} />
          ) : (
            <Bot size={16} color={colors.white} strokeWidth={2} />
          )}
        </View>
        <TiraText size="xs" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </TiraText>
        {active ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              backgroundColor: colors[accent],
            }}
          />
        ) : null}
      </View>
      {showClock ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
          <Clock
            size={12}
            color={lowTime ? colors.p2 : colors.textMuted}
            strokeWidth={2}
          />
          <TiraHeading level="h3" color={lowTime ? 'p2' : active ? 'text' : 'textMuted'} style={{ lineHeight: 20.25 }}>
            {formatClock(time)}
          </TiraHeading>
          {active ? (
            <TiraText
              size="xs"
              variant="muted"
              style={{
                marginLeft: 'auto',
                fontSize: 11, // web: text-[11px]
                textTransform: 'uppercase', // web: uppercase
              }}
            >
              {isHuman ? t('game.your_move') : t('game.thinking')}
            </TiraText>
          ) : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
          <TiraText
            size="xs"
            variant="muted"
            style={{ fontSize: 10, fontStyle: 'italic' }} // web: text-[10px] italic
          >
            {t('game.no_clock')}
          </TiraText>
          {active ? (
            <TiraText
              size="xs"
              variant="muted"
              style={{
                marginLeft: 'auto',
                fontSize: 11, // web: text-[11px]
                textTransform: 'uppercase', // web: uppercase
              }}
            >
              {isHuman ? t('game.your_move') : t('game.thinking')}
            </TiraText>
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * Confetti de vitória (port de src/components/game/Confetti.tsx web):
 * peças coloridas que caem do topo, cores do jogo, 1 corrida preenchida
 * (fill forwards) — respeita reduceMotion (não renderiza).
 */
const CONFETTI_COLORS = [colors.p1, colors.p2, colors.gold, colors.orange, colors.white];

function Confetti({ count = 50 }: { count?: number }) {
  const { height, width } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * width,
        delay: Math.random() * 500,
        duration: 1500 + Math.random() * 1500,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 360,
        round: Math.random() > 0.5,
      })),
    [count, width],
  );
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} {...p} screenH={height} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  left,
  delay,
  duration,
  color,
  size,
  rotate: startRotate,
  round,
  screenH,
}: {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotate: number;
  round: boolean;
  screenH: number;
}) {
  // Animated via useState (padrão do Board.tsx; lint react-hooks/refs
  // proíbe useRef(...).current em render)
  const [translateY] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // keyframes web: translateY(-100vh→100vh) rotate(0→720deg) opacity(1→0)
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenH + 40,
          duration,
          useNativeDriver,
        }),
        Animated.timing(opacity, { toValue: 0, duration, useNativeDriver }),
        Animated.timing(spin, { toValue: 1, duration, useNativeDriver }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, duration, screenH, translateY, opacity, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: [`${startRotate}deg`, `${startRotate + 720}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: -20,
        left,
        width: size,
        height: size * 1.5,
        backgroundColor: color,
        borderRadius: round ? 2 : size / 2,
        opacity,
        transform: [{ translateY }, { rotate }],
      }}
    />
  );
}

/** Raios de vitória — conic-gradient do web aproximado com cunhas SVG. */
function VictoryRays({ color, reduceMotion }: { color: string; reduceMotion: boolean }) {
  const [opacity] = useState(() => new Animated.Value(0.15));

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.15);
      return;
    }
    // .animate-victory-rays = pulse-soft 1s (1 → 0.5 → 1), depois volta ao
    // 0.15 inline (fill-mode: none)
    opacity.setValue(1);
    const anim = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.5,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) opacity.setValue(0.15);
    });
    return () => anim.stop();
  }, [reduceMotion, opacity]);

  // conic-gradient: 4 raios com período 0.25 — sobe 0→1 em [0, 0.20],
  // desce 1→0 em [0.20, 0.25] (cunhas de 7.5° com opacidade passo a passo)
  const wedges = useMemo(() => {
    const R = 192;
    const C = 192;
    const STEPS = 12;
    const out: { d: string; opacity: number }[] = [];
    for (let q = 0; q < 4; q++) {
      for (let s = 0; s < STEPS; s++) {
        const f0 = q * 0.25 + (s / STEPS) * 0.25;
        const f1 = q * 0.25 + ((s + 1) / STEPS) * 0.25;
        const mid = (f0 + f1) / 2 - q * 0.25;
        const op = mid <= 0.2 ? mid / 0.2 : Math.max(0, 1 - (mid - 0.2) / 0.05);
        const a0 = f0 * Math.PI * 2 - Math.PI / 2;
        const a1 = f1 * Math.PI * 2 - Math.PI / 2;
        const x0 = C + R * Math.cos(a0);
        const y0 = C + R * Math.sin(a0);
        const x1 = C + R * Math.cos(a1);
        const y1 = C + R * Math.sin(a1);
        out.push({
          d: `M${C} ${C} L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`,
          opacity: op,
        });
      }
    }
    return out;
  }, []);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={{ width: 384, height: 384, opacity }}>
        <Svg width={384} height={384} viewBox="0 0 384 384">
          {wedges.map((w, i) => (
            <Path key={i} d={w.d} fill={color} opacity={w.opacity} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Linhas vencedoras → chave i18n (port de LINE_LABELS da web). */
const LINE_LABEL_KEYS: Record<string, I18nKey> = {
  '1,2,3': 'game.line.bottom',
  '4,5,6': 'game.line.mid',
  '7,8,9': 'game.line.top',
  '1,4,7': 'game.line.col_left',
  '2,5,8': 'game.line.col_mid',
  '3,6,9': 'game.line.col_right',
  '1,5,9': 'game.line.diag_main',
  '3,5,7': 'game.line.diag_sec',
};

function describeLine(line: readonly number[], t: (key: I18nKey) => string): string {
  const key = [...line].sort((a, b) => a - b).join(',');
  return t(LINE_LABEL_KEYS[key] ?? 'game.line.other');
}

function GameOverOverlay() {
  const { t } = useT();
  const { winner, mode, humanSide, state, winningLine, lastMove, restart } = useGame();
  const reduceMotion = useSettings((s) => s.reduceMotion);

  const isDraw = winner === null;
  const humanWon = (mode === 'pve' || mode === 'practice') && winner === humanSide;
  const humanLost =
    (mode === 'pve' || mode === 'practice') && winner !== null && winner !== humanSide;

  // Vitória "natural" = com linha vencedora de 3 (senão: desistência/timeout)
  const naturalWin = winner !== null && winningLine !== null && winningLine.length === 3;

  const title = isDraw
    ? t('game.draw')
    : mode === 'pve' || mode === 'practice'
      ? humanWon
        ? t('game.victory')
        : t('game.defeat')
      : mode === 'cvc'
        ? t('game.ai_won', { n: winner === 'P1' ? 1 : 2 })
        : t('game.player_won', { n: winner === 'P1' ? 1 : 2 });

  const subtitle = isDraw
    ? t('game.draw.desc')
    : naturalWin
      ? mode === 'pve' || mode === 'practice'
        ? humanWon
          ? t('game.win.human')
          : t('game.win.ai')
        : t('game.win.line')
      : t('game.end.no_winner');

  const ResultIcon = isDraw ? Handshake : humanLost ? Frown : Trophy;
  const iconBg = isDraw
    ? colors.surfaceAlt
    : humanLost
      ? alpha(colors.p2, 0.15)
      : alpha(colors.gold, 0.15);
  const iconColor = isDraw ? colors.textMuted : humanLost ? colors.p2 : colors.gold;
  const titleColor: ColorToken = isDraw
    ? 'textMuted'
    : humanWon || ((mode !== 'pve' && mode !== 'practice') && winner !== null)
      ? 'gold'
      : 'p2';

  /* Motion (web framer-motion): fade do overlay + spring do cartão + pop do
     ícone — tudo desligado com reduceMotion (valores já finais) */
  const [fade] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [cardScale] = useState(() => new Animated.Value(reduceMotion ? 1 : 0.8));
  const [cardY] = useState(() => new Animated.Value(reduceMotion ? 0 : 20));
  const [iconScale] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver }).start();
    Animated.spring(cardScale, {
      toValue: 1,
      stiffness: 300,
      damping: 25,
      useNativeDriver,
    }).start();
    Animated.spring(cardY, {
      toValue: 0,
      stiffness: 300,
      damping: 25,
      useNativeDriver,
    }).start();
    const timer = setTimeout(() => {
      Animated.spring(iconScale, {
        toValue: 1,
        stiffness: 300,
        damping: 15,
        useNativeDriver,
      }).start();
    }, 100);
    return () => clearTimeout(timer);
  }, [reduceMotion, fade, cardScale, cardY, iconScale]);

  const titleGlow = humanWon
    ? {
        textShadowColor: alpha(colors.gold, 0.35), // .text-glow-gold
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 12,
      }
    : null;

  const boardLabel =
    winner && winningLine && winningLine.length === 3
      ? t('game.end.board_win')
      : t('game.end.board_final');

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        opacity: fade,
        backgroundColor: alpha(colors.bg, 0.95), // web: bg-background/95 backdrop-blur-sm
      }}
    >
      {!isDraw && !reduceMotion && (
        <VictoryRays color={humanWon ? colors.p1 : colors.p2} reduceMotion={reduceMotion} />
      )}

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[4], // p-4
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            width: '100%',
            maxWidth: 420, // max-w-[420px]
            transform: [{ scale: cardScale }, { translateY: cardY }],
          }}
        >
          <TiraCard
            glow={isDraw || humanLost ? undefined : 'gold'}
            style={{ padding: spacing[5] }} // p-5
          >
            {/* Cabeçalho: caixa de ícone + título/subtítulo */}
            <Animated.View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3], // gap-3
                marginBottom: spacing[3], // mb-3
                transform: [{ scale: iconScale }],
              }}
            >
              <View
                style={{
                  width: 56, // w-14
                  height: 56, // h-14
                  borderRadius: radii.cardLg, // rounded-2xl
                  backgroundColor: iconBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {/* ícone w-7 = 28dp */}
                <ResultIcon size={28} color={iconColor} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <TiraHeading
                  level="display" // text-3xl
                  color={titleColor}
                  style={[
                    { letterSpacing: 0.84, lineHeight: typography.fontSize['3xl'] }, // tracking-wide + leading-none
                    titleGlow,
                  ]}
                >
                  {title}
                </TiraHeading>
                <TiraText size="xs" variant="muted" style={{ marginTop: 4 }}>
                  {subtitle}
                </TiraText>
              </View>
            </Animated.View>

            {/* Tabuleiro REAL da posição final — o mesmo que se jogou */}
            <View
              style={{
                borderRadius: radii.xl, // rounded-xl
                borderWidth: 1,
                borderColor: alpha(colors.border, 0.6), // border-border/60
                backgroundColor: alpha(colors.surfaceAlt, 0.6), // bg-surface-2/60
                padding: spacing[3], // p-3
              }}
            >
              <TiraText
                size="xs"
                variant="muted"
                style={{
                  fontSize: 10, // text-[10px]
                  textTransform: 'uppercase',
                  letterSpacing: 1, // tracking-widest
                  marginBottom: spacing[2], // mb-2
                }}
              >
                {boardLabel}
              </TiraText>
              <View style={{ alignItems: 'center' }}>
                <Board state={state} size="sm" lastMove={lastMove} />
              </View>
            </View>

            {/* Descrição da linha / última jogada */}
            <View
              style={{
                marginTop: spacing[3], // mt-3
                marginBottom: spacing[4], // mb-4
                gap: 2, // space-y-0.5
              }}
            >
              {winner && winningLine && winningLine.length === 3 ? (
                <>
                  <TiraText size="xs" variant="muted">
                    {t('game.end.won_by')}{' '}
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: typography.fontWeight.medium,
                        fontFamily: typography.fontFamily.body,
                      }}
                    >
                      {describeLine(winningLine, t)}
                    </Text>
                  </TiraText>
                  {lastMove ? (
                    <TiraText size="xs" variant="muted">
                      {t('game.end.final_move', { from: lastMove.from, to: lastMove.to })}
                    </TiraText>
                  ) : null}
                </>
              ) : (
                <TiraText size="xs" variant="muted">
                  {(lastMove
                    ? `${t('game.end.last_move', { from: lastMove.from, to: lastMove.to })} `
                    : '') +
                    (isDraw ? t('game.end.no_line_draw') : t('game.end.no_line'))}
                </TiraText>
              )}
            </View>

            {/* Botões — web: GameButton h-12 (RotateCcw/LogOut) */}
            <View style={{ gap: spacing[2] }}>
              <ActionButton
                icon={RotateCcw}
                variant="p1"
                label={t('game.play_again')}
                fullWidth
                labelSize={typography.fontSize.sm} // web overlay: text-base-sm = 15.75
                gap={spacing[2]}
                onPress={restart}
              />
              <ActionButton
                icon={LogOut}
                variant="outline"
                label={t('game.exit')}
                fullWidth
                labelSize={typography.fontSize.sm}
                gap={spacing[2]}
                onPress={goBack}
              />
            </View>
          </TiraCard>
        </Animated.View>
      </ScrollView>

      {humanWon && !reduceMotion && <Confetti count={50} />}
    </Animated.View>
  );
}

