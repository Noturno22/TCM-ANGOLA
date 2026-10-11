/**
 * Home — port reduzido do HomeScreen web: logo/título, saldo, cartão do
 * jogador (XP/nível/Elo), hint da próxima dificuldade, ações principais
 * (offline/2 jogadores/desafio/salas) e estatísticas rápidas.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { Difficulty } from '@tira/ai';
import { Pressable, View } from 'react-native';
import { getTodayPuzzle } from '@/content';
import { TiraCard, TiraHeading, TiraScreen, TiraText, alpha } from '@/components/tira';
import { useT } from '@/lib/i18n/hook';
import { getUnlockText, useProgression } from '@/store/progression';
import { useProfile, xpProgress } from '@/store/profile';
import { colors, radii, spacing, type ColorToken } from '@/theme';

export default function HomeScreen() {
  const { t } = useT();
  const profile = useProfile();
  const unlocked = useProgression((s) => s.unlocked);
  const puzzle = getTodayPuzzle();
  const reward = puzzle.mateIn === 2 ? 400 : 200;

  const nextDiff: Difficulty | null = !unlocked.medium
    ? 'medium'
    : !unlocked.hard
      ? 'hard'
      : !unlocked.perfect
        ? 'perfect'
        : null;

  return (
    <TiraScreen headerRight={<BalancePill coins={profile.coins} />}>
      {/* Logo + título */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <TiraLogo />
        <View style={{ flex: 1, gap: 2 }}>
          <TiraHeading level="h3" numberOfLines={1}>
            {t('app.title')}
          </TiraHeading>
          <TiraText size="xs" variant="muted">
            {t('app.tagline')}
          </TiraText>
        </View>
      </View>

      {/* Cartão do utilizador → Perfil */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('nav.profile')}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          router.push('/profile');
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <TiraCard glow="gold">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <LevelAvatar emoji="🦁" level={profile.level} />
            <View style={{ flex: 1, gap: 2 }}>
              <TiraText size="sm" weight="semibold">
                {t('home.player_name')}
              </TiraText>
              <TiraText size="xs" variant="muted">
                {t('home.level_elo', { level: profile.level, elo: profile.elo })}
              </TiraText>
              <XpBar xp={profile.xp} level={profile.level} />
            </View>
            <TiraText size="lg" variant="muted">
              ›
            </TiraText>
          </View>
        </TiraCard>
      </Pressable>

      {/* Hint da próxima dificuldade (progressão) */}
      <TiraCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <TiraText size="lg">{nextDiff ? '🔒' : '✅'}</TiraText>
          <TiraText size="sm" variant={nextDiff ? 'muted' : 'p1'} style={{ flex: 1 }}>
            {nextDiff ? getUnlockText(nextDiff) : t('home.all_unlocked')}
          </TiraText>
        </View>
      </TiraCard>

      {/* Ações principais */}
      <View style={{ gap: spacing[2] }}>
        <ActionRow
          emoji="🤖"
          title={t('home.offline')}
          desc={t('home.offline.desc')}
          tint="orange"
          onPress={() => router.push('/offline')}
        />
        <ActionRow
          emoji="👥"
          title={t('mode.pvp')}
          desc={t('mode.pvp.desc')}
          tint="p1"
          onPress={() => router.push('/offline')}
        />
        <ActionRow
          emoji="🎯"
          title={t('home.daily_challenge')}
          desc={t('home.daily_challenge.meta', { difficulty: puzzle.difficulty, reward })}
          tint="gold"
          onPress={() => router.push('/challenge')}
        />
        <ActionRow
          emoji="🏰"
          title={t('home.campaign')}
          desc={t('home.campaign.desc')}
          tint="gold"
          onPress={() => router.push('/campaign')}
        />
        <ActionRow
          emoji="⚡"
          title={t('home.lightning')}
          desc={t('home.lightning.desc')}
          tint="orange"
          onPress={() => router.push('/lightning')}
        />
        <ActionRow
          emoji="🎬"
          title={t('home.replay')}
          desc={t('home.replay.desc')}
          tint="neutral"
          onPress={() => router.push('/replay')}
        />
        <ActionRow
          emoji="📤"
          title={t('home.share')}
          desc={t('home.share.desc')}
          tint="neutral"
          onPress={() => router.push('/share')}
        />
        <ActionRow
          emoji="🌍"
          title={t('nav.rooms')}
          desc={t('rooms.subtitle')}
          tint="neutral"
          onPress={() => router.push('/rooms')}
        />
        <ActionRow
          emoji="👁️"
          title={t('home.watch')}
          desc={t('home.watch.desc')}
          tint="gold"
          onPress={() => router.push('/watch')}
        />
        <ActionRow
          emoji="📚"
          title={t('home.tutorial')}
          desc={t('home.tutorial.desc')}
          tint="p1"
          onPress={() => router.push('/tutorial')}
        />
        <ActionRow
          emoji="📖"
          title={t('settings.how_to_play')}
          desc={t('home.how_to_play.desc')}
          tint="orange"
          onPress={() => router.push('/how-to-play')}
        />
      </View>

      {/* Estatísticas rápidas */}
      <TiraCard>
        <TiraHeading level="h3" style={{ marginBottom: spacing[3] }}>
          {t('home.stats')}
        </TiraHeading>
        <View style={{ flexDirection: 'row' }}>
          <StatCol label={t('home.wins')} value={profile.wins} color="p1" />
          <StatCol label={t('home.losses')} value={profile.losses} color="p2" />
          <StatCol label={t('home.draws')} value={profile.draws} color="textMuted" />
        </View>
      </TiraCard>
    </TiraScreen>
  );
}

