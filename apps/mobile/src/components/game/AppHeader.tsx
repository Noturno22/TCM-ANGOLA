/**
 * Cabeçalho global — espelho de `src/components/game/AppHeader.tsx` (web):
 * voltar, título, saldo, notificações e definições.
 */
import { router, usePathname } from 'expo-router';
import { Bell, ChevronLeft, Settings as SettingsIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useT } from '@/lib/i18n/hook';
import type { I18nKey } from '@/lib/i18n';
import { useNotifications } from '@/store/notifications';
import { useProfile } from '@/store/profile';
import { colors, radii, spacing, typography } from '@/theme';
import { alpha } from '@/components/tira/alpha';
import { BalancePill } from './ui';

const SCREEN_TITLES: Record<string, I18nKey> = {
  '/offline': 'mode.title',
  '/tutorial': 'nav.tutorial',
  '/how-to-play': 'settings.how_to_play',
  '/about': 'settings.about',
  '/settings': 'settings.account',
  '/wallet': 'nav.wallet',
  '/replay': 'nav.replay',
  '/achievements': 'profile.achievements',
  '/challenge': 'nav.challenge',
  '/stats': 'profile.stats',
  '/share': 'nav.share',
  '/lightning': 'nav.lightning',
  '/watch': 'nav.watch',
  '/campaign': 'nav.campaign',
  '/campaign-play': 'nav.campaign',
  '/notifications': 'nav.notifications',
};

export function AppHeader() {
  const pathname = usePathname();
  const { t } = useT();
  const coins = useProfile((s) => s.coins);
  const unread = useNotifications((s) => s.unread);

  const titleKey = SCREEN_TITLES[pathname];
  const title = titleKey ? t(titleKey) : '';

  // O web não mostra AppHeader no Home.
  if (pathname === '/') return null;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View
      style={{
        backgroundColor: alpha(colors.bg, 0.95), // web: bg-background/95 + blur
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          paddingHorizontal: spacing[4],
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[3],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nav.back')}
            onPress={goBack}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surface : colors.transparent,
            })}
          >
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 20.25,
              fontWeight: typography.fontWeight.semibold,
              color: colors.text,
              fontFamily: typography.fontFamily.body,
              flexShrink: 1,
            }}
          >
            {title}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <BalancePill coins={coins} onClick={() => router.push('/wallet')} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notificações"
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surface : colors.transparent,
            })}
          >
            <Bell size={16} color={colors.text} />
            {unread > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  paddingHorizontal: 4,
                  borderRadius: radii.pill,
                  backgroundColor: colors.p2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontSize: 10,
                    fontWeight: typography.fontWeight.bold,
                    lineHeight: 12,
                    fontFamily: typography.fontFamily.body,
                  }}
                >
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.account')}
            onPress={() => router.push('/settings')}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surface : colors.transparent,
            })}
          >
            <SettingsIcon size={16} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
