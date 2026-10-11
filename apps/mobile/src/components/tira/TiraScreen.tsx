/**
 * TiraScreen — shell de ecrã: safe-area, fundo do tema, header com
 * botão voltar/título/direita, conteúdo scrollável e slot de overlay.
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '@/theme';
import { useT } from '@/lib/i18n/hook';
import { TiraText } from './TiraText';

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
}: TiraScreenProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();

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
      {hasHeader ? (
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
            backgroundColor: colors.bg,
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

      {overlay}
    </View>
  );
}
