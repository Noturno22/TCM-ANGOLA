/**
 * TiraScreen — shell de ecrã: safe-area, fundo do tema, header com
 * botão voltar/título/direita, conteúdo scrollável e slot de overlay.
 */
import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Line, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/game/AppHeader';
import { TabBar } from '@/components/game/TabBar';
import { colors, radii, spacing } from '@/theme';
import { useT } from '@/lib/i18n/hook';
import { alpha } from './alpha';
import { TiraText } from './TiraText';

/** Rotas full-screen do web (sem AppHeader/TabBar). */
const FULLSCREEN_ROUTES = new Set(['/auth', '/game']);

/**
 * Padrão angolano subtil do web (globals.css `.angolan-pattern`): losangos
 * em cruz gold, `background-size: 30px` e `opacity: 0.018`. Desenhado em
 * SVG (linhas ±45°) para funcionar igual no nativo e no web.
 */
function AngolanPattern({ opacity = 0.018 }: { opacity?: number }) {
  const { width, height } = useWindowDimensions();
  const lines: ReactNode[] = [];
  const step = 30;
  const span = width + height;
  for (let c = -span; c <= span; c += step) {
    lines.push(
      <Line
        key={`a${c}`}
        x1={0}
        y1={c}
        x2={width}
        y2={c + width}
        stroke={colors.gold}
        strokeWidth={3}
      />,
      <Line
        key={`b${c}`}
        x1={0}
        y1={c}
        x2={width}
        y2={c - width}
        stroke={colors.gold}
        strokeWidth={3}
      />,
    );
  }
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}
    >
      <Svg width={width} height={height}>{lines}</Svg>
    </View>
  );
}

export interface TiraScreenProps {
  children: ReactNode;
  /** string (estilo padrão) ou nó composto */
  title?: ReactNode;
  subtitle?: ReactNode;
  showBack?: boolean;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  /** default true */
  scroll?: boolean;
  /** camada absolute fill por cima de header+conteúdo (ex.: fim de jogo) */
  overlay?: ReactNode;
  /** style do content container */
  style?: StyleProp<ViewStyle>;
  /** imagem de fundo full-screen (atrás do padrão e do conteúdo) */
  backgroundImage?: ImageSourcePropType;
  /** Usar o chrome global (AppHeader/TabBar) do web. Default true. */
  chrome?: boolean;
}

function goBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

export function TiraScreen({
  children,
  title,
  subtitle,
  showBack = false,
  headerLeft,
  headerRight,
  scroll = true,
  overlay,
  style,
  backgroundImage,
  chrome = true,
}: TiraScreenProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const useChrome = chrome && !FULLSCREEN_ROUTES.has(pathname);
  const hasHeader = Boolean(title || subtitle || showBack || headerLeft || headerRight);

  const contentStyle: StyleProp<ViewStyle> = [
    {
      paddingHorizontal: spacing[4],
      paddingTop: spacing[4],
      paddingBottom: insets.bottom + spacing[8],
      gap: spacing[5],
    },
    style,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {backgroundImage ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Image
            source={backgroundImage}
            resizeMode="cover"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ) : null}
      {/* Padrão de fundo (web: <div class="fixed angolan-pattern"> na página) */}
      <AngolanPattern />
      {useChrome ? <AppHeader /> : null}

      {!useChrome && hasHeader ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[3],
            minHeight: spacing[12],
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: alpha(colors.bg, 0.6), // web game header: bg-background/60
          }}
        >
          {headerLeft ??
            (showBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('nav.back')}
                onPress={goBack}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <TiraText size="xl" weight="medium" style={{ marginTop: -2 }}>
                  ‹
                </TiraText>
              </Pressable>
            ) : null)}
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            {typeof title === 'string' ? (
              <TiraText size="lg" weight="semibold" numberOfLines={1}>
                {title}
              </TiraText>
            ) : (
              title
            )}
            {typeof subtitle === 'string' ? (
              <TiraText size="xs" variant="muted" numberOfLines={1}>
                {subtitle}
              </TiraText>
            ) : (
              subtitle
            )}
          </View>
          {headerRight ?? <View style={{ minWidth: 36 }} />}
        </View>
      ) : null}

      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}

      {useChrome ? <TabBar /> : null}
      {overlay}
    </View>
  );
}
