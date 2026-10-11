/**
 * TiraHeading — títulos display (Bebas Neue) do kit.
 * níveis: display (30) / h1 (36) / h2 (24) / h3 (18) — escalas do design web.
 */
import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, typography, type ColorToken } from '@/theme';

export type TiraHeadingLevel = 'display' | 'h1' | 'h2' | 'h3';

const LEVEL_SIZE: Record<TiraHeadingLevel, number> = {
  display: typography.fontSize['3xl'],
  h1: typography.fontSize['4xl'],
  h2: typography.fontSize['2xl'],
  h3: typography.fontSize.lg,
};

export interface TiraHeadingProps {
  children: ReactNode;
  level?: TiraHeadingLevel;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

export function TiraHeading({
  children,
  level = 'h2',
  color = 'text',
  align,
  numberOfLines,
  style,
}: TiraHeadingProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: colors[color],
          fontSize: LEVEL_SIZE[level],
          fontWeight: typography.fontWeight.bold,
          fontFamily: typography.fontFamily.display,
          letterSpacing: typography.letterSpacing.display,
        },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
