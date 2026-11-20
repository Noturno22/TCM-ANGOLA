import { isGameOver, type GameState, type Move, type Square } from '@tira/engine';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  ChevronRight,
  Flag,
  Frown,
  Lightbulb,
  RefreshCw,
  Target,
  Trophy,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Board } from '@/components/board/Board';
import { CocoDoMeioPopup } from '@/components/game/CocoDoMeioPopup';
import { GameButton, GameCard } from '@/components/game/ui';
import { TiraHeading, TiraScreen, TiraText, alpha } from '@/components/tira';
import { getCampaignLevel, type CampaignLevel } from '@/content';
import { useGame } from '@/game/useGame';
import { isTrappedInMiddle } from '@/lib/cocoDoMeio';
import type { I18nKey, I18nVars } from '@/lib/i18n';
import { useT } from '@/lib/i18n/hook';
import { useCampaign } from '@/store/campaign';
import { useProfile } from '@/store/profile';
import {
  boardGeometry,
  colors,
  radii,
  spacing,
  type ColorToken,
} from '@/theme';

type ResultType = 'success' | 'failure' | null;

type Translate = (key: I18nKey, vars?: I18nVars) => string;

function checkObjective(
  level: CampaignLevel,
  state: GameState,
  moveCount: number,
): boolean {
  const { objective, humanSide } = level;
  const humanWon = state.winner === humanSide;
  const humanLost = state.winner !== null && !humanWon;
  if (objective.type === 'win') return humanWon;
  if (objective.type === 'win_fast') {
    return humanWon && moveCount <= (objective.maxMoves ?? 0);
  }
  if (humanLost) return false;
  if (humanWon) return true;
  return moveCount >= (objective.minMoves ?? 0);
}

function objectiveText(level: CampaignLevel, t: Translate): string {
  const { objective } = level;
  if (objective.type === 'win') return t('campaign_play.obj.win');
  if (objective.type === 'win_fast') {
    return t('campaign_play.obj.win_fast', { n: objective.maxMoves ?? 0 });
  }
  return t('campaign_play.obj.survive', { n: objective.minMoves ?? 0 });
}

