/**
 * Campaign — port do CampaignScreen web: lista dos 8 níveis da campanha
 * com objetivo/recompensa/dificuldade, barra de progresso e desbloqueio.
 *
 * Desbloqueio (adaptado ao mobile): um nível abre quando a dificuldade
 * está desbloqueada em `useProgression` (a mesma progressão que governa
 * o modo Offline) e o nível anterior está completo. O estado "completo"
 * é derivado do histórico de partidas (`useProfile.matches`): existe uma
 * vitória PvE nessa dificuldade com o lado exigido pelo nível. Assim a
 * campanha persiste sem um store novo — dados reais, offline.
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { CAMPAIGN_LEVELS, TOTAL_CAMPAIGN_LEVELS, type CampaignLevel } from '@/content';
import {
  Pill,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { useT } from '@/lib/i18n/hook';
import { useProfile, type MatchRecord } from '@/store/profile';
import { useProgression } from '@/store/progression';
import { colors, radii, spacing } from '@/theme';

type DifficultyLabelKey = 'diff.easy' | 'diff.medium' | 'diff.hard' | 'diff.perfect';

const DIFF_KEY: Record<CampaignLevel['difficulty'], DifficultyLabelKey> = {
  easy: 'diff.easy',
  medium: 'diff.medium',
  hard: 'diff.hard',
  perfect: 'diff.perfect',
};

function levelCompleted(level: CampaignLevel, matches: MatchRecord[]): boolean {
  return matches.some(
    (m) =>
      m.mode === 'pve' &&
      m.difficulty === level.difficulty &&
      m.playerSide === level.humanSide &&
      m.result === level.humanSide,
  );
}

function attemptsFor(level: CampaignLevel, matches: MatchRecord[]): number {
  return matches.filter(
    (m) =>
      m.mode === 'pve' &&
      m.difficulty === level.difficulty &&
      m.playerSide === level.humanSide,
  ).length;
}

export default function CampaignScreen() {
  const { t } = useT();
  const router = useRouter();
  const matches = useProfile((s) => s.matches);
  const unlocked = useProgression((s) => s.unlocked);

  const completedIds = useMemo(
    () => new Set(CAMPAIGN_LEVELS.filter((l) => levelCompleted(l, matches)).map((l) => l.id)),
    [matches],
  );
  const progressPct = Math.round((completedIds.size / TOTAL_CAMPAIGN_LEVELS) * 100);

  const isUnlocked = (level: CampaignLevel): boolean => {
    if (!unlocked[level.difficulty]) return false;
    const prev = CAMPAIGN_LEVELS.find((l) => l.id === level.id - 1);
    return !prev || completedIds.has(prev.id);
  };

  const currentId =
    CAMPAIGN_LEVELS.find((l) => !completedIds.has(l.id) && isUnlocked(l))?.id ?? null;

  const openLevel = (level: CampaignLevel) => {
    if (!isUnlocked(level)) return;
    router.push({ pathname: '/campaign-play', params: { id: String(level.id) } });
  };

  return (
    <TiraScreen title={t('campaign.title')} showBack>
      <TiraCard glow="gold">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
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
            <TiraText style={{ fontSize: 26 }}>🚩</TiraText>
          </View>
          <View style={{ flex: 1, gap: spacing[1] }}>
            <TiraHeading level="h2">{t('campaign.title')}</TiraHeading>
            <TiraText size="xs" variant="muted">
              {t('campaign.progress', {
                done: completedIds.size,
                total: TOTAL_CAMPAIGN_LEVELS,
              })}
            </TiraText>
            <View
              style={{
                height: 8,
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceAlt,
                overflow: 'hidden',
                marginTop: spacing[1],
              }}
            >
              <View
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  backgroundColor: colors.gold,
                  borderRadius: radii.pill,
                }}
              />
            </View>
          </View>
        </View>
      </TiraCard>

      <View style={{ gap: spacing[2] }}>
        {CAMPAIGN_LEVELS.map((level) => {
          const completed = completedIds.has(level.id);
          const open = isUnlocked(level);
          const isCurrent = level.id === currentId;
          const attempts = attemptsFor(level, matches);

          return (
            <Pressable
              key={level.id}
              accessibilityRole="button"
              accessibilityState={{ disabled: !open }}
              accessibilityLabel={level.title}
              disabled={!open}
              onPress={() => openLevel(level)}
              style={({ pressed }) => ({
                opacity: !open ? 0.55 : pressed ? 0.85 : 1,
              })}
            >
              <TiraCard
                style={{
                  borderColor: completed
                    ? alpha(colors.p1, 0.35)
                    : isCurrent
                      ? alpha(colors.gold, 0.5)
                      : colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radii.lg,
                      backgroundColor: completed
                        ? alpha(colors.p1, 0.15)
                        : open
                          ? alpha(colors.gold, 0.15)
                          : colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {completed ? (
                      <TiraText size="lg" variant="p1" weight="bold">
                        ✓
                      </TiraText>
                    ) : open ? (
                      <TiraHeading level="h3">{level.id}</TiraHeading>
                    ) : (
                      <TiraText size="sm" variant="muted">
                        🔒
                      </TiraText>
                    )}
                  </View>

                  <View style={{ flex: 1, gap: spacing[1] }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                      <TiraText
                        size="sm"
                        weight="semibold"
                        variant={completed ? 'p1' : isCurrent ? 'gold' : 'default'}
                        numberOfLines={1}
                        style={{ flexShrink: 1 }}
                      >
                        {level.title}
                      </TiraText>
                      {isCurrent ? <Pill active>{t('campaign.current')}</Pill> : null}
                    </View>
                    <TiraText size="xs" variant="muted">
                      {level.description}
                    </TiraText>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: spacing[2],
                        marginTop: spacing[1],
                      }}
                    >
                      <TiraText size="xs" variant="muted">
                        🎯 {t(DIFF_KEY[level.difficulty])}
                      </TiraText>
                      <TiraText size="xs" variant="gold">
                        🏆 {level.reward} KZ
                      </TiraText>
                      {level.humanSide === 'P2' ? (
                        <TiraText size="xs" variant="p2">
                          👑 {t('campaign.red_side')}
                        </TiraText>
                      ) : null}
                      {level.objective.type === 'win_fast' ? (
                        <TiraText size="xs" variant="orange">
                          ⚡ {t('campaign.win_fast_tag', { n: level.objective.maxMoves ?? 0 })}
                        </TiraText>
                      ) : null}
                      {level.objective.type === 'survive' ? (
                        <TiraText size="xs" variant="orange">
                          ⏱️ {t('campaign.survive_tag', { n: level.objective.minMoves ?? 0 })}
                        </TiraText>
                      ) : null}
                      {!open ? (
                        <TiraText size="xs" variant="muted" style={{ marginLeft: 'auto' }}>
                          🔒
                        </TiraText>
                      ) : attempts > 0 ? (
                        <TiraText size="xs" variant="muted" style={{ marginLeft: 'auto' }}>
                          {attempts === 1
                            ? t('campaign.attempts', { n: attempts })
                            : t('campaign.attempts.plural', { n: attempts })}
                        </TiraText>
                      ) : null}
                    </View>
                    {!open ? (
                      <TiraText size="xs" variant="muted" style={{ marginTop: spacing[1] }}>
                        {unlocked[level.difficulty]
                          ? t('campaign.locked_hint')
                          : t('campaign.locked_progress')}
                      </TiraText>
                    ) : null}
                  </View>

                  {open ? (
                    <TiraText size="lg" variant="muted" style={{ marginTop: spacing[1] }}>
                      ›
                    </TiraText>
                  ) : null}
                </View>
              </TiraCard>
            </Pressable>
          );
        })}
      </View>

      <TiraCard style={{ borderColor: alpha(colors.gold, 0.3), backgroundColor: alpha(colors.gold, 0.05) }}>
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <TiraText size="lg">🏆</TiraText>
          <View style={{ flex: 1, gap: spacing[1] }}>
            <TiraText size="sm" weight="semibold">
              {t('campaign.tip.title')}
            </TiraText>
            <TiraText size="xs" variant="muted">
              {t('campaign.tip.desc')}
            </TiraText>
          </View>
        </View>
      </TiraCard>
    </TiraScreen>
  );
}
