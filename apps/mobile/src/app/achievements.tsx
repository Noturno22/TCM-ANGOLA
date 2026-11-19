import { useMemo } from 'react';
import { Lock, Sparkles, Trophy } from 'lucide-react-native';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AchievementIcon } from '@/components/game/achievement-icon';
import { GameCard, SectionTitle } from '@/components/game/ui';
import { TiraScreen, alpha } from '@/components/tira';
import { useProfile, type Achievement } from '@/store/profile';
import { colors, radii, spacing, typography } from '@/theme';

const RING_RADIUS = 28;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function AchievementsScreen() {
  const achievements = useProfile((s) => s.achievements);

  const { unlocked, locked, pct } = useMemo(() => {
    const u = achievements.filter((a) => a.unlockedAt);
    const l = achievements.filter((a) => !a.unlockedAt);
    const p = achievements.length === 0 ? 0 : (u.length / achievements.length) * 100;
    return { unlocked: u, locked: l, pct: p };
  }, [achievements]);

  return (
    <TiraScreen>
      <View>
        <Text style={SCREEN_TITLE}>CONQUISTAS</Text>
        <Text style={SCREEN_SUBTITLE}>Desbloqueia todas as conquistas do jogo.</Text>
      </View>

      <GameCard glow="gold" style={{ padding: spacing[5] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
          <View style={{ width: 64, height: 64, flexShrink: 0 }}>
            <View style={{ width: 64, height: 64, transform: [{ rotate: '-90deg' }] }}>
              <Svg width={64} height={64} viewBox="0 0 64 64">
                <Circle
                  cx={32}
                  cy={32}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={colors.surfaceAlt}
                  strokeWidth={4}
                />
                <Circle
                  cx={32}
                  cy={32}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={colors.gold}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={[RING_CIRCUMFERENCE, RING_CIRCUMFERENCE]}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - pct / 100)}
                />
              </Svg>
            </View>
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trophy size={24} color={colors.gold} />
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={EYEBROW_GOLD}>Progresso total</Text>
            <Text style={PROGRESS_COUNT}>
              {unlocked.length}
              <Text style={PROGRESS_TOTAL}>/{achievements.length}</Text>
            </Text>
            <Text style={PROGRESS_HINT}>
              {unlocked.length === achievements.length
                ? 'Conquista completa!'
                : `${locked.length} por desbloquear`}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: spacing[3] }}>
          <View
            style={{
              height: 6,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceAlt,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: radii.pill,
                backgroundColor: colors.gold,
              }}
            />
          </View>
        </View>
      </GameCard>

      {unlocked.length > 0 ? (
        <View>
          <SectionTitle
            title="Desbloqueadas"
            action={
              <View style={SECTION_ACTION}>
                <Sparkles size={12} color={colors.p1} />
                <Text style={[SECTION_ACTION_TEXT, { color: colors.p1, fontWeight: typography.fontWeight.semibold }]}>
                  {unlocked.length}
                </Text>
              </View>
            }
          />
          <View style={GRID}>
            {unlocked.map((a) => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
          </View>
        </View>
      ) : null}

      {locked.length > 0 ? (
        <View>
          <SectionTitle
            title="Por desbloquear"
            action={
              <View style={SECTION_ACTION}>
                <Lock size={12} color={colors.textMuted} />
                <Text style={[SECTION_ACTION_TEXT, { color: colors.textMuted }]}>
                  {locked.length}
                </Text>
              </View>
            }
          />
          <View style={GRID}>
            {locked.map((a) => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
          </View>
        </View>
      ) : null}

      <Text style={FOOTER}>
        Continua a jogar para desbloquear novas conquistas. Algumas são muito raras!
      </Text>
    </TiraScreen>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const unlocked = Boolean(achievement.unlockedAt);
  const date = achievement.unlockedAt
    ? new Date(achievement.unlockedAt as string).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : null;

  return (
    <View style={{ width: '48%' }}>
      <GameCard
        glow={unlocked ? 'gold' : null}
        style={{
          padding: spacing[3],
          backgroundColor: unlocked ? alpha(colors.gold, 0.06) : alpha(colors.surface, 0.4),
          borderColor: unlocked ? alpha(colors.gold, 0.5) : colors.border,
        }}
      >
        <View style={{ flexDirection: 'column', alignItems: 'center' }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing[2],
              backgroundColor: unlocked ? alpha(colors.gold, 0.15) : colors.surfaceAlt,
              opacity: unlocked ? 1 : 0.5,
            }}
          >
            {unlocked ? (
              <AchievementIcon icon={achievement.icon} size={28} color={colors.gold} />
            ) : (
              <Lock size={20} color={colors.textMuted} />
            )}
          </View>

          <Text
            style={{
              width: '100%',
              fontSize: 13.5,
              lineHeight: 14,
              fontWeight: typography.fontWeight.semibold,
              textAlign: 'center',
              color: unlocked ? colors.text : colors.textMuted,
              fontFamily: typography.fontFamily.body,
            }}
          >
            {achievement.title}
          </Text>

          <Text
            style={{
              width: '100%',
              minHeight: 28,
              marginTop: spacing[1],
              fontSize: 10,
              lineHeight: 12,
              textAlign: 'center',
              color: colors.textMuted,
              fontFamily: typography.fontFamily.body,
            }}
          >
            {achievement.description}
          </Text>

          {unlocked ? (
            <View style={STATUS_ROW}>
              <Sparkles size={10} color={colors.gold} />
              <Text
                style={[
                  STATUS_TEXT,
                  { color: colors.gold, fontWeight: typography.fontWeight.semibold },
                ]}
              >
                {date}
              </Text>
            </View>
          ) : (
            <View style={STATUS_ROW}>
              <Lock size={10} color={colors.textMuted} />
              <Text style={[STATUS_TEXT, { color: colors.textMuted }]}>Bloqueada</Text>
            </View>
          )}
        </View>
      </GameCard>
    </View>
  );
}

const SCREEN_TITLE: TextStyle = {
  fontFamily: typography.fontFamily.display,
  fontSize: typography.fontSize['3xl'],
  letterSpacing: 0.844,
  color: colors.text,
};

const SCREEN_SUBTITLE: TextStyle = {
  marginTop: spacing[1],
  fontSize: typography.fontSize.sm,
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
};

const EYEBROW_GOLD: TextStyle = {
  fontSize: 10,
  letterSpacing: 1.1,
  textTransform: 'uppercase',
  color: colors.gold,
  fontWeight: typography.fontWeight.semibold,
  fontFamily: typography.fontFamily.body,
};

const PROGRESS_COUNT: TextStyle = {
  marginTop: spacing[1],
  fontFamily: typography.fontFamily.display,
  fontSize: typography.fontSize['3xl'],
  letterSpacing: 0.844,
  lineHeight: 33.75,
  color: colors.text,
};

const PROGRESS_TOTAL: TextStyle = {
  fontFamily: typography.fontFamily.body,
  fontSize: typography.fontSize.xl,
  color: colors.textMuted,
};

const PROGRESS_HINT: TextStyle = {
  marginTop: 2,
  fontSize: 11,
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
};

const SECTION_ACTION: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing[1],
};

const SECTION_ACTION_TEXT: TextStyle = {
  fontSize: 11,
  fontFamily: typography.fontFamily.body,
};

const GRID: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
};

const STATUS_ROW: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing[1],
  marginTop: spacing[2],
};

const STATUS_TEXT: TextStyle = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontFamily: typography.fontFamily.body,
};

const FOOTER: TextStyle = {
  paddingTop: spacing[2],
  fontSize: 10,
  lineHeight: 14,
  textAlign: 'center',
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
};
