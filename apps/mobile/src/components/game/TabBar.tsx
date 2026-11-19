/**
 * Barra de navegação inferior — espelho de `TabBar.tsx` (web).
 * Visível no Home, Salas, Rankings e Perfil.
 */
import { router, usePathname } from 'expo-router';
import { Award, Home, Trophy, User, Users } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha } from '@/components/tira/alpha';
import { useT } from '@/lib/i18n/hook';
import { colors, radii, typography } from '@/theme';

const TABS = [
  { route: '/', labelKey: 'nav.home', icon: Home },
  { route: '/rooms', labelKey: 'nav.rooms', icon: Users },
  { route: '/rankings', labelKey: 'nav.rankings', icon: Trophy },
  { route: '/achievements', labelKey: 'nav.prizes', icon: Award },
  { route: '/profile', labelKey: 'nav.profile', icon: User },
] as const;

const TAB_ROUTES = new Set(['/', '/rooms', '/rankings', '/achievements', '/profile']);

export function TabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  if (!TAB_ROUTES.has(pathname)) return null;

  return (
    <View
      accessibilityLabel="Navegação principal"
      style={{
        backgroundColor: alpha(colors.bg, 0.95), // web: bg-background/95
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 4,
        paddingTop: 4,
        paddingBottom: Math.max(insets.bottom, 4.5), // pb max(0.25rem@18px, safe-area)
        flexDirection: 'row',
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.route;
        const color = isActive ? colors.p1 : colors.textMuted;
        return (
          <Pressable
            key={tab.route}
            accessibilityRole="button"
            accessibilityLabel={t(tab.labelKey)}
            accessibilityState={{ selected: isActive }}
            onPress={() => router.push(tab.route)}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              paddingVertical: 8,
              minHeight: 48,
              borderRadius: radii.lg, // web: rounded-lg = 13.5px @ base 18
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Icon size={20} color={color} />
            <Text
              style={{
                fontSize: 10,
                color,
                fontWeight: isActive
                  ? typography.fontWeight.semibold
                  : typography.fontWeight.medium,
                fontFamily: typography.fontFamily.body,
              }}
            >
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
