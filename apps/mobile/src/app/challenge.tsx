/**
 * Challenge — port do ChallengeScreen web: puzzle do dia (mate-in-1/2)
 * com máquina de fases (jogador → IA → jogador), dica, reinício,
 * recompensa em KZ e lista de todos os puzzles.
 * Dados dos puzzles: `@/content` (re-exporta src/lib/puzzles.ts partilhado com a web).
 * "Resolvido" é só de sessão (sem store de challenge — fora do escopo).
 */
import { chooseMove } from '@tira/ai';
import {
  DEFAULT_CONFIG,
  applyMove,
  getLegalMoves,
  getWinningMoves,
  type Cell,
  type GameState,
  type Move,
  type PlayerId,
  type Square,
} from '@tira/engine';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import { getTodayPuzzle, PUZZLES, type Puzzle } from '@/content';
import { Board } from '@/components/board/Board';
import {
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { useT } from '@/lib/i18n/hook';
import { useProfile } from '@/store/profile';
import { boardGeometry, colors, radii, spacing, type ColorToken } from '@/theme';

type Phase = 'first-move' | 'awaiting-ia' | 'second-move' | 'solved' | 'wrong';

/** Posição inicial do puzzle (regras do motor, config padrão). */
function makePuzzleState(board: Cell[], player: PlayerId = 'P1'): GameState {
  return {
    board,
    currentPlayer: player,
    status: player === 'P1' ? 'PLAYER_1_TURN' : 'PLAYER_2_TURN',
    winner: null,
    winningLine: null,
    moveCount: 0,
    history: [],
    positionCounts: {},
    config: DEFAULT_CONFIG,
  };
}

const DIFF_BADGE: Record<Puzzle['difficulty'], ColorToken> = {
  'Fácil': 'p1',
  'Médio': 'gold',
  'Difícil': 'p2',
};

export default function ChallengeScreen() {
  const { t } = useT();
  const addCoins = useProfile((s) => s.addCoins);
  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.md,
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );

  const todayPuzzle = useMemo(() => getTodayPuzzle(), []);
  const isMate2 = todayPuzzle.mateIn === 2;
  const reward = isMate2 ? 400 : 200;

  /* Sessão-only: puzzles resolvidos nesta sessão */
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const isTodaySolved = solvedIds.includes(todayPuzzle.id);

  const [currentState, setCurrentState] = useState<GameState>(() =>
    makePuzzleState(todayPuzzle.board, 'P1'),
  );
  const [phase, setPhase] = useState<Phase>('first-move');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validTargets, setValidTargets] = useState<Square[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [wrongMove, setWrongMove] = useState<Move | null>(null);
  const [wrongFlash, setWrongFlash] = useState(false);

  const reset = useCallback(() => {
    setCurrentState(makePuzzleState(todayPuzzle.board, 'P1'));
    setPhase('first-move');
    setSelectedSquare(null);
    setValidTargets([]);
    setWrongMove(null);
    setWrongFlash(false);
    setShowHint(false);
  }, [todayPuzzle.board]);

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (phase === 'solved' || phase === 'awaiting-ia' || phase === 'wrong') return;

      const piece = currentState.board[sq - 1];
      if (piece === 'P1') {
        const legal = getLegalMoves(currentState, 'P1');
        const targets = legal.filter((m) => m.from === sq).map((m) => m.to);
        Haptics.selectionAsync().catch(() => undefined);
        setSelectedSquare(sq);
        setValidTargets(targets);
      } else if (selectedSquare && validTargets.includes(sq)) {
        const move: Move = { from: selectedSquare, to: sq };

        if (phase === 'first-move') {
          const isCorrectFirst =
            move.from === todayPuzzle.solution.from && move.to === todayPuzzle.solution.to;
          if (isCorrectFirst) {
            const { state: newState } = applyMove(currentState, move);
            setCurrentState(newState);
            setSelectedSquare(null);
            setValidTargets([]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            if (isMate2) {
              setPhase('awaiting-ia');
            } else {
              setPhase('solved');
              setSolvedIds((ids) => (ids.includes(todayPuzzle.id) ? ids : [...ids, todayPuzzle.id]));
              addCoins(200);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                () => undefined,
              );
            }
          } else {
            setPhase('wrong');
            setWrongMove(move);
            setWrongFlash(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
              () => undefined,
            );
            setTimeout(() => {
              setWrongFlash(false);
              setWrongMove(null);
              setSelectedSquare(null);
              setValidTargets([]);
              setPhase('first-move');
            }, 1500);
          }
        } else if (phase === 'second-move') {
          const wins = getWinningMoves(currentState, 'P1');
          const isWin = wins.some((m) => m.from === move.from && m.to === move.to);
          if (isWin) {
            const { state: newState } = applyMove(currentState, move);
            setCurrentState(newState);
            setSelectedSquare(null);
            setValidTargets([]);
            setPhase('solved');
            setSolvedIds((ids) => (ids.includes(todayPuzzle.id) ? ids : [...ids, todayPuzzle.id]));
            addCoins(400);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
          } else {
            setPhase('wrong');
            setWrongMove(move);
            setWrongFlash(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
              () => undefined,
            );
            setTimeout(() => {
              setWrongFlash(false);
              setWrongMove(null);
              setSelectedSquare(null);
              setValidTargets([]);
              setPhase('second-move');
            }, 1500);
          }
        }
      }
    },
    [phase, selectedSquare, validTargets, currentState, todayPuzzle, isMate2, addCoins],
  );

  /* IA responde (mate-in-2) — melhor jogada ('perfect') para o puzzle funcionar */
  useEffect(() => {
    if (phase !== 'awaiting-ia') return;
    const timer = setTimeout(() => {
      const iaMove = chooseMove(currentState, 'perfect', Date.now());
      if (iaMove) {
        const { state: newState } = applyMove(currentState, iaMove);
        setCurrentState(newState);
        const wins = getWinningMoves(newState, 'P1');
        setPhase(wins.length > 0 ? 'second-move' : 'first-move');
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [phase, currentState]);

  /* Tabuleiro a mostrar (inclui jogada errada brevemente) */
  const displayState: GameState =
    wrongFlash && wrongMove
      ? (() => {
          const board = [...currentState.board];
          board[wrongMove.from - 1] = null;
          board[wrongMove.to - 1] = 'P1';
          return { ...currentState, board };
        })()
      : currentState;

  const legalMoves: Move[] = selectedSquare
    ? validTargets.map((to) => ({ from: selectedSquare, to }))
    : [];

  const statusMessage =
    phase === 'solved'
      ? t('challenge.status.solved')
      : phase === 'awaiting-ia'
        ? t('challenge.status.ai')
        : phase === 'second-move'
          ? t('challenge.status.second')
          : phase === 'wrong'
            ? t('challenge.status.wrong')
            : isMate2
              ? t('challenge.status.mate2_first')
              : t('challenge.status.first');

  const statusVariant: 'p1' | 'p2' | 'gold' =
    phase === 'solved' ? 'p1' : phase === 'wrong' ? 'p2' : 'gold';

  return (
    <TiraScreen title={t('home.daily_challenge')} showBack>
      {/* Cabeçalho do desafio */}
      <TiraCard glow="gold">
        <View style={{ flexDirection: 'row', gap: spacing[4] }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.xl,
              backgroundColor: alpha(colors.gold, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TiraText style={{ fontSize: 26 }}>🎯</TiraText>
          </View>
          <View style={{ flex: 1, gap: spacing[1] }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              <Badge label={todayPuzzle.difficulty} color={DIFF_BADGE[todayPuzzle.difficulty]} />
              <Badge label={t('challenge.victory_in', { n: todayPuzzle.mateIn })} color="muted" />
              {isTodaySolved ? <Badge label={`✓ ${t('challenge.solved')}`} color="p1" /> : null}
            </View>
            <TiraHeading level="h2" numberOfLines={2}>
              {todayPuzzle.title}
            </TiraHeading>
            <TiraText size="xs" variant="muted">
              {`📅 ${t('challenge.today_line', { reward })}`}
            </TiraText>
          </View>
        </View>
      </TiraCard>

      {/* Descrição + estado */}
      <View style={{ alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[2] }}>
        <TiraText size="sm" align="center">
          {todayPuzzle.description}
        </TiraText>
        <TiraText size="sm" weight="medium" variant={statusVariant} align="center">
          {statusMessage}
        </TiraText>
      </View>

      {/* Tabuleiro do puzzle + overlays */}
      <View style={{ alignItems: 'center' }}>
        <View>
          <Board
            state={displayState}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={
              currentState.history.length > 0
                ? currentState.history[currentState.history.length - 1]
                : wrongMove
            }
            size={boardSize}
            onSquarePress={handleSquareClick}
            testID="challenge-board"
          />
          {phase === 'solved' ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: radii.lg,
                backgroundColor: alpha(colors.bg, 0.7),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: radii.pill,
                  backgroundColor: alpha(colors.p1, 0.2),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <TiraText style={{ fontSize: 44 }}>✓</TiraText>
              </View>
              <TiraHeading level="h2" color="p1">
                {t('challenge.solved')}
              </TiraHeading>
              <TiraText size="xs" variant="gold" style={{ marginTop: spacing[1] }}>
                {t('challenge.reward', { reward })}
              </TiraText>
            </View>
          ) : null}
          {phase === 'awaiting-ia' ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: radii.lg,
                backgroundColor: alpha(colors.bg, 0.4),
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: spacing[2],
              }}
            >
              <ActivityIndicator size="small" color={colors.gold} />
              <TiraText size="sm" weight="medium" variant="gold">
                {t('challenge.status.ai')}
              </TiraText>
            </View>
          ) : null}
          {phase === 'wrong' ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: radii.lg,
                backgroundColor: alpha(colors.p2, 0.2),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TiraText style={{ fontSize: 48 }}>✕</TiraText>
              <TiraHeading level="h3" color="p2" style={{ marginTop: spacing[2] }}>
                {t('challenge.status.wrong')}
              </TiraHeading>
            </View>
          ) : null}
        </View>
      </View>

      {/* Ações */}
      <View style={{ gap: spacing[2] }}>
        {phase !== 'solved' && phase !== 'awaiting-ia' ? (
          <TiraButton variant="outline" fullWidth onPress={() => setShowHint((v) => !v)}>
            {`${showHint ? '💡' : '💡'} ${showHint ? t('challenge.hint.hide') : t('challenge.hint.show')}`}
          </TiraButton>
        ) : null}
        {showHint && phase !== 'solved' ? (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing[3],
              padding: spacing[4],
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: alpha(colors.gold, 0.3),
              backgroundColor: alpha(colors.gold, 0.05),
            }}
          >
            <TiraText size="lg">💡</TiraText>
            <TiraText size="sm" style={{ flex: 1 }}>
              {todayPuzzle.hint}
            </TiraText>
          </View>
        ) : null}
        {phase === 'solved' ? (
          <>
            <TiraButton variant="p1" fullWidth onPress={reset}>
              {`🔄 ${t('challenge.again')}`}
            </TiraButton>
            <TiraButton variant="outline" fullWidth onPress={() => router.push('/offline')}>
              {`▶️ ${t('challenge.play_normal')}`}
            </TiraButton>
          </>
        ) : null}
        {phase !== 'solved' && (selectedSquare || phase === 'wrong') ? (
          <TiraButton variant="ghost" size="sm" fullWidth onPress={reset}>
            {`↺ ${t('challenge.reset')}`}
          </TiraButton>
        ) : null}
      </View>

      {/* Estatísticas de puzzles */}
      <TiraCard>
        <TiraHeading level="h3" style={{ marginBottom: spacing[3] }}>
          {t('challenge.stats')}
        </TiraHeading>
        <View style={{ flexDirection: 'row' }}>
          <StatCol label={t('challenge.solved_count')} value={solvedIds.length} color="gold" />
          <StatCol label={t('challenge.total')} value={PUZZLES.length} color="text" />
          <StatCol
            label={t('challenge.progress')}
            value={`${Math.round((solvedIds.length / PUZZLES.length) * 100)}%`}
            color="p1"
          />
        </View>
      </TiraCard>

      {/* Lista de todos os puzzles */}
      <View style={{ gap: spacing[2] }}>
        <TiraHeading level="h3">{t('challenge.all')}</TiraHeading>
        {PUZZLES.map((p) => (
          <PuzzleRow
            key={p.id}
            puzzle={p}
            solved={solvedIds.includes(p.id)}
            isToday={p.id === todayPuzzle.id}
          />
        ))}
      </View>
    </TiraScreen>
  );
}

