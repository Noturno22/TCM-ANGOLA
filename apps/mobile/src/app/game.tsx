/**
 * Game — port do GameScreen web: partida offline completa (PvP / PvE /
 * Treino Livre) com relógio por jogada, modo tutorial (ameeaças), ações
 * (anular/ameaças/reiniciar/desistir/sair) e overlay de fim de jogo.
 * Regras sempre via @tira/engine (Board só visualiza o GameState).
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, useWindowDimensions, View } from 'react-native';
import { getLegalMoves, isGameOver, type Move, type Square } from '@tira/engine';
import { Board } from '@/components/board/Board';
import {
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { useGame } from '@/game/useGame';
import { useT } from '@/lib/i18n/hook';
import { useGameStore } from '@/store/game';
import { boardGeometry, colors, radii, spacing, type ColorToken } from '@/theme';

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
    restart,
    undo,
    toggleThreats,
  } = useGame();

  const [p1Time, setP1Time] = useState(timePerTurn);
  const [p2Time, setP2Time] = useState(timePerTurn);
  const hasClock = timePerTurn > 0;
  const gameOver = isGameOver(state);
  const isHumanTurnNow = mode === 'pvp' || state.currentPlayer === humanSide;

  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.md, // 360
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
      if (gameOver) return;
      if ((mode === 'pve' || mode === 'practice') && state.currentPlayer !== humanSide) return;
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
    [gameOver, mode, state, humanSide, selectedSquare, validTargets, selectSquare, attemptMove],
  );

  /* Derivados de apresentação */
  const legalMoves: Move[] = selectedSquare
    ? validTargets.map((to) => ({ from: selectedSquare, to }))
    : [];
  const flipped = (mode === 'pve' || mode === 'practice') && humanSide === 'P2';
  const p1Active = state.currentPlayer === 'P1' && !gameOver;
  const p2Active = state.currentPlayer === 'P2' && !gameOver;

  const modeLabel =
    mode === 'pvp' ? t('mode.pvp') : mode === 'pve' ? t('game.vs_ai') : t('mode.practice');
  const titleText = mode === 'pvp' ? modeLabel : `${modeLabel} • ${t(`diff.${difficulty}`)}`;
  const subtitleText =
    t('game.match', { n: moveCount }) + (showThreats ? ` • ${t('mode.tutorial')}` : '');

  const p1Label =
    mode === 'pvp'
      ? t('game.player1')
      : humanSide === 'P1'
        ? t('game.you')
        : `${t('game.ia')} ${t(`diff.${difficulty}`)}`;
  const p2Label =
    mode === 'pvp'
      ? t('game.player2')
      : humanSide === 'P2'
        ? t('game.you')
        : `${t('game.ia')} ${t(`diff.${difficulty}`)}`;

  function statusText(): string {
    if (state.status === 'WIN_P1' || state.status === 'WIN_P2') {
      if (mode === 'pvp') return t('game.player_won', { n: state.winner === 'P1' ? 1 : 2 });
      return state.winner === humanSide ? t('game.win_status') : t('game.lose_status');
    }
    if (state.status === 'DRAW') return `${t('game.draw')} ${t('game.draw.desc')}`;
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

  const confirmResign = () => {
    Alert.alert(t('game.resign.confirm'), t('game.resign.desc'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.yes_resign'), style: 'destructive', onPress: resign },
    ]);
  };

  const confirmExit = () => {
    Alert.alert(t('game.exit.confirm'), t('game.exit.desc'), [
      { text: t('common.continue'), style: 'cancel' },
      {
        text: t('game.exit'),
        style: 'destructive',
        onPress: () => {
          if (!gameOver) resign();
          goBack();
        },
      },
    ]);
  };

  return (
    <TiraScreen
      scroll={false}
      showBack
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
      style={{ gap: spacing[4] }}
      overlay={gameOver ? <GameOverOverlay /> : undefined}
    >
      {/* Jogadores + relógios */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: spacing[3] }}>
        <PlayerCard
          label={p1Label}
          isP1
          active={p1Active}
          time={p1Time}
          showClock={hasClock}
          isHuman={mode === 'pvp' || humanSide === 'P1'}
        />
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[1] }}>
          <TiraHeading level="h3" color="textMuted">
            VS
          </TiraHeading>
        </View>
        <PlayerCard
          label={p2Label}
          isP1={false}
          active={p2Active}
          time={p2Time}
          showClock={hasClock}
          isHuman={mode === 'pvp' || humanSide === 'P2'}
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

      {/* Ações — anular / ameaças / reiniciar */}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <TiraButton
          variant="outline"
          size="sm"
          style={{ flex: 1 }}
          disabled={moveCount === 0 || gameOver}
          onPress={undo}
        >
          {`↩️ ${t('game.undo')}`}
        </TiraButton>
        <TiraButton variant="outline" size="sm" style={{ flex: 1 }} onPress={toggleThreats}>
          {`${showThreats ? '👁️' : '⚠️'} ${showThreats ? t('game.hide') : t('game.threats')}`}
        </TiraButton>
        <TiraButton variant="outline" size="sm" style={{ flex: 1 }} onPress={restart}>
          {`🔄 ${t('game.restart')}`}
        </TiraButton>
      </View>

      {/* Ações — desistir / sair */}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <TiraButton
          variant="p2"
          size="sm"
          style={{ flex: 1 }}
          disabled={gameOver}
          onPress={confirmResign}
        >
          {`🏳️ ${t('game.resign')}`}
        </TiraButton>
        <TiraButton variant="outline" size="sm" style={{ flex: 1 }} onPress={confirmExit}>
          {`🚪 ${t('game.exit')}`}
        </TiraButton>
      </View>
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
      <TiraHeading level="h2" color={color}>
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
          <TiraText size="xs">{isHuman ? '👤' : '🤖'}</TiraText>
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
          <TiraText size="xs" variant={lowTime ? 'p2' : 'muted'}>
            🕐
          </TiraText>
          <TiraHeading level="h3" color={lowTime ? 'p2' : active ? 'text' : 'textMuted'}>
            {formatClock(time)}
          </TiraHeading>
          {active ? (
            <TiraText size="xs" variant="muted" style={{ marginLeft: 'auto' }}>
              {isHuman ? t('game.your_move') : t('game.thinking')}
            </TiraText>
          ) : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
          <TiraText size="xs" variant="muted">
            {t('game.no_clock')}
          </TiraText>
          {active ? (
            <TiraText size="xs" variant="muted" style={{ marginLeft: 'auto' }}>
              {isHuman ? t('game.your_move') : t('game.thinking')}
            </TiraText>
          ) : null}
        </View>
      )}
    </View>
  );
}