export default function CampaignPlayScreen() {
  const { t } = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const addCoins = useProfile((s) => s.addCoins);
  const completeLevel = useCampaign((s) => s.completeLevel);
  const recordAttempt = useCampaign((s) => s.recordAttempt);
  const {
    state,
    humanSide,
    selectedSquare,
    validTargets,
    lastMove,
    winningLine,
    moveCount,
    startGame,
    selectSquare,
    attemptMove,
  } = useGame();

  const level = useMemo<CampaignLevel | null>(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? getCampaignLevel(parsed) : null;
  }, [params.id]);

  const [result, setResult] = useState<ResultType>(null);
  const [showHint, setShowHint] = useState(false);
  const [startedId, setStartedId] = useState<number | null>(null);

  useEffect(() => {
    if (!level) return;
    setResult(null);
    setShowHint(false);
    startGame({
      mode: 'pve',
      difficulty: level.difficulty,
      humanSide: level.humanSide,
      showThreats: true,
      timePerTurn: 0,
    });
    setStartedId(level.id);
  }, [level, startGame]);

  const gameEnded = isGameOver(state);

  useEffect(() => {
    if (!level || !gameEnded || result !== null || startedId !== level.id) return;
    const success = checkObjective(level, state, moveCount);
    recordAttempt(level.id);
    setResult(success ? 'success' : 'failure');
    if (success) {
      completeLevel(level.id);
      addCoins(level.reward);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => undefined,
      );
    }
  }, [
    addCoins,
    completeLevel,
    gameEnded,
    level,
    moveCount,
    recordAttempt,
    result,
    startedId,
    state,
  ]);

  const handleRestart = useCallback(() => {
    if (!level) return;
    setResult(null);
    setShowHint(false);
    startGame({
      mode: 'pve',
      difficulty: level.difficulty,
      humanSide: level.humanSide,
      showThreats: true,
      timePerTurn: 0,
    });
    setStartedId(level.id);
  }, [level, startGame]);

  const handleSquarePress = useCallback(
    (sq: Square) => {
      if (isGameOver(state)) return;
      if (state.currentPlayer !== humanSide) return;
      const cell = state.board[sq - 1];
      if (cell === state.currentPlayer) {
        Haptics.selectionAsync().catch(() => undefined);
        selectSquare(sq);
      } else if (selectedSquare && validTargets.includes(sq)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
          () => undefined,
        );
        attemptMove(sq);
      }
    },
    [state, humanSide, selectedSquare, validTargets, selectSquare, attemptMove],
  );

  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.lg,
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );
  const resultBoardSize = Math.min(
    boardGeometry.gridSizePresets.sm,
    width -
      spacing[4] * 2 -
      spacing[5] * 2 -
      spacing[3] * 2 -
      boardGeometry.framePadding * 2,
  );

  const legalMoves: Move[] = useMemo(
    () =>
      selectedSquare ? validTargets.map((to) => ({ from: selectedSquare, to })) : [],
    [selectedSquare, validTargets],
  );

  if (!level) {
    return (
      <TiraScreen>
        <GameCard
          style={{ padding: spacing[8], alignItems: 'center' }}
        >
          <Flag size={40} color={colors.textMuted} />
          <TiraText
            size="sm"
            variant="muted"
            align="center"
            style={{ marginTop: spacing[3], marginBottom: spacing[4] }}
          >
            {t('campaign_play.none')}
          </TiraText>
          <GameButton variant="p1" onPress={() => router.replace('/campaign')}>
            {t('campaign_play.back')}
          </GameButton>
        </GameCard>
      </TiraScreen>
    );
  }

  const flipped = level.humanSide === 'P2';
  const overMax =
    level.objective.type === 'win_fast' &&
    moveCount > (level.objective.maxMoves ?? 0);
  const objectiveColor: ColorToken =
    result === 'success' ? 'p1' : result === 'failure' || overMax ? 'p2' : 'gold';
  const hasNext = getCampaignLevel(level.id + 1) !== null;
  const hasWinningLine = Boolean(winningLine && winningLine.length === 3);

  const handleNext = () => {
    const nextId = level.id + 1;
    if (getCampaignLevel(nextId)) {
      router.replace({
        pathname: '/campaign-play',
        params: { id: String(nextId) },
      });
    } else {
      router.replace('/campaign');
    }
  };

  return (
    <TiraScreen
      style={{ gap: 0 }}
      overlay={
        <>
          <CocoDoMeioPopup active={!gameEnded && isTrappedInMiddle(state)} />
          {result ? (
            <ResultOverlay
              level={level}
              success={result === 'success'}
              hasNext={hasNext}
              state={state}
              lastMove={lastMove}
              hasWinningLine={hasWinningLine}
              boardSize={resultBoardSize}
              onNext={handleNext}
              onRestart={handleRestart}
              onBack={() => router.replace('/campaign')}
            />
          ) : null}
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 2, marginBottom: spacing[4] }}>
        <TiraText
          style={{
            fontSize: 10,
            lineHeight: 12,
            letterSpacing: 0.7,
            textTransform: 'uppercase',
            color: colors.textMuted,
          }}
        >
          {t('campaign_play.level_of', {
            id: level.id,
            diff: t(`diff.${level.difficulty}`),
          })}
        </TiraText>
        <TiraText size="xs" weight="medium" variant="gold" numberOfLines={1}>
          {level.title}
        </TiraText>
      </View>

      <GameCard
        style={{
          padding: spacing[3],
          marginBottom: spacing[4],
          borderColor:
            result === 'success'
              ? alpha(colors.p1, 0.4)
              : result === 'failure'
                ? alpha(colors.p2, 0.4)
                : colors.border,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(colors[objectiveColor], 0.15),
            }}
          >
            {result === 'success' ? (
              <Check size={20} color={colors.p1} strokeWidth={3} />
            ) : result === 'failure' ? (
              <X size={20} color={colors.p2} strokeWidth={3} />
            ) : (
              <Target size={20} color={colors.gold} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TiraText
              style={{
                fontSize: 10,
                lineHeight: 12,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: colors.textMuted,
              }}
            >
              {t('campaign_play.objective')}
            </TiraText>
            <TiraText size="sm" weight="medium">
              {objectiveText(level, t)}
            </TiraText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <TiraText
              style={{ fontSize: 10, lineHeight: 12, color: colors.textMuted }}
            >
              {t('game.moves')}
            </TiraText>
            <TiraHeading level="h3" color={overMax ? 'p2' : 'text'} style={{ lineHeight: 31.5 }}>
              {moveCount}
              {level.objective.maxMoves ? `/${level.objective.maxMoves}` : ''}
              {level.objective.minMoves ? `/${level.objective.minMoves}` : ''}
            </TiraHeading>
          </View>
        </View>
      </GameCard>

      <View style={{ alignItems: 'center', marginBottom: spacing[4] }}>
        <Board
          state={state}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          flipped={flipped}
          size={boardSize}
          onSquarePress={handleSquarePress}
          testID="campaign-board"
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: spacing[2],
          width: '100%',
          maxWidth: 448,
          alignSelf: 'center',
        }}
      >
        <GameButton
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => setShowHint((v) => !v)}
        >
          <Lightbulb size={16} color={colors.text} />
          <TiraText size="sm" weight="semibold">
            {t('campaign_play.hint')}
          </TiraText>
        </GameButton>
        <GameButton variant="p2" style={{ flex: 1 }} onPress={handleRestart}>
          <RefreshCw size={16} color={colors.white} />
          <TiraText size="sm" weight="semibold" style={{ color: colors.white }}>
            {t('campaign_play.restart')}
          </TiraText>
        </GameButton>
      </View>

      {showHint ? (
        <GameCard
          style={{
            padding: spacing[4],
            marginTop: spacing[2],
            width: '100%',
            maxWidth: 448,
            alignSelf: 'center',
            backgroundColor: alpha(colors.gold, 0.05),
            borderColor: alpha(colors.gold, 0.3),
          }}
        >
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <View style={{ marginTop: 2 }}>
              <Lightbulb size={20} color={colors.gold} />
            </View>
            <TiraText size="sm" style={{ flex: 1 }}>
              {level.hint}
            </TiraText>
          </View>
        </GameCard>
      ) : null}
    </TiraScreen>
  );
}