function Badge({ label, color }: { label: string; color: ColorToken | 'muted' }) {
  const bg =
    color === 'muted' ? colors.surfaceAlt : alpha(colors[color as ColorToken], 0.15);
  const fg = color === 'muted' ? colors.textMuted : colors[color as ColorToken];
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radii.sm,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
      }}
    >
      <TiraText size="xs" weight="semibold" style={{ color: fg, textTransform: 'uppercase' }}>
        {label}
      </TiraText>
    </View>
  );
}

function StatCol({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: ColorToken;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <TiraHeading level="h2" color={color}>
        {value}
      </TiraHeading>
      <TiraText size="xs" variant="muted" style={{ textTransform: 'uppercase' }}>
        {label}
      </TiraText>
    </View>
  );
}

function PuzzleRow({
  puzzle,
  solved,
  isToday,
}: {
  puzzle: Puzzle;
  solved: boolean;
  isToday: boolean;
}) {
  const { t } = useT();
  return (
    <TiraCard
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        padding: spacing[3],
        opacity: solved ? 0.7 : 1,
        borderColor: isToday ? alpha(colors.gold, 0.4) : colors.border,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radii.lg,
          backgroundColor: solved ? alpha(colors.p1, 0.15) : colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TiraText style={{ fontSize: 18 }}>{solved ? '✅' : puzzle.mateIn === 2 ? '🧩' : '🎯'}</TiraText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <TiraText size="sm" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {puzzle.title}
          </TiraText>
          {isToday ? <Badge label={t('challenge.today_badge')} color="gold" /> : null}
        </View>
        <TiraText size="xs" variant="muted">
          {`${puzzle.difficulty} • ${t('challenge.victory_in', { n: puzzle.mateIn })}`}
        </TiraText>
      </View>
      {solved ? <TiraText size="sm">🏆</TiraText> : null}
    </TiraCard>
  );
}