function GameOverOverlay() {
  const { t } = useT();
  const { winner, mode, humanSide, restart } = useGame();

  const isDraw = winner === null;
  const humanWon = (mode === 'pve' || mode === 'practice') && winner === humanSide;
  const humanLost = (mode === 'pve' || mode === 'practice') && winner !== null && winner !== humanSide;

  const title = isDraw
    ? t('game.draw')
    : mode === 'pvp'
      ? t('game.player_won', { n: winner === 'P1' ? 1 : 2 })
      : humanWon
        ? t('game.victory')
        : t('game.defeat');

  const subtitle = isDraw
    ? t('game.draw.desc')
    : mode === 'pvp'
      ? t('game.win.line')
      : humanWon
        ? t('game.win.human')
        : t('game.win.ai');

  const emoji = isDraw
    ? '🤝'
    : humanWon
      ? '🏆'
      : humanLost
        ? '😔'
        : winner === 'P1'
          ? '🟢'
          : '🔴';

  const titleColor: ColorToken = isDraw
    ? 'textMuted'
    : humanWon || mode === 'pvp'
      ? 'gold'
      : 'p2';

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        backgroundColor: alpha(colors.bg, 0.8),
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[6],
      }}
    >
      <TiraCard glow="gold" style={{ width: '100%', maxWidth: 360 }}>
        <View style={{ alignItems: 'center', gap: spacing[3] }}>
          <TiraText style={{ fontSize: 56 }}>{emoji}</TiraText>
          <TiraHeading level="h1" color={titleColor} align="center">
            {title}
          </TiraHeading>
          <TiraText size="sm" variant="muted" align="center">
            {subtitle}
          </TiraText>

          {!isDraw ? (
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radii.pill,
                  backgroundColor: winner === 'P1' ? colors.p1 : alpha(colors.surfaceAlt, 0.5),
                }}
              />
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radii.pill,
                  backgroundColor: winner === 'P2' ? colors.p2 : alpha(colors.surfaceAlt, 0.5),
                }}
              />
            </View>
          ) : null}

          <View style={{ width: '100%', gap: spacing[2], marginTop: spacing[3] }}>
            <TiraButton
              variant="p1"
              fullWidth
              onPress={() => {
                restart();
              }}
            >
              {`🔄 ${t('game.play_again')}`}
            </TiraButton>
            <TiraButton variant="outline" fullWidth onPress={goBack}>
              {`🚪 ${t('game.exit')}`}
            </TiraButton>
          </View>
        </View>
      </TiraCard>
    </View>
  );
}