function ResultOverlay({
  level,
  success,
  hasNext,
  state,
  lastMove,
  hasWinningLine,
  boardSize,
  onNext,
  onRestart,
  onBack,
}: {
  level: CampaignLevel;
  success: boolean;
  hasNext: boolean;
  state: GameState;
  lastMove: Move | null;
  hasWinningLine: boolean;
  boardSize: number;
  onNext: () => void;
  onRestart: () => void;
  onBack: () => void;
}) {
  const { t } = useT();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        backgroundColor: alpha(colors.bg, 0.95),
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[4],
        }}
      >
        <GameCard
          glow={success ? 'gold' : undefined}
          style={{
            width: '100%',
            maxWidth: 420,
            padding: spacing[5],
            borderColor: success
              ? alpha(colors.p1, 0.4)
              : alpha(colors.p2, 0.4),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[3],
              marginBottom: spacing[3],
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radii.cardLg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: success
                  ? alpha(colors.gold, 0.15)
                  : alpha(colors.p2, 0.15),
              }}
            >
              {success ? (
                <Trophy size={28} color={colors.gold} />
              ) : (
                <Frown size={28} color={colors.p2} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TiraHeading
                level="display"
                color={success ? 'p1' : 'p2'}
                numberOfLines={2}
                style={[
                  { letterSpacing: 0.844, lineHeight: 33.75 },
                  success
                    ? {
                        textShadowColor: alpha(colors.gold, 0.5),
                        textShadowRadius: 12,
                      }
                    : null,
                ]}
              >
                {success
                  ? t('campaign_play.complete')
                  : t('campaign_play.fail')}
              </TiraHeading>
              <TiraText
                size="xs"
                variant="muted"
                style={{ marginTop: spacing[1] }}
              >
                {success
                  ? t('campaign_play.reward_line', { reward: level.reward })
                  : t('campaign_play.fail.desc')}
              </TiraText>
            </View>
          </View>

          <View
            style={{
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: alpha(colors.white, 0.06),
              backgroundColor: alpha(colors.surfaceAlt, 0.6),
              padding: spacing[3],
            }}
          >
            <TiraText
              style={{
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: colors.textMuted,
                marginBottom: spacing[2],
              }}
            >
              {hasWinningLine ? 'Como foi a vitória' : 'Posição final'}
            </TiraText>
            <View style={{ alignItems: 'center' }}>
              <Board
                state={state}
                selectedSquare={null}
                legalMoves={[]}
                lastMove={lastMove}
                size={boardSize}
              />
            </View>
          </View>

          <TiraText
            size="xs"
            variant="muted"
            align="center"
            style={{ marginTop: spacing[3], marginBottom: spacing[4] }}
          >
            {lastMove
              ? `Última jogada: casa ${lastMove.from} → casa ${lastMove.to}`
              : 'Nenhuma linha foi completada.'}
          </TiraText>

          <View style={{ gap: spacing[2] }}>
            {success ? (
              <>
                <GameButton
                  variant="p1"
                  style={{ width: '100%' }}
                  onPress={onNext}
                >
                  <ChevronRight size={16} color={colors.white} />
                  <TiraText
                    size="sm"
                    weight="semibold"
                    style={{ color: colors.white }}
                  >
                    {hasNext
                      ? t('campaign_play.next')
                      : t('campaign_play.finish')}
                  </TiraText>
                </GameButton>
                <GameButton
                  variant="outline"
                  style={{ width: '100%' }}
                  onPress={onRestart}
                >
                  <RefreshCw size={16} color={colors.text} />
                  <TiraText size="sm" weight="semibold">
                    {t('campaign_play.again')}
                  </TiraText>
                </GameButton>
              </>
            ) : (
              <>
                <GameButton
                  variant="p1"
                  style={{ width: '100%' }}
                  onPress={onRestart}
                >
                  <RefreshCw size={16} color={colors.white} />
                  <TiraText
                    size="sm"
                    weight="semibold"
                    style={{ color: colors.white }}
                  >
                    {t('campaign_play.retry')}
                  </TiraText>
                </GameButton>
                <GameButton
                  variant="outline"
                  style={{ width: '100%' }}
                  onPress={onBack}
                >
                  <TiraText size="sm" weight="semibold">
                    {t('campaign_play.back')}
                  </TiraText>
                </GameButton>
              </>
            )}
          </View>
        </GameCard>
      </ScrollView>
    </View>
  );
}
