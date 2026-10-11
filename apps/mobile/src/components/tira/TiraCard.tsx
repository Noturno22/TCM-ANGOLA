/**
 * TiraCard — cartão de superfície (bg-card, border, glow opcional p1/p2/gold).
 * Réplica do GameCard da web.
 */
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, type ColorToken } from '@/theme';
import { alpha } from './alpha';

export type TiraCardGlow = 'p1' | 'p2' | 'gold';

const GLOW_COLOR: Record<TiraCardGlow, ColorToken> = {
  p1: 'p1',
  p2: 'p2',
  gold: 'gold',
};

export interface TiraCardProps {
  children: ReactNode;
  glow?: TiraCardGlow;
  /** Padding interno (default true, spacing[4]) */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function TiraCard({ children, glow, padded = true, style }: TiraCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: glow ? alpha(colors[GLOW_COLOR[glow]], 0.3) : colors.border,
          padding: padded ? spacing[4] : 0,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
