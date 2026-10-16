/**
 * Match — partida online ao vivo (autoritativa no servidor).
 *
 * Port do OnlineMatchScreen web (fatia vertical: origem "rooms"). O tabuleiro
 * só visualiza o `GameState` reconstruído a partir do estado do servidor; as
 * jogadas são enviadas via Edge Function/RPC e o novo estado chega por
 * Realtime. Inclui fila de espera, desistência, reclamação de timeout e
 * overlay de fim de partida com prémio.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchUsernames } from '@/lib/online/rooms';
import {
  matchToGameState,
  potForStake,
  sideForUser,
  timeLeftSeconds,
  type MoveErrorCode,
} from '@/lib/online/match';
import { useAuth } from '@/store/auth';
import { useMatch } from '@/store/match';
import { boardGeometry, colors, radii, spacing, type ColorToken } from '@/theme';

const ERROR_MESSAGES: Partial<Record<MoveErrorCode | 'unknown', string>> = {
  not_your_turn: 'Não é a tua vez.',
  turn_expired: 'O teu tempo esgotou.',
  destination_occupied: 'Casa ocupada.',
  path_blocked: 'Caminho bloqueado.',
  not_your_piece: 'Essa peça não é tua.',
  not_enough_coins: 'Moedas insuficientes.',
  age_restricted: 'Só para maiores de 18 anos (com data de nascimento confirmada).',
  unknown: 'Não foi possível concluir. Tenta novamente.',
};

function goBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/rooms');
  }
}

export default function MatchScreen() {
  const userId = useAuth((s) => s.user?.id ?? null);
  const {
    enabled,
    queued,
    queuedStake,
    match,
    loading,
    error,
    loadActiveMatch,
    cancelQueue,
    playMove,
    resign,
    claimTimeout,
    leave,
  } = useMatch();

  const [selected, setSelected] = useState<Square | null>(null);
  const [now, setNow] = useState(Date.now());
  const [oppName, setOppName] = useState<string | null>(null);

  const mySide = match ? sideForUser(match, userId) : null;
  const state = useMemo(() => (match ? matchToGameState(match) : null), [match]);
  const gameOver = state ? isGameOver(state) : false;

  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.md,
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );

  /* Sem partida em memória → procura uma ativa (entrada direta na rota). */
  useEffect(() => {
    if (enabled && !match && !queued) void loadActiveMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  /* Relógio do turno. */
  useEffect(() => {
    if (!match || match.status !== 'active' || match.timePerTurn <= 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [match]);

  /* Reclama timeout quando o adversário deixa o relógio expirar. */
  const timeLeft = match ? timeLeftSeconds(match, now) : 0;
  useEffect(() => {
    if (!match || match.status !== 'active' || match.timePerTurn <= 0) return;
    if (timeLeft > 0) return;
    if (match.turn === mySide) return;
    void claimTimeout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, match, mySide]);

  /* Nome do adversário. */
  const oppId =
    match && mySide ? (mySide === 'P1' ? match.p2Id : match.p1Id) : null;
  useEffect(() => {
    if (!oppId) return;
    let active = true;
    void fetchUsernames([oppId]).then((names) => {
      if (active) setOppName(names[oppId] ?? null);
    });
    return () => {
      active = false;
    };
  }, [oppId]);

  /* Háptica no fim da partida. */
  useEffect(() => {
    if (!gameOver || !match || !mySide) return;
    const won = match.winner === mySide;
    Haptics.notificationAsync(
      match.winner === 'draw'
        ? Haptics.NotificationFeedbackType.Success
        : won
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => undefined);
  }, [gameOver, match, mySide]);

  const onSquarePress = useCallback(
    (sq: Square) => {
      if (!state || gameOver || !mySide) return;
      if (state.currentPlayer !== mySide) return;
      const cell = state.board[sq - 1];
      if (cell === mySide) {
        Haptics.selectionAsync().catch(() => undefined);
        setSelected(sq);
        return;
      }
      if (selected) {
        const legal = getLegalMoves(state, mySide).some(
          (m) => m.from === selected && m.to === sq,
        );
        if (legal) {
          void playMove(selected, sq);
          setSelected(null);
        }
      }
    },
    [state, gameOver, mySide, selected, playMove],
  );

  const legalMoves: Move[] =
    state && selected && mySide
      ? getLegalMoves(state, mySide).filter((m) => m.from === selected)
      : [];

  const confirmLeave = () => {
    if (match && match.status === 'active') {
      Alert.alert('Sair da partida?', 'Se saíres agora é uma desistência (o adversário vence).', [
        { text: 'Ficar', style: 'cancel' },
        {
          text: 'Desistir e sair',
          style: 'destructive',
          onPress: () => {
            void resign();
            leave();
            goBack();
          },
        },
      ]);
      return;
    }
    leave();
    goBack();
  };

  /* ---------- Estados de carregamento / fila ---------- */
  if (!enabled) {
    return (
      <TiraScreen title="Online" showBack>
        <TiraCard>
          <TiraText size="sm" variant="muted" align="center">
            O modo online não está disponível (backend não configurado).
          </TiraText>
        </TiraCard>
      </TiraScreen>
    );
  }

  if (loading && !match) {
    return (
      <TiraScreen title="Online" showBack>
        <View style={{ alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] }}>
          <ActivityIndicator size="large" color={colors.gold} />
          <TiraText size="sm" variant="muted">A entrar…</TiraText>
        </View>
      </TiraScreen>
    );
  }

  if (queued && !match) {
    return (
      <TiraScreen title="À procura de adversário" showBack>
        <TiraCard glow="gold" style={{ alignItems: 'center' }}>
          <View style={{ alignItems: 'center', gap: spacing[3] }}>
            <ActivityIndicator size="large" color={colors.gold} />
            <TiraHeading level="h3">À procura de adversário…</TiraHeading>
            <TiraText size="xs" variant="muted" align="center">
              {queuedStake > 0
                ? `Aposta retida: ${queuedStake} KZ. Prémio: ${potForStake(queuedStake)} KZ.`
                : 'Sala gratuita.'}
            </TiraText>
            <TiraButton
              variant="outline"
              fullWidth
              onPress={() => {
                void cancelQueue();
                goBack();
              }}
            >
              Cancelar
            </TiraButton>
          </View>
        </TiraCard>
      </TiraScreen>
    );
  }

  if (!match || !state || !mySide) {
    return (
      <TiraScreen title="Online" showBack>
        <TiraCard>
          <View style={{ alignItems: 'center', gap: spacing[3] }}>
            <TiraText style={{ fontSize: 40 }}>🎮</TiraText>
            <TiraText size="sm" variant="muted" align="center">
              Sem partida ativa. Volta às salas para arranjar adversário.
            </TiraText>
            <TiraButton variant="gold" fullWidth onPress={goBack}>
              Voltar às salas
            </TiraButton>
          </View>
        </TiraCard>
      </TiraScreen>
    );
  }

  const myTurn = state.currentPlayer === mySide && !gameOver;
  const oppTurn = state.currentPlayer !== mySide && !gameOver;
  const p1Active = state.currentPlayer === 'P1' && !gameOver;
  const p2Active = state.currentPlayer === 'P2' && !gameOver;
  const oppLabel = oppName ?? 'Adversário';

  const statusVariant: TiraTextStatusVariant = gameOver ? 'gold' : p1Active ? 'p1' : p2Active ? 'p2' : 'muted';
  const statusText = gameOver
    ? match.winner === 'draw'
      ? 'Empate'
      : match.winner === mySide
        ? 'Vitória!'
        : 'Derrota'
    : myTurn
      ? 'A tua vez'
      : 'Vez do adversário';

  return (
    <TiraScreen
      scroll={false}
      showBack
      title={
        <TiraText size="xs" variant="muted" weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          {`Online • ${match.stake > 0 ? `${match.stake} KZ` : 'Grátis'}`}
        </TiraText>
      }
      subtitle={
        match.stake > 0 ? (
          <TiraText size="xs" variant="gold">{`🪙 Prémio ${potForStake(match.stake)} KZ`}</TiraText>
        ) : undefined
      }
      style={{ gap: spacing[4] }}
      overlay={
        gameOver ? (
          <MatchOverlay
            winnerMySide={match.winner === mySide}
            isDraw={match.winner === 'draw'}
            stake={match.stake}
            onLeave={confirmLeave}
          />
        ) : undefined
      }
    >
      {/* Jogadores */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: spacing[3] }}>
        <PlayerChip
          label={mySide === 'P1' ? 'Tu' : oppLabel}
          isP1
          active={p1Active}
          time={match.timePerTurn > 0 && p1Active ? timeLeft : null}
        />
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[1] }}>
          <TiraHeading level="h3" color="textMuted">VS</TiraHeading>
        </View>
        <PlayerChip
          label={mySide === 'P2' ? 'Tu' : oppLabel}
          isP1={false}
          active={p2Active}
          time={match.timePerTurn > 0 && p2Active ? timeLeft : null}
        />
      </View>

      {/* Estado / erro */}
      <View style={{ minHeight: 28, alignItems: 'center', justifyContent: 'center', gap: spacing[1] }}>
        {!gameOver && oppTurn ? <ActivityIndicator size="small" color={colors.gold} /> : null}
        <TiraText size="sm" weight="medium" variant={statusVariant}>{statusText}</TiraText>
        {error ? (
          <TiraText size="xs" variant="p2">{`⚠️ ${ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown}`}</TiraText>
        ) : null}
      </View>

      {/* Tabuleiro */}
      <View style={{ alignItems: 'center' }}>
        <Board
          state={state}
          selectedSquare={selected}
          legalMoves={legalMoves}
          lastMove={null}
          threats={[]}
          flipped={mySide === 'P2'}
          size={boardSize}
          onSquarePress={onSquarePress}
          testID="online-match-board"
        />
      </View>

      {/* Ações */}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <TiraButton
          variant="p2"
          size="sm"
          style={{ flex: 1 }}
          disabled={gameOver}
          onPress={() => {
            Alert.alert('Desistir?', 'O adversário vence imediatamente.', [
              { text: 'Não', style: 'cancel' },
              { text: 'Desistir', style: 'destructive', onPress: () => void resign() },
            ]);
          }}
        >
          {`🏳️ ${'Desistir'}`}
        </TiraButton>
        <TiraButton variant="outline" size="sm" style={{ flex: 1 }} onPress={confirmLeave}>
          {`🚪 ${'Sair'}`}
        </TiraButton>
      </View>
    </TiraScreen>
  );
}

