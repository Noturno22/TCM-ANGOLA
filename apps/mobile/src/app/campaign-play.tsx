/**
 * CampaignPlay — port do CampaignPlayScreen web: joga um nível da campanha
 * (PvE vs IA com a dificuldade/lado do nível) e avalia o objetivo no fim
 * (vencer / vencer em N jogadas / sobreviver N jogadas).
 *
 * Motor: o mesmo store+hook do modo offline (@/game/useGame agenda a IA);
 * o ecrã só avalia o objetivo e mostra dica/recompensa/reinício.
 */
import { isGameOver, type GameState, type Move, type Square } from '@tira/engine';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getCampaignLevel, type CampaignLevel } from '@/content';
import { useGame } from '@/game/useGame';
import { useT } from '@/lib/i18n/hook';
import type { I18nKey, I18nVars } from '@/lib/i18n';
import { useProfile } from '@/store/profile';
import { boardGeometry, colors, radii, spacing, type ColorToken } from '@/theme';

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
  const {
    state,
    humanSide,
    selectedSquare,
    validTargets,
    lastMove,
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
    setResult(success ? 'success' : 'failure');
    if (success) {
      addCoins(level.reward);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => undefined,
      );
    }
  }, [gameEnded, level, result, startedId, state, moveCount, addCoins]);

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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        attemptMove(sq);
      }
    },
    [state, humanSide, selectedSquare, validTargets, selectSquare, attemptMove],
  );

  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.md,
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );

  const legalMoves: Move[] = useMemo(
    () =>
      selectedSquare ? validTargets.map((to) => ({ from: selectedSquare, to })) : [],
    [selectedSquare, validTargets],
  );

  if (!level) {
    return (
      <TiraScreen title={t('campaign.title')} showBack>
        <TiraCard>
          <View style={{ alignItems: 'center', gap: spacing[3], paddingVertical: spacing[5] }}>
            <TiraText style={{ fontSize: 40, opacity: 0.5 }}>🚩</TiraText>
            <TiraText size="sm" variant="muted" align="center">
              {t('campaign_play.none')}
            </TiraText>
            <TiraButton variant="p1" size="sm" onPress={() => router.replace('/campaign')}>
              {t('campaign_play.back')}
            </TiraButton>
          </View>
        </TiraCard>
      </TiraScreen>
    );
  }

  const flipped = level.humanSide === 'P2';
  const overMax =
    level.objective.type === 'win_fast' &&
    moveCount > (level.objective.maxMoves ?? 0) &&
    !gameEnded;
  const objectiveColor: ColorToken =
    result === 'success' ? 'p1' : result === 'failure' || overMax ? 'p2' : 'gold';

  const nextId = level.id + 1;

  return (
    <TiraScreen
      scroll={false}
      showBack
      title={t('campaign_play.level_of', {
        id: level.id,
        diff: t(`diff.${level.difficulty}`),
      })}
      subtitle={<TiraText size="xs" variant="gold">{level.title}</TiraText>}
      style={{ gap: spacing[4] }}
    >
      <TiraCard
        style={{
          borderColor:
            result === 'success'
              ? alpha(colors.p1, 0.4)
              : result === 'failure'
                ? alpha(colors.p2, 0.4)
                : colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.lg,
              backgroundColor: alpha(colors[objectiveColor], 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TiraText style={{ fontSize: 18 }}>
              {result === 'success' ? '✓' : result === 'failure' ? '✕' : '🎯'}
            </TiraText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <TiraText size="xs" variant="muted" weight="semibold" style={{ textTransform: 'uppercase' }}>
              {t('campaign_play.objective')}
            </TiraText>
            <TiraText size="sm" weight="medium">
              {objectiveText(level, t)}
            </TiraText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <TiraText size="xs" variant="muted">
              {t('game.moves')}
            </TiraText>
            <TiraHeading level="h3" color={objectiveColor}>
              {moveCount}
              {level.objective.maxMoves ? `/${level.objective.maxMoves}` : ''}
              {level.objective.minMoves ? `/${level.objective.minMoves}` : ''}
            </TiraHeading>
          </View>
        </View>
      </TiraCard>

      <View style={{ alignItems: 'center' }}>
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

      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <TiraButton
          variant="outline"
          size="sm"
          style={{ flex: 1 }}
          onPress={() => setShowHint((v) => !v)}
        >
          {`${showHint ? '👁️' : '💡'} ${t('campaign_play.hint')}`}
        </TiraButton>
        <TiraButton variant="p2" size="sm" style={{ flex: 1 }} onPress={handleRestart}>
          {`🔄 ${t('campaign_play.restart')}`}
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
              {level.hint}
            </TiraText>
          </View>
        </TiraCard>
      ) : null}

      {result ? (
        <ResultOverlay
          level={level}
          success={result === 'success'}
          hasNext={getCampaignLevel(nextId) !== null}
          onRestart={handleRestart}
          onNext={() =>
            router.replace({ pathname: '/campaign-play', params: { id: String(nextId) } })
          }
          onBack={() => router.replace('/campaign')}
        />
      ) : null}
    </TiraScreen>
  );
}

function ResultOverlay({
  level,
  success,
  hasNext,
  onRestart,
  onNext,
  onBack,
}: {
  level: CampaignLevel;
  success: boolean;
  hasNext: boolean;
  onRestart: () => void;
  onNext: () => void;
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
        zIndex: 10,
        backgroundColor: alpha(colors.bg, 0.8),
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[6],
      }}
    >
      <TiraCard glow={success ? 'gold' : undefined} style={{ width: '100%', maxWidth: 360 }}>
        <View style={{ alignItems: 'center', gap: spacing[3] }}>
          <TiraText style={{ fontSize: 56 }}>{success ? '🏆' : '😔'}</TiraText>
          <TiraHeading level="h2" color={success ? 'gold' : 'p2'} align="center">
            {success ? t('campaign_play.complete') : t('campaign_play.fail')}
          </TiraHeading>
          <TiraText size="sm" variant="muted" align="center">
            {success ? t('campaign_play.reward_line', { reward: level.reward }) : t('campaign_play.fail.desc')}
          </TiraText>
          <View style={{ width: '100%', gap: spacing[2], marginTop: spacing[3] }}>
            {success ? (
              <>
                {hasNext ? (
                  <TiraButton variant="p1" fullWidth onPress={onNext}>
                    {`➡️ ${t('campaign_play.next')}`}
                  </TiraButton>
                ) : (
                  <TiraButton variant="gold" fullWidth onPress={onBack}>
                    {`🏁 ${t('campaign_play.finish')}`}
                  </TiraButton>
                )}
                <TiraButton variant="outline" fullWidth onPress={onRestart}>
                  {`🔄 ${t('campaign_play.again')}`}
                </TiraButton>
              </>
            ) : (
              <>
                <TiraButton variant="p1" fullWidth onPress={onRestart}>
                  {`🔄 ${t('campaign_play.retry')}`}
                </TiraButton>
                <TiraButton variant="outline" fullWidth onPress={onBack}>
                  {t('campaign_play.back')}
                </TiraButton>
              </>
            )}
          </View>
        </View>
      </TiraCard>
    </View>
  );
}
