import { useMemo, useState, type ComponentType } from 'react';
import { Crown, Flame, Globe2, Medal, Trophy, Users } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { GameCard, LevelAvatar, SectionTitle } from '@/components/game/ui';
import { TiraScreen, alpha } from '@/components/tira';
import { getSimulatedRankings, useProfile } from '@/store/profile';
import { colors, radii, spacing, typography } from '@/theme';

type Tab = 'weekly' | 'global' | 'friends';
type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface RankingEntry {
  name: string;
  elo: number;
  level: number;
  wins: number;
  isMe: boolean;
  avatar?: string;
}

const TABS: { id: Tab; label: string; icon: IconType }[] = [
  { id: 'weekly', label: 'Semanal', icon: Flame },
  { id: 'global', label: 'Global', icon: Globe2 },
  { id: 'friends', label: 'Amigos', icon: Users },
];

export default function RankingsScreen() {
  const [tab, setTab] = useState<Tab>('weekly');
  const elo = useProfile((s) => s.elo);
  const level = useProfile((s) => s.level);
  const wins = useProfile((s) => s.wins);
  const currentStreak = useProfile((s) => s.currentStreak);

  const ranking = useMemo<RankingEntry[]>(() => {
    const simulated = getSimulatedRankings();
    const me: RankingEntry = {
      name: 'Tu',
      elo,
      level,
      wins,
      isMe: true,
    };

    if (tab === 'friends') {
      return [
        { ...simulated[1], isMe: false },
        { ...simulated[3], isMe: false },
        me,
        { ...simulated[5], isMe: false },
        { ...simulated[7], isMe: false },
      ].sort((a, b) => b.elo - a.elo);
    }

    const all: RankingEntry[] = [...simulated.map((s) => ({ ...s, isMe: false })), me];
    return all.sort((a, b) => b.elo - a.elo);
  }, [tab, elo, level, wins]);

  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3, 10);
  const myPosition = ranking.findIndex((r) => r.isMe) + 1;
  const podiumOrder = [podium[1], podium[0], podium[2]];

  return (
    <TiraScreen>
      <View>
        <Text style={SCREEN_TITLE}>RANKINGS</Text>
        <Text style={SCREEN_SUBTITLE}>
          A tua posição:{' '}
          <Text style={HEADER_STRONG_GOLD}>#{myPosition || '—'}</Text>
          {' · Elo '}
          <Text style={HEADER_STRONG}>{elo}</Text>
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[1] }}
      >
        {TABS.map((t) => (
          <TabChip
            key={t.id}
            active={tab === t.id}
            onPress={() => setTab(t.id)}
            icon={t.icon}
            label={t.label}
          />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] }}>
        {podiumOrder.map((entry) => {
          const realPos = ranking.findIndex((r) => r === entry) + 1;
          const isFirst = realPos === 1;
          const isSecond = realPos === 2;
          const accent = isFirst ? colors.gold : isSecond ? colors.textMuted : colors.orange;
          const height = isFirst ? 176 : isSecond ? 144 : 128;

          return (
            <View key={`${entry.name}-${realPos}`} style={{ flex: 1, height }}>
              <GameCard
                style={[
                  PODIUM_CARD,
                  {
                    borderColor: isFirst
                      ? alpha(colors.gold, 0.6)
                      : isSecond
                        ? alpha(colors.textMuted, 0.4)
                        : alpha(colors.orange, 0.4),
                    backgroundColor: isFirst
                      ? alpha(colors.gold, 0.08)
                      : alpha(colors.surface, 0.6),
                  },
                  entry.isMe ? { borderWidth: 2, borderColor: colors.p1 } : null,
                ]}
              >
                <View style={{ marginBottom: spacing[1] }}>
                  {isFirst ? (
                    <Crown size={20} color={colors.gold} fill={colors.gold} />
                  ) : isSecond ? (
                    <Medal size={16} color={colors.textMuted} />
                  ) : (
                    <Medal size={16} color={colors.orange} />
                  )}
                </View>
                <Text style={[PODIUM_POSITION, { color: accent }]}>{realPos}º</Text>
                <LevelAvatar
                  name={entry.name}
                  level={entry.level}
                  size={isFirst ? 'lg' : 'md'}
                  isTop={isFirst}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    PODIUM_NAME,
                    { color: entry.isMe ? colors.p1 : colors.text },
                  ]}
                >
                  {entry.name}
                </Text>
                <Text style={PODIUM_ELO}>{entry.elo} Elo</Text>
              </GameCard>
            </View>
          );
        })}
      </View>

      <View>
        <SectionTitle title="Classificação" />
        <View style={{ gap: 6 }}>
          {rest.map((entry) => {
            const pos = ranking.findIndex((r) => r === entry) + 1;
            return (
              <GameCard
                key={`${entry.name}-${pos}`}
                style={[
                  REST_CARD,
                  entry.isMe
                    ? {
                        borderColor: alpha(colors.p1, 0.6),
                        backgroundColor: alpha(colors.p1, 0.05),
                      }
                    : null,
                ]}
              >
                <Text style={REST_POSITION}>{pos}</Text>
                <LevelAvatar name={entry.name} level={entry.level} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      REST_NAME,
                      { color: entry.isMe ? colors.p1 : colors.text },
                    ]}
                  >
                    {entry.name}
                    {entry.isMe ? <Text style={REST_ME}> (tu)</Text> : null}
                  </Text>
                  <Text style={REST_META}>
                    Nível {entry.level} · {entry.wins} vitórias
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={REST_ELO}>{entry.elo}</Text>
                  <Text style={REST_ELO_LABEL}>Elo</Text>
                </View>
              </GameCard>
            );
          })}
        </View>
      </View>

      <GameCard glow="gold" style={{ padding: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radii.xl,
              backgroundColor: alpha(colors.gold, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Trophy size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={YOUR_POSITION_LABEL}>A tua posição atual</Text>
            <Text style={YOUR_POSITION_VALUE}>
              #{myPosition || '—'}{' '}
              <Text style={YOUR_POSITION_ELO}>· {elo} Elo</Text>
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
          <MiniStat label="Vitórias" value={wins} color={colors.p1} />
          <MiniStat label="Nível" value={level} color={colors.gold} />
          <MiniStat label="Série" value={currentStreak} color={colors.orange} />
        </View>
      </GameCard>

      <Text style={FOOTER}>
        Rankings simulados para o modo offline. O modo online com rankings reais chega em breve.
      </Text>
    </TiraScreen>
  );
}

function TabChip({
  active,
  onPress,
  icon: Icon,
  label,
}: {
  active: boolean;
  onPress: () => void;
  icon: IconType;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: spacing[4],
        paddingVertical: 10,
        borderRadius: radii.pill,
        minHeight: spacing[12],
        borderWidth: 1,
        borderColor: active ? colors.gold : colors.transparent,
        backgroundColor: active ? colors.gold : colors.surfaceAlt,
      }}
    >
      <Icon size={14} color={active ? colors.primaryForeground : colors.textMuted} />
      <Text
        style={{
          fontSize: 14,
          fontWeight: typography.fontWeight.medium,
          color: active ? colors.primaryForeground : colors.textMuted,
          fontFamily: typography.fontFamily.body,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing[2],
        borderRadius: radii.lg,
        backgroundColor: alpha(colors.surface, 0.6),
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: typography.fontFamily.display,
          fontSize: typography.fontSize.xl,
          letterSpacing: 0.45,
          color,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 9,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: colors.textMuted,
          fontFamily: typography.fontFamily.body,
        }}
      >
        {label}
      </Text>
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

const HEADER_STRONG: TextStyle = {
  color: colors.text,
  fontWeight: typography.fontWeight.semibold,
};

const HEADER_STRONG_GOLD: TextStyle = {
  color: colors.gold,
  fontWeight: typography.fontWeight.semibold,
};

const PODIUM_CARD: ViewStyle = {
  flex: 1,
  alignItems: 'center',
  padding: spacing[3],
  overflow: 'visible',
};

const PODIUM_POSITION: TextStyle = {
  fontFamily: typography.fontFamily.display,
  fontSize: typography.fontSize['2xl'],
  letterSpacing: 0.54,
  lineHeight: 27,
  marginBottom: spacing[1],
};

const PODIUM_NAME: TextStyle = {
  width: '100%',
  marginTop: 6,
  fontSize: 13.5,
  fontWeight: typography.fontWeight.semibold,
  textAlign: 'center',
  fontFamily: typography.fontFamily.body,
};

const PODIUM_ELO: TextStyle = {
  fontSize: 10,
  fontWeight: typography.fontWeight.medium,
  color: colors.gold,
  fontFamily: typography.fontFamily.body,
};

const REST_CARD: ViewStyle = {
  padding: 10,
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing[3],
};

const REST_POSITION: TextStyle = {
  width: 28,
  textAlign: 'center',
  fontFamily: typography.fontFamily.display,
  fontSize: typography.fontSize.lg,
  letterSpacing: 0.405,
  color: colors.textMuted,
};

const REST_NAME: TextStyle = {
  fontSize: 15.75,
  fontWeight: typography.fontWeight.semibold,
  fontFamily: typography.fontFamily.body,
};

const REST_ME: TextStyle = {
  fontSize: 10,
  color: colors.p1,
};

const REST_META: TextStyle = {
  fontSize: 10,
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
};

const REST_ELO: TextStyle = {
  fontFamily: typography.fontFamily.display,
  fontSize: typography.fontSize.base,
  letterSpacing: 0.36,
  lineHeight: 18,
  color: colors.gold,
};

const REST_ELO_LABEL: TextStyle = {
  fontSize: 9,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
};

const YOUR_POSITION_LABEL: TextStyle = {
  fontSize: 13.5,
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
};

const YOUR_POSITION_VALUE: TextStyle = {
  fontFamily: typography.fontFamily.display,
  fontSize: typography.fontSize.xl,
  letterSpacing: 0.45,
  color: colors.text,
};

const YOUR_POSITION_ELO: TextStyle = {
  fontFamily: typography.fontFamily.body,
  fontSize: typography.fontSize.sm,
  color: colors.textMuted,
};

const FOOTER: TextStyle = {
  fontSize: 10,
  lineHeight: 14,
  textAlign: 'center',
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
};