type TiraTextStatusVariant = 'gold' | 'p1' | 'p2' | 'muted';

function PlayerChip({
  label,
  isP1,
  active,
  time,
}: {
  label: string;
  isP1: boolean;
  active: boolean;
  time: number | null;
}) {
  const accent: ColorToken = isP1 ? 'p1' : 'p2';
  const low = time !== null && time <= 10;
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
          <TiraText size="xs">👤</TiraText>
        </View>
        <TiraText size="xs" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{label}</TiraText>
        {active ? (
          <View style={{ width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors[accent] }} />
        ) : null}
      </View>
      {time !== null ? (
        <TiraHeading level="h3" color={low ? 'p2' : active ? 'text' : 'textMuted'}>
          {formatClock(time)}
        </TiraHeading>
      ) : null}
    </View>
  );
}

function MatchOverlay({
  winnerMySide,
  isDraw,
  stake,
  onLeave,
}: {
  winnerMySide: boolean;
  isDraw: boolean;
  stake: number;
  onLeave: () => void;
}) {
  const title = isDraw ? 'Empate' : winnerMySide ? 'Vitória!' : 'Derrota';
  const emoji = isDraw ? '🤝' : winnerMySide ? '🏆' : '😔';
  const titleColor: ColorToken = isDraw ? 'textMuted' : winnerMySide ? 'gold' : 'p2';
  const prize = winnerMySide && stake > 0 ? `Ganhaste ${potForStake(stake)} KZ.` : null;

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
          <TiraHeading level="h1" color={titleColor} align="center">{title}</TiraHeading>
          {prize ? (
            <TiraText size="sm" variant="gold" align="center">{`🪙 ${prize}`}</TiraText>
          ) : null}
          <TiraButton variant="gold" fullWidth onPress={onLeave}>
            Voltar às salas
          </TiraButton>
        </View>
      </TiraCard>
    </View>
  );
}

function formatClock(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}
