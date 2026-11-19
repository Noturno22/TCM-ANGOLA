import { useRouter } from 'expo-router';
import {
  Check,
  ChevronRight,
  Clock,
  Crown,
  Flag,
  Lock,
  Star,
  Target,
  Trophy,
  Zap,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';
import { GameCard } from '@/components/game/ui';
import { TiraHeading, TiraScreen, TiraText, alpha } from '@/components/tira';
import {
  CAMPAIGN_LEVELS,
  TOTAL_CAMPAIGN_LEVELS,
  type CampaignLevel,
} from '@/content';
import { useT } from '@/lib/i18n/hook';
import { useCampaign } from '@/store/campaign';
import { colors, radii, spacing, typography } from '@/theme';

export default function CampaignScreen() {
  const { t } = useT();
  const router = useRouter();
  const completed = useCampaign((s) => s.completed);
  const currentLevel = useCampaign((s) => s.currentLevel);
  const attemptsByLevel = useCampaign((s) => s.attemptsByLevel);

  const completedCount = completed.length;
  const progressPct = Math.round((completedCount / TOTAL_CAMPAIGN_LEVELS) * 100);

  const handlePlay = (level: CampaignLevel) => {
    if (level.id > currentLevel) return;
    router.push({ pathname: '/campaign-play', params: { id: String(level.id) } });
  };

  return (
    <TiraScreen>
      <GameCard glow="gold" style={{ padding: spacing[5] }}>
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
            <Flag size={28} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <TiraHeading level="h2" style={{ letterSpacing: 0.675, lineHeight: 36 }}>{t('campaign.title')}</TiraHeading>
            <TiraText size="xs" variant="muted">
              {t('campaign.progress', {
                done: completedCount,
                total: TOTAL_CAMPAIGN_LEVELS,
              })}
            </TiraText>
            <View
              style={{
                height: 8,
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceAlt,
                overflow: 'hidden',
                marginTop: spacing[2],
              }}
            >
              <View style={{ width: `${progressPct}%`, height: '100%' }}>
                <Svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 8"
                  preserveAspectRatio="none"
                >
                  <Defs>
                    <LinearGradient
                      id="campaignProgress"
                      x1={0}
                      y1={0}
                      x2={100}
                      y2={0}
                      gradientUnits="userSpaceOnUse"
                    >
                      <Stop offset={0} stopColor={colors.p1} />
                      <Stop offset={1} stopColor={colors.gold} />
                    </LinearGradient>
                  </Defs>
                  <Rect
                    x={0}
                    y={0}
                    width={100}
                    height={8}
                    fill="url(#campaignProgress)"
                  />
                </Svg>
              </View>
            </View>
          </View>
        </View>
      </GameCard>

      <View style={{ gap: 10 }}>
        {CAMPAIGN_LEVELS.map((level) => {
          const isCompleted = completed.includes(level.id);
          const isUnlocked = level.id <= currentLevel;
          const isCurrent = level.id === currentLevel && !isCompleted;
          const attempts = attemptsByLevel[level.id] ?? 0;

          return (
            <Pressable
              key={level.id}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isUnlocked }}
              accessibilityLabel={level.title}
              disabled={!isUnlocked}
              onPress={() => handlePlay(level)}
              style={({ pressed }) => ({
                opacity: !isUnlocked ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <GameCard
                style={{
                  padding: spacing[4],
                  borderColor: isCompleted
                    ? alpha(colors.p1, 0.3)
                    : isCurrent
                      ? alpha(colors.gold, 0.5)
                      : colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing[3],
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radii.xl,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isCompleted
                        ? alpha(colors.p1, 0.15)
                        : isCurrent
                          ? alpha(colors.gold, 0.15)
                          : isUnlocked
                            ? colors.surfaceAlt
                            : alpha(colors.surfaceAlt, 0.5),
                    }}
                  >
                    {isCompleted ? (
                      <Check size={24} color={colors.p1} strokeWidth={3} />
                    ) : isUnlocked ? (
                      <TiraText
                        style={{
                          fontFamily: typography.fontFamily.display,
                          fontSize: 20.25,
                          letterSpacing: 0.405,
                          lineHeight: 31.5,
                          color: colors.text,
                        }}
                      >
                        {level.id}
                      </TiraText>
                    ) : (
                      <Lock size={20} color={colors.textMuted} />
                    )}
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing[2],
                        marginBottom: 2,
                      }}
                    >
                      <TiraText
                        numberOfLines={1}
                        style={{
                          fontFamily: typography.fontFamily.display,
                          fontSize: 18,
                          lineHeight: 22.5,
                          letterSpacing: 0.36,
                          color: isCompleted
                            ? colors.p1
                            : isCurrent
                              ? colors.gold
                              : colors.text,
                          flexShrink: 1,
                        }}
                      >
                        {level.title}
                      </TiraText>
                      {isCurrent ? (
                        <TiraText
                          style={{
                            fontSize: 9,
                            lineHeight: 11,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            overflow: 'hidden',
                            backgroundColor: alpha(colors.gold, 0.15),
                            color: colors.gold,
                            fontWeight: typography.fontWeight.semibold,
                            textTransform: 'uppercase',
                          }}
                        >
                          {t('campaign.current')}
                        </TiraText>
                      ) : null}
                      {isCompleted ? (
                        <Star size={14} color={colors.gold} fill={colors.gold} />
                      ) : null}
                    </View>

                    <TiraText
                      style={{
                        fontSize: 11,
                        lineHeight: 13,
                        color: colors.textMuted,
                        marginBottom: spacing[2],
                      }}
                    >
                      {level.description}
                    </TiraText>

                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: spacing[3],
                      }}
                    >
                      <Meta
                        icon={<Target size={12} color={colors.textMuted} />}
                        text={t(`diff.${level.difficulty}`)}
                        color={colors.textMuted}
                      />
                      <Meta
                        icon={<Trophy size={12} color={colors.gold} />}
                        text={`${level.reward} KZ`}
                        color={colors.gold}
                      />
                      {level.humanSide === 'P2' ? (
                        <Meta
                          icon={<Crown size={12} color={colors.p2} />}
                          text={t('campaign.red_side')}
                          color={colors.p2}
                        />
                      ) : null}
                      {level.objective.type === 'win_fast' ? (
                        <Meta
                          icon={<Zap size={12} color={colors.orange} />}
                          text={t('campaign.win_fast_tag', {
                            n: level.objective.maxMoves ?? 0,
                          })}
                          color={colors.orange}
                        />
                      ) : null}
                      {level.objective.type === 'survive' ? (
                        <Meta
                          icon={<Clock size={12} color={colors.orange} />}
                          text={t('campaign.survive_tag', {
                            n: level.objective.minMoves ?? 0,
                          })}
                          color={colors.orange}
                        />
                      ) : null}
                      {attempts > 0 ? (
                        <TiraText
                          style={{
                            fontSize: 10,
                            color: colors.textMuted,
                            marginLeft: 'auto',
                          }}
                        >
                          {attempts === 1
                            ? t('campaign.attempts', { n: attempts })
                            : t('campaign.attempts.plural', { n: attempts })}
                        </TiraText>
                      ) : null}
                    </View>
                  </View>

                  {isUnlocked ? (
                    <View style={{ marginTop: spacing[1] }}>
                      <ChevronRight
                        size={20}
                        color={isCompleted ? colors.p1 : colors.textMuted}
                      />
                    </View>
                  ) : null}
                </View>
              </GameCard>
            </Pressable>
          );
        })}
      </View>

      <GameCard
        style={{
          padding: spacing[4],
          backgroundColor: alpha(colors.gold, 0.05),
          borderColor: alpha(colors.gold, 0.3),
        }}
      >
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <View style={{ marginTop: 2 }}>
            <Trophy size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <TiraText size="sm" weight="semibold" style={{ marginBottom: spacing[1] }}>
              {t('campaign.tip.title')}
            </TiraText>
            <TiraText style={{ fontSize: 11, lineHeight: 18, color: colors.textMuted }}>
              {t('campaign.tip.desc')}
            </TiraText>
          </View>
        </View>
      </GameCard>
    </TiraScreen>
  );
}

function Meta({
  icon,
  text,
  color,
}: {
  icon: ReactNode;
  text: string;
  color: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
      {icon}
      <TiraText style={{ fontSize: 10, color }}>{text}</TiraText>
    </View>
  );
}
