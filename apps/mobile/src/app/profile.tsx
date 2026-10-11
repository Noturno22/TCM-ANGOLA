/**
 * Profile — port do ProfileScreen web: identidade (avatar/nível/Elo/XP),
 * estatísticas, sequências, progressão de dificuldades (useProgression),
 * histórico de partidas, conquistas e amigos (online em breve).
 * Reset de progresso com confirmação — tudo local, sem rede.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import type { Difficulty } from '@tira/ai';
import {
  EmptyState,
  Pill,
  ResultBadge,
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { useT, type UseTResult } from '@/lib/i18n/hook';
import { getUnlockRequirement, getUnlockText, useProgression } from '@/store/progression';
import { useProfile, xpProgress, type MatchRecord } from '@/store/profile';
import { colors, radii, spacing, type ColorToken } from '@/theme';

type Tab = 'history' | 'achievements' | 'friends';

const DIFF_META: { id: Difficulty; emoji: string; color: ColorToken }[] = [
  { id: 'easy', emoji: '😊', color: 'p1' },
  { id: 'medium', emoji: '🧠', color: 'gold' },
  { id: 'hard', emoji: '💎', color: 'orange' },
  { id: 'perfect', emoji: '👑', color: 'p2' },
];

export default function ProfileScreen() {
  const { t } = useT();
  const profile = useProfile();
  const [tab, setTab] = useState<Tab>('history');

  const xp = xpProgress(profile.xp, profile.level);
  const winRate =
    profile.totalMatches > 0 ? Math.round((profile.wins / profile.totalMatches) * 100) : 0;
  const unlockedAchievements = profile.achievements.filter((a) => a.unlockedAt);

  const confirmReset = () => {
    Alert.alert(t('profile.reset'), t('profile.reset_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.reset'),
        style: 'destructive',
        onPress: () => useProfile.getState().resetProfile(),
      },
    ]);
  };

  return (
    <TiraScreen title={t('nav.profile')} showBack>
      {/* Cabeçalho do perfil */}
      <TiraCard glow="gold">
        <View style={{ alignItems: 'center', gap: spacing[3] }}>
          <LevelAvatar emoji="🦁" level={profile.level} isTop={profile.elo > 1500} />
          <View style={{ alignItems: 'center', gap: 2 }}>
            <TiraHeading level="h2">{t('home.player_name')}</TiraHeading>
            <TiraText size="xs" variant="muted">
              {t('home.level_elo', { level: profile.level, elo: profile.elo })}
            </TiraText>
          </View>
          <View style={{ width: '100%', maxWidth: 280 }}>
            <XpBar level={profile.level} pct={xp.pct} current={xp.current} needed={xp.needed} />
          </View>
        </View>
      </TiraCard>

      {/* Estatísticas */}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <StatCard emoji="🏆" value={profile.wins} label={t('home.wins')} color="p1" />
        <StatCard emoji="📈" value={profile.losses} label={t('home.losses')} color="p2" />
        <StatCard emoji="🤝" value={profile.draws} label={t('home.draws')} color="textMuted" />
        <StatCard emoji="👑" value={`${winRate}%`} label={t('profile.win_rate')} color="gold" />
      </View>

      {/* Sequências + partidas */}
      <TiraCard>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <StreakCol
            label={t('profile.current_streak')}
            value={profile.currentStreak}
            color="p1"
          />
          <Divider />
          <StreakCol label={t('profile.best_streak')} value={profile.bestStreak} color="gold" />
          <Divider />
          <StreakCol label={t('profile.matches')} value={profile.totalMatches} color="text" />
        </View>
      </TiraCard>

      {/* Progressão de dificuldades */}
      <ProgressionPanel />

      {/* Tabs */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        <Pill active={tab === 'history'} onPress={() => setTab('history')}>
          {t('profile.history')}
        </Pill>
        <Pill active={tab === 'achievements'} onPress={() => setTab('achievements')}>
          {`${t('profile.achievements')} (${unlockedAchievements.length})`}
        </Pill>
        <Pill active={tab === 'friends'} onPress={() => setTab('friends')}>
          {t('profile.friends')}
        </Pill>
      </View>

      {/* Conteúdo da tab */}
      {tab === 'history' ? (
        <View style={{ gap: spacing[2] }}>
          {profile.matches.length === 0 ? (
            <EmptyState
              emoji="📋"
              title={t('profile.no_matches')}
              actionLabel={t('profile.play_now')}
              onAction={() => router.push('/offline')}
            />
          ) : (
            <>
              {profile.matches.slice(0, 20).map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
              {profile.matches.length > 20 ? (
                <TiraText size="xs" variant="muted" align="center">
                  {t('profile.recent_note', { n: profile.matches.length })}
                </TiraText>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {tab === 'achievements' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
          {profile.achievements.map((a) => (
            <View key={a.id} style={{ flexGrow: 1, flexBasis: '47%' }}>
              <TiraCard
                glow={a.unlockedAt ? 'gold' : undefined}
                style={{
                  padding: spacing[3],
                  height: '100%',
                  opacity: a.unlockedAt ? 1 : 0.5,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radii.lg,
                      backgroundColor: a.unlockedAt ? alpha(colors.gold, 0.15) : colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TiraText style={{ fontSize: 20 }}>{a.icon}</TiraText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <TiraText size="xs" weight="semibold">
                      {a.title}
                    </TiraText>
                    <TiraText size="xs" variant="muted">
                      {a.description}
                    </TiraText>
                    {a.unlockedAt ? (
                      <TiraText size="xs" variant="gold">
                        {formatDate(a.unlockedAt, t)}
                      </TiraText>
                    ) : null}
                  </View>
                </View>
              </TiraCard>
            </View>
          ))}
        </View>
      ) : null}

      {tab === 'friends' ? (
        <EmptyState
          emoji="👥"
          title={t('profile.friends.title')}
          desc={t('profile.friends.desc')}
          actionLabel={t('profile.friends.play_ai')}
          onAction={() => router.push('/offline')}
        />
      ) : null}

      {/* Reset (discreto) */}
      {profile.totalMatches > 0 ? (
        <TiraButton variant="ghost" size="sm" fullWidth onPress={confirmReset}>
          {t('profile.reset')}
        </TiraButton>
      ) : null}
    </TiraScreen>
  );
}

function MatchRow({ match }: { match: MatchRecord }) {
  const { t } = useT();
  return (
    <TiraCard style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] }}>
      <ResultBadge result={match.result} playerSide={match.playerSide} />
      <View style={{ flex: 1, gap: 2 }}>
        <TiraText size="sm" weight="semibold" numberOfLines={1}>
          {t('profile.vs', { opponent: match.opponent })}
        </TiraText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
          <TiraText size="xs" variant="muted">
            {`📅 ${formatDate(match.date, t)}`}
          </TiraText>
          <TiraText size="xs" variant="muted">
            {`⏱ ${match.durationSec}s`}
          </TiraText>
          <TiraText size="xs" variant="muted">
            {t('profile.moves_count', { n: match.moveCount })}
          </TiraText>
        </View>
      </View>
    </TiraCard>
  );
}

function StatCard({
  emoji,
  value,
  label,
  color,
}: {
  emoji: string;
  value: number | string;
  label: string;
  color: ColorToken;
}) {
  return (
    <TiraCard style={{ flex: 1, alignItems: 'center', gap: 2, padding: spacing[3] }}>
      <TiraText style={{ fontSize: 16 }}>{emoji}</TiraText>
      <TiraHeading level="h3" color={color} numberOfLines={1}>
        {value}
      </TiraHeading>
      <TiraText size="xs" variant="muted" align="center" numberOfLines={1}>
        {label}
      </TiraText>
    </TiraCard>
  );
}

function StreakCol({ label, value, color }: { label: string; value: number; color: ColorToken }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <TiraText size="xs" variant="muted" align="center" style={{ textTransform: 'uppercase' }}>
        {label}
      </TiraText>
      <TiraHeading level="h2" color={color}>
        {value}
      </TiraHeading>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, height: spacing[10], backgroundColor: colors.border }} />;
}

function ProgressionPanel() {
  const { t } = useT();
  const wins = useProgression((s) => s.winsByDifficulty);
  const unlocked = useProgression((s) => s.unlocked);

  return (
    <TiraCard>
      <TiraHeading level="h3" style={{ marginBottom: spacing[3] }}>
        {t('profile.ai_levels')}
      </TiraHeading>
      <View style={{ gap: spacing[3] }}>
        {DIFF_META.map((d) => {
          const isUnlocked = unlocked[d.id];
          const req = getUnlockRequirement(d.id);
          const currentWins = req ? wins[req.difficulty] : 0;
          const pct = req && req.wins > 0 ? Math.min(100, (currentWins / req.wins) * 100) : 100;

          return (
            <View
              key={d.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                opacity: isUnlocked ? 1 : 0.6,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TiraText size="lg">{isUnlocked ? d.emoji : '🔒'}</TiraText>
              </View>
              <View style={{ flex: 1, gap: spacing[1] }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: spacing[2],
                  }}
                >
                  <TiraText size="xs" weight="semibold" variant={isUnlocked ? undefined : 'muted'} style={isUnlocked ? { color: colors[d.color] } : undefined}>
                    {t(`diff.${d.id}`)}
                  </TiraText>
                  {isUnlocked ? (
                    <TiraText size="xs" variant="muted">
                      {t('profile.wins_count', { n: wins[d.id] })}
                    </TiraText>
                  ) : req ? (
                    <TiraText size="xs" variant="gold">
                      {t('profile.requirement', {
                        wins: currentWins,
                        req: req.wins,
                        diff: t(`diff.${req.difficulty}`),
                      })}
                    </TiraText>
                  ) : null}
                </View>
                {!isUnlocked && req ? (
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
                        backgroundColor: colors.p1,
                      }}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </TiraCard>
  );
}

function XpBar({
  level,
  pct,
  current,
  needed,
}: {
  level: number;
  pct: number;
  current: number;
  needed: number;
}) {
  const { t } = useT();
  return (
    <View style={{ gap: spacing[1], width: '100%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <TiraText size="xs" variant="muted">{`${t('home.level')} ${level}`}</TiraText>
        <TiraText size="xs" variant="muted">
          {`${current.toLocaleString('pt-PT')} / ${needed.toLocaleString('pt-PT')} XP`}
        </TiraText>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: colors.p1,
            borderRadius: radii.pill,
          }}
        />
      </View>
    </View>
  );
}

function LevelAvatar({ emoji, level, isTop }: { emoji: string; level: number; isTop: boolean }) {
  return (
    <View style={{ width: 72, height: 72 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 2,
          borderColor: alpha(colors[isTop ? 'gold' : 'p1'], 0.6),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TiraText style={{ fontSize: 34 }}>{emoji}</TiraText>
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: -4,
          right: -4,
          minWidth: 24,
          height: 24,
          borderRadius: radii.pill,
          backgroundColor: colors.gold,
          borderWidth: 1,
          borderColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing[1],
        }}
      >
        <TiraText size="xs" weight="bold" variant="inverse">
          {level}
        </TiraText>
      </View>
    </View>
  );
}

function formatDate(iso: string, t: UseTResult['t']): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return t('time.now');
  if (mins < 60) return t('time.minutes', { n: mins });
  if (hours < 24) return t('time.hours', { n: hours });
  if (days < 7) return t('time.days', { n: days });
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}
