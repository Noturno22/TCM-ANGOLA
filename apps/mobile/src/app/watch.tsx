/**
 * Watch — versão offline do WatchScreen web: o web corria duas IAs com
 * comentário ao vivo; aqui as partidas gravadas no perfil são a lista
 * local de assistência e o modo online/comentário mostra "em breve".
 * O replay completo (leitor de jogadas) chega numa próxima fase.
 */
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
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
import { useProfile, type MatchRecord } from '@/store/profile';
import { colors, radii, spacing } from '@/theme';

export default function WatchScreen() {
  const { t } = useT();
  const matches = useProfile((s) => s.matches);

  const openReplayAlert = (match: MatchRecord) => {
    Alert.alert(t('watch.alert.title'), `${t('profile.vs', { opponent: match.opponent })} — ${t('watch.alert.desc')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('watch.alert.profile'), onPress: () => router.push('/profile') },
    ]);
  };

  return (
    <TiraScreen title={t('watch.title')} showBack>
      {/* Cabeçalho/intro (port do intro web) */}
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
            <TiraText style={{ fontSize: 30 }}>👁️</TiraText>
          </View>
          <TiraHeading level="h2" color="gold" align="center">
            {t('watch.title')}
          </TiraHeading>
          <TiraText size="sm" variant="muted" align="center">
            {t('watch.desc')}
          </TiraText>
        </View>
      </TiraCard>

      {/* Comentário ao vivo / online — em breve */}
      <TiraCard>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[2],
          }}
        >
          <TiraHeading level="h3">{t('watch.live')}</TiraHeading>
          <Pill>{t('common.soon')}</Pill>
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: spacing[3],
            padding: spacing[3],
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: alpha(colors.orange, 0.3),
            backgroundColor: alpha(colors.orange, 0.1),
          }}
        >
          <TiraText size="sm" variant="orange">
            💬
          </TiraText>
          <TiraText size="xs" variant="orange" style={{ flex: 1 }}>
            {t('watch.live.soon')}
          </TiraText>
        </View>
      </TiraCard>

      {/* Partidas gravadas (offline) */}
      <View style={{ gap: spacing[2] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TiraHeading level="h3">{t('watch.local')}</TiraHeading>
          <TiraText size="xs" variant="muted">
            {t('watch.count', { n: matches.length })}
          </TiraText>
        </View>
        <TiraText size="xs" variant="muted">
          {t('watch.local.desc')}
        </TiraText>
        {matches.length === 0 ? (
          <EmptyState
            emoji="👁️"
            title={t('watch.empty')}
            desc={t('watch.empty.desc')}
            actionLabel={t('profile.play_now')}
            onAction={() => router.push('/offline')}
          />
        ) : (
          matches
            .slice(0, 20)
            .map((m) => <WatchRow key={m.id} match={m} onWatch={() => openReplayAlert(m)} />)
        )}
      </View>
    </TiraScreen>
  );
}

function WatchRow({ match, onWatch }: { match: MatchRecord; onWatch: () => void }) {
  const { t } = useT();
  return (
    <TiraCard
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        padding: spacing[3],
      }}
    >
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
      <TiraButton variant="outline" size="sm" onPress={onWatch}>
        {`▶️ ${t('watch.assist')}`}
      </TiraButton>
    </TiraCard>
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
