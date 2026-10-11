/**
 * TiraButton — botão do kit (web GameButton + háptica no sítio do som 'click').
 * children string é envolvido em Text com a cor/tipo do variant;
 * children node é renderizado tal e qual (o ecrã estiliza o interior).
 */
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';

export type TiraButtonVariant = 'primary' | 'gold' | 'outline' | 'ghost' | 'p1' | 'p2';
export type TiraButtonSize = 'sm' | 'md' | 'lg';

interface VariantStyle {
  background: string | null;
  foreground: string;
  border: string | null;
}

const VARIANTS: Record<TiraButtonVariant, VariantStyle> = {
  primary: { background: colors.primary, foreground: colors.primaryForeground, border: null },
  gold: { background: colors.gold, foreground: colors.textInverse, border: null },
  p1: { background: colors.p1, foreground: colors.white, border: null },
  p2: { background: colors.p2, foreground: colors.white, border: null },
  outline: { background: colors.surface, foreground: colors.text, border: colors.border },
  ghost: { background: null, foreground: colors.text, border: null },
};

const SIZES = {
  sm: {
    height: spacing[10],
    paddingHorizontal: spacing[3],
    fontSize: typography.fontSize.sm,
  },
  md: {
    height: spacing[10] + spacing[1], // 44 (h-11 web)
    paddingHorizontal: spacing[5],
    fontSize: typography.fontSize.sm,
  },
  lg: {
    height: spacing[12], // 48 (h-12 web)
    paddingHorizontal: spacing[6],
    fontSize: typography.fontSize.lg,
  },
} as const;

export interface TiraButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: TiraButtonVariant;
  size?: TiraButtonSize;
  disabled?: boolean;
  /** Háptica leve ao toque (default true; web tocava playSound('click')) */
  haptic?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function TiraButton({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  haptic = true,
  fullWidth = false,
  style,
  testID,
  accessibilityLabel,
}: TiraButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      testID={testID}
      onPress={() => {
        if (disabled) return;
        if (haptic) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          height: s.height,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: radii.lg,
          backgroundColor: v.background ?? colors.transparent,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ?? colors.transparent,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={{
            color: v.foreground,
            fontSize: s.fontSize,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily.body,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
