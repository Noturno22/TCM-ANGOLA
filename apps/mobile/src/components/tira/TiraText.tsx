/**
 * TiraText — texto base do kit (corpo Inter, tokens de tema).
 */
import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, typography } from '@/theme';

export type TiraTextVariant =
  | 'default'
  | 'muted'
  | 'gold'
  | 'p1'
  | 'p2'
  | 'orange'
  | 'inverse'
  | 'onColor';

export type TiraTextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** `md` do kit → `base` (16) dos tokens de tipografia. */
const SIZE_TOKEN: Record<TiraTextSize, 'xs' | 'sm' | 'base' | 'lg' | 'xl'> = {
  xs: 'xs',
  sm: 'sm',
  md: 'base',
  lg: 'lg',
  xl: 'xl',
};
export type TiraTextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const VARIANT_COLORS: Record<TiraTextVariant, string> = {
  default: colors.text,
  muted: colors.textMuted,
  gold: colors.gold,
  p1: colors.p1,
  p2: colors.p2,
  orange: colors.orange,
  inverse: colors.textInverse,
  onColor: colors.onColor,
};

export interface TiraTextProps {
  children: ReactNode;
  variant?: TiraTextVariant;
  size?: TiraTextSize;
  weight?: TiraTextWeight;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

export function TiraText({
  children,
  variant = 'default',
  size = 'sm',
  weight = 'regular',
  align,
  numberOfLines,
  style,
}: TiraTextProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: VARIANT_COLORS[variant],
          fontSize: typography.fontSize[SIZE_TOKEN[size]],
          fontWeight: typography.fontWeight[weight],
          fontFamily: typography.fontFamily.body,
        },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