type ActionTint = 'orange' | 'p1' | 'gold' | 'neutral';

const TINTS: Record<ActionTint, { border: string; icon: string }> = {
  orange: { border: alpha(colors.orange, 0.4), icon: alpha(colors.orange, 0.2) },
  p1: { border: alpha(colors.p1, 0.5), icon: alpha(colors.p1, 0.2) },
  gold: { border: alpha(colors.gold, 0.4), icon: alpha(colors.gold, 0.2) },
  neutral: { border: colors.border, icon: colors.surfaceAlt },
};

function ActionRow({
  emoji,
  title,
  desc,
  tint,
  onPress,
}: {
  emoji: string;
  title: string;
  desc: string;
  tint: ActionTint;
  onPress: () => void;
}) {
  const c = TINTS[tint];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[4],
        padding: spacing[4],
        borderRadius: radii.cardLg,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.xl,
          backgroundColor: c.icon,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TiraText style={{ fontSize: 22 }}>{emoji}</TiraText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <TiraHeading level="h3" numberOfLines={1}>
          {title}
        </TiraHeading>
        <TiraText size="xs" variant="muted" numberOfLines={2}>
          {desc}
        </TiraText>
      </View>
      <TiraText size="lg" variant="muted">
        ›
      </TiraText>
    </Pressable>
  );
}

function StatCol({ label, value, color }: { label: string; value: number; color: ColorToken }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <TiraHeading level="h2" color={color}>
        {value}
      </TiraHeading>
      <TiraText size="xs" variant="muted" align="center">
        {label}
      </TiraText>
    </View>
  );
}

function BalancePill({ coins }: { coins: number }) {
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('wallet.title')}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        router.push('/wallet');
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.lg,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <TiraText size="sm">🪙</TiraText>
      <TiraText size="sm" weight="semibold">
        {coins.toLocaleString('pt-PT')}
      </TiraText>
      <TiraText size="xs" variant="muted">
        KZ
      </TiraText>
    </Pressable>
  );
}

function XpBar({ xp, level }: { xp: number; level: number }) {
  const { t } = useT();
  const progress = xpProgress(xp, level);
  return (
    <View style={{ gap: spacing[1], marginTop: spacing[2] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <TiraText size="xs" variant="muted">{`${t('home.level')} ${level}`}</TiraText>
        <TiraText size="xs" variant="muted">
          {`${progress.current.toLocaleString('pt-PT')} / ${progress.needed.toLocaleString('pt-PT')} XP`}
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
            width: `${progress.pct}%`,
            height: '100%',
            backgroundColor: colors.p1,
            borderRadius: radii.pill,
          }}
        />
      </View>
    </View>
  );
}

function LevelAvatar({ emoji, level }: { emoji: string; level: number }) {
  return (
    <View style={{ width: 48, height: 48 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 2,
          borderColor: alpha(colors.gold, 0.6),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TiraText style={{ fontSize: 22 }}>{emoji}</TiraText>
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: -4,
          right: -4,
          minWidth: 20,
          height: 20,
          borderRadius: radii.pill,
          backgroundColor: colors.gold,
          borderWidth: 1,
          borderColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        }}
      >
        <TiraText size="xs" weight="bold" variant="inverse">
          {level}
        </TiraText>
      </View>
    </View>
  );
}

/** Mini-logo 3×3 (grelha p1/surf/p2 com alvo dourado ao centro). */
function TiraLogo({ size = 40 }: { size?: number }) {
  const cell = (size - 2) / 3; // gap de 1 entre células
  const cells: ('p1' | 'surfaceAlt' | 'p2')[] = [
    'p1',
    'p1',
    'p1',
    'surfaceAlt',
    'surfaceAlt',
    'surfaceAlt',
    'p2',
    'p2',
    'p2',
  ];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.lg,
        borderWidth: 2,
        borderColor: colors.gold,
        overflow: 'hidden',
        backgroundColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
        {cells.map((c, i) => (
          <View
            key={i}
            style={{
              width: cell,
              height: cell,
              backgroundColor: colors[c],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i === 4 ? (
              <View
                style={{
                  width: cell * 0.55,
                  height: cell * 0.55,
                  borderRadius: radii.pill,
                  borderWidth: 1.5,
                  borderColor: colors.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: cell * 0.18,
                    height: cell * 0.18,
                    borderRadius: radii.pill,
                    backgroundColor: colors.gold,
                  }}
                />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
