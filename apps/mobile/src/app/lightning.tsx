/**
 * Lightning — port do LightningChallengeScreen web: Desafio Relâmpago.
 * 5 puzzles aleatórios (mate-in-1/2) com cronómetro total; +100 KZ por
 * puzzle resolvido e +500 KZ de bónus por completar os 5.
 *
 * Dados dos puzzles: `@/content`. Regras de vitória: sempre o motor
 * (@tira/engine). Recordes do run ficam na sessão deste ecrã (a store
 * persistida de relâmpago é exclusiva da web); as moedas vão para o
 * perfil real (@/store/profile).
 */
import {
  DEFAULT_CONFIG,
  applyMove,
  getLegalMoves,
  getWinningMoves,
  type Cell,
  type GameState,
  type Move,
  type Square,
} from '@tira/engine';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Board } from '@/components/board/Board';
import {
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { PUZZLES, type Puzzle } from '@/content';
import { useT } from '@/lib/i18n/hook';
import { useProfile } from '@/store/profile';
import { boardGeometry, colors, radii, spacing } from '@/theme';

type Phase = 'intro' | 'playing' | 'finished';
type Feedback = 'none' | 'correct' | 'wrong';

interface PuzzleResult {
  id: string;
  solved: boolean;
  timeSec: number;
}

const RUN_SIZE = 5;
const REWARD_PER_PUZZLE = 100;
const REWARD_ALL_BONUS = 500;

function makeState(board: Cell[]): GameState {
  return {
    board,
    currentPlayer: 'P1',
    status: 'PLAYER_1_TURN',
    winner: null,
    winningLine: null,
    moveCount: 0,
    history: [],
    positionCounts: {},
    config: DEFAULT_CONFIG,
  };
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(sec: number): string {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function LightningScreen() {
  const { t } = useT();
  const router = useRouter();
  const addCoins = useProfile((s) => s.addCoins);
  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.md,
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );

  const [runPuzzles] = useState<readonly Puzzle[]>(() => shuffle(PUZZLES).slice(0, RUN_SIZE));
  const [phase, setPhase] = useState<Phase>('intro');
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [currentState, setCurrentState] = useState<GameState>(() =>
    makeState(runPuzzles[0].board),
  );
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validTargets, setValidTargets] = useState<Square[]>([]);
  const [feedback, setFeedback] = useState<Feedback>('none');
  const [results, setResults] = useState<PuzzleResult[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [puzzleStartTime, setPuzzleStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [bestTimeSec, setBestTimeSec] = useState<number | null>(null);
  const [bestSolved, setBestSolved] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const feedbackBusy = useRef(false);

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 200);
    return () => clearInterval(timer);
  }, [phase, startTime]);

  const currentPuzzle = runPuzzles[puzzleIndex];
  const puzzleElapsed = Math.floor((Date.now() - puzzleStartTime) / 1000);

  const startRun = useCallback(() => {
    setPhase('playing');
    setPuzzleIndex(0);
    setResults([]);
    setStartTime(Date.now());
    setPuzzleStartTime(Date.now());
    setElapsed(0);
    setCurrentState(makeState(runPuzzles[0].board));
    setSelectedSquare(null);
    setValidTargets([]);
    setFeedback('none');
    setShowHint(false);
    setNewRecord(false);
    feedbackBusy.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }, [runPuzzles]);

  const nextPuzzle = useCallback(
    (solved: boolean) => {
      const timeSec = Math.max(0, Math.floor((Date.now() - puzzleStartTime) / 1000));
      const newResults: PuzzleResult[] = [
        ...results,
        { id: currentPuzzle.id, solved, timeSec },
      ];
      setResults(newResults);

      if (solved) {
        addCoins(REWARD_PER_PUZZLE);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
      }

      if (puzzleIndex + 1 >= runPuzzles.length) {
        const solvedCount = newResults.filter((r) => r.solved).length;
        const totalTimeSec = newResults.reduce((sum, r) => sum + r.timeSec, 0);
        const isPerfect = solvedCount === RUN_SIZE;
        const wasRecord = isPerfect && (bestTimeSec === null || totalTimeSec < bestTimeSec);
        setTotalRuns((n) => n + 1);
        setBestSolved((best) => Math.max(best, solvedCount));
        if (wasRecord) setBestTimeSec(totalTimeSec);
        setNewRecord(wasRecord);
        if (isPerfect) {
          addCoins(REWARD_ALL_BONUS);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => undefined,
          );
        }
        setPhase('finished');
        return;
      }

      const nextIndex = puzzleIndex + 1;
      setPuzzleIndex(nextIndex);
      setCurrentState(makeState(runPuzzles[nextIndex].board));
      setSelectedSquare(null);
      setValidTargets([]);
      setFeedback('none');
      setShowHint(false);
      setPuzzleStartTime(Date.now());
      feedbackBusy.current = false;
    },
    [puzzleIndex, puzzleStartTime, results, runPuzzles, currentPuzzle, addCoins, bestTimeSec],
  );

  const handleSquarePress = useCallback(
    (sq: Square) => {
      if (feedback !== 'none' || feedbackBusy.current) return;
      const piece = currentState.board[sq - 1];
      if (piece === 'P1') {
        const legal = getLegalMoves(currentState, 'P1');
        const targets = legal.filter((m) => m.from === sq).map((m) => m.to);
        Haptics.selectionAsync().catch(() => undefined);
        setSelectedSquare(sq);
        setValidTargets(targets);
        return;
      }
      if (!selectedSquare || !validTargets.includes(sq)) return;

      const move: Move = { from: selectedSquare, to: sq };
      const wins = getWinningMoves(currentState, 'P1');
      const isWin = wins.some((m) => m.from === move.from && m.to === move.to);
      const isFirstOfMate2 =
        !isWin &&
        currentPuzzle.mateIn === 2 &&
        move.from === currentPuzzle.solution.from &&
        move.to === currentPuzzle.solution.to;

      if (isWin || isFirstOfMate2) {
        feedbackBusy.current = true;
        const { state: newState } = applyMove(currentState, move);
        setCurrentState(newState);
        setSelectedSquare(null);
        setValidTargets([]);
        setFeedback('correct');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
        const delay = isWin ? 900 : 1200;
        setTimeout(() => nextPuzzle(true), delay);
      } else {
        feedbackBusy.current = true;
        setFeedback('wrong');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        setTimeout(() => {
          setFeedback('none');
          setSelectedSquare(null);
          setValidTargets([]);
          feedbackBusy.current = false;
        }, 1000);
      }
    },
    [feedback, currentState, selectedSquare, validTargets, currentPuzzle, nextPuzzle],
  );

  const skipPuzzle = useCallback(() => {
    if (feedbackBusy.current) return;
    nextPuzzle(false);
  }, [nextPuzzle]);

  const legalMoves: Move[] = useMemo(
    () =>
      selectedSquare ? validTargets.map((to) => ({ from: selectedSquare, to })) : [],
    [selectedSquare, validTargets],
  );

  if (phase === 'intro') {
    return (
      <TiraScreen title={t('lightning.title')} showBack>
        <TiraCard glow="gold">
          <View style={{ alignItems: 'center', gap: spacing[3] }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radii.xl,
                backgroundColor: alpha(colors.gold, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TiraText style={{ fontSize: 30 }}>⚡</TiraText>
            </View>
            <TiraHeading level="h2" align="center">
              {t('lightning.title')}
            </TiraHeading>
            <TiraText size="sm" variant="muted" align="center">
              {t('lightning.desc')}
            </TiraText>

            {totalRuns > 0 ? (
              <View style={{ flexDirection: 'row', marginTop: spacing[2] }}>
                <StatCol
                  value={bestTimeSec !== null ? formatTime(bestTimeSec) : '—'}
                  label={t('lightning.best_time')}
                  color="gold"
                />
                <StatCol
                  value={`${bestSolved}/${RUN_SIZE}`}
                  label={t('lightning.best_result')}
                  color="p1"
                />
                <StatCol value={totalRuns} label={t('lightning.attempts')} color="text" />
              </View>
            ) : null}

            <TiraButton variant="gold" size="lg" fullWidth onPress={startRun}>
              {`▶️ ${t('lightning.start')}`}
            </TiraButton>
            {totalRuns > 0 ? (
              <TiraText size="xs" variant="muted" align="center">
                {t('lightning.records_local')}
              </TiraText>
            ) : null}
          </View>
        </TiraCard>

        <TiraCard>
          <TiraHeading level="h3" style={{ marginBottom: spacing[2] }}>
            {t('lightning.how')}
          </TiraHeading>
          <View style={{ gap: spacing[1] }}>
            <TiraText size="sm" variant="muted">{t('lightning.rule1')}</TiraText>
            <TiraText size="sm" variant="muted">{t('lightning.rule2')}</TiraText>
            <TiraText size="sm" variant="muted">{t('lightning.rule3')}</TiraText>
            <TiraText size="sm" variant="muted">{t('lightning.rule4')}</TiraText>
            <TiraText size="sm" variant="muted">{t('lightning.rule5')}</TiraText>
          </View>
        </TiraCard>

        <TiraButton
          variant="outline"
          fullWidth
          onPress={() => router.push('/challenge')}
        >
          {`${t('lightning.daily')} ›`}
        </TiraButton>
      </TiraScreen>
    );
  }

  if (phase === 'finished') {
    const solvedCount = results.filter((r) => r.solved).length;
    const totalTime = results.reduce((sum, r) => sum + r.timeSec, 0);
    const isPerfect = solvedCount === RUN_SIZE;

    return (
      <TiraScreen title={t('lightning.title')} showBack>
        <TiraCard glow={isPerfect ? 'gold' : undefined}>
          <View style={{ alignItems: 'center', gap: spacing[2] }}>
            <TiraText style={{ fontSize: 56 }}>{isPerfect ? '🏆' : solvedCount >= 3 ? '🥈' : '🎯'}</TiraText>
            <TiraHeading level="h2" color={isPerfect ? 'gold' : 'text'} align="center">
              {isPerfect ? t('lightning.perfect') : t('lightning.result_title', { n: solvedCount })}
            </TiraHeading>
            <TiraText size="sm" variant="muted">
              {t('lightning.total_time', { time: formatTime(totalTime) })}
            </TiraText>
            {newRecord ? (
              <TiraText size="sm" weight="bold" variant="p1" align="center">
                {t('lightning.new_record')}
              </TiraText>
            ) : null}
          </View>
        </TiraCard>

        <View style={{ gap: spacing[2] }}>
          {results.map((r, i) => (
            <TiraCard key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radii.pill,
                  backgroundColor: r.solved ? alpha(colors.p1, 0.15) : alpha(colors.p2, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TiraText size="xs" variant={r.solved ? 'p1' : 'p2'} weight="bold">
                  {r.solved ? '✓' : '✕'}
                </TiraText>
              </View>
              <TiraText size="xs" variant="muted" style={{ flex: 1 }}>
                {t('lightning.puzzle_n', { n: i + 1 })}
              </TiraText>
              <TiraText size="xs">{`${r.timeSec}s`}</TiraText>
            </TiraCard>
          ))}
        </View>

        <View style={{ gap: spacing[2] }}>
          <TiraButton variant="gold" fullWidth onPress={startRun}>
            {`🔄 ${t('lightning.again')}`}
          </TiraButton>
          <TiraButton variant="outline" fullWidth onPress={() => router.replace('/')}>
            {t('lightning.back_home')}
          </TiraButton>
        </View>
      </TiraScreen>
    );
  }

  const statusText =
    feedback === 'correct'
      ? t('lightning.solved')
      : feedback === 'wrong'
        ? t('lightning.wrong')
        : currentPuzzle.mateIn === 2
          ? t('lightning.status.mate2')
          : t('lightning.status.mate1');
  const statusVariant = feedback === 'correct' ? 'p1' : feedback === 'wrong' ? 'p2' : 'muted';

  return (
    <TiraScreen scroll={false} showBack title={t('lightning.title')} style={{ gap: spacing[3] }}>
      <TiraCard style={{ padding: spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] }}>
          <View style={{ gap: 2 }}>
            <TiraText size="xs" variant="muted" weight="semibold" style={{ textTransform: 'uppercase' }}>
              {t('lightning.puzzle_of', { n: puzzleIndex + 1, total: runPuzzles.length })}
            </TiraText>
            <TiraHeading level="h2" color="gold">
              {formatTime(elapsed)}
            </TiraHeading>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing[1] }}>
            {runPuzzles.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 28,
                  borderRadius: radii.pill,
                  backgroundColor:
                    i < puzzleIndex
                      ? colors.p1
                      : i === puzzleIndex
                        ? colors.gold
                        : colors.surfaceAlt,
                }}
              />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TiraText size="xs" variant="muted" numberOfLines={1} style={{ flex: 1 }}>
            {`${currentPuzzle.title} • ${currentPuzzle.difficulty} • ${t('challenge.victory_in', { n: currentPuzzle.mateIn })}`}
          </TiraText>
          <TiraText size="xs" variant="gold">{`⏱️ ${puzzleElapsed}s`}</TiraText>
        </View>
      </TiraCard>

      <TiraText size="sm" weight="medium" variant={statusVariant} align="center" numberOfLines={2}>
        {statusText}
      </TiraText>

      <View style={{ alignItems: 'center' }}>
        <View>
          <Board
            state={currentState}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={
              currentState.history.length > 0
                ? currentState.history[currentState.history.length - 1]
                : null
            }
            size={boardSize}
            onSquarePress={handleSquarePress}
            testID="lightning-board"
          />
          {feedback === 'correct' ? (
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
              <TiraText style={{ fontSize: 64 }} variant="p1">
                ✓
              </TiraText>
            </View>
          ) : null}
          {feedback === 'wrong' ? (
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
              <TiraText style={{ fontSize: 64 }} variant="p2">
                ✕
              </TiraText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <TiraButton
          variant="outline"
          size="sm"
          style={{ flex: 1 }}
          onPress={() => setShowHint((v) => !v)}
        >
          {`${showHint ? '👁️' : '💡'} ${t('lightning.hint')}`}
        </TiraButton>
        <TiraButton variant="p2" size="sm" style={{ flex: 1 }} onPress={skipPuzzle}>
          {`⏭️ ${t('lightning.skip')}`}
        </TiraButton>
      </View>

      {showHint ? (
        <TiraCard
          style={{
            borderColor: alpha(colors.gold, 0.3),
            backgroundColor: alpha(colors.gold, 0.05),
          }}
        >
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <TiraText size="lg">💡</TiraText>
            <TiraText size="sm" style={{ flex: 1 }}>
              {currentPuzzle.hint}
            </TiraText>
          </View>
        </TiraCard>
      ) : null}
    </TiraScreen>
  );
}

function StatCol({
  value,
  label,
  color,
}: {
  value: number | string;
  label: string;
  color: 'gold' | 'p1' | 'text';
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <TiraHeading level="h2" color={color}>
        {value}
      </TiraHeading>
      <TiraText size="xs" variant="muted" align="center" style={{ textTransform: 'uppercase' }}>
        {label}
      </TiraText>
    </View>
  );
}
