/**
 * Kit de UI do jogo — espelho 1:1 de `src/components/game/ui.tsx` (web),
 * adaptado a React Native. Mantém as mesmas variantes, dimensões, cores e
 * ícones (lucide) para paridade visual entre web e mobile.
 */
import { Bot, Coins, Crown, User } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { alpha } from '@/components/tira/alpha';
import { xpProgress } from '@/store/profile';
import { colors, radii, spacing, typography } from '@/theme';

export type GameVariant = 'primary' | 'p1' | 'p2' | 'gold' | 'orange' | 'outline' | 'ghost';

const VARIANT: Record<
  GameVariant,
  { background: string; foreground: string; border: string | null; borderWidth: number }
> = {
  primary: {
    background: colors.gold,
    foreground: colors.primaryForeground,
    border: null,
    borderWidth: 0,
  },
  gold: {
    background: colors.gold,
    foreground: colors.primaryForeground,
    border: null,
    borderWidth: 0,
  },
  p1: { background: colors.p1, foreground: colors.white, border: null, borderWidth: 0 },
  p2: { background: colors.p2, foreground: colors.white, border: null, borderWidth: 0 },
  orange: {
    background: colors.orange,
    foreground: colors.primaryForeground,
    border: null,
    borderWidth: 0,
  },
  outline: {
    background: colors.surface,
    foreground: colors.text,
    border: alpha(colors.gold, 0.6),
    borderWidth: 2,
  },
  ghost: {
    background: colors.surfaceAlt,
    foreground: colors.text,
    border: colors.border,
    borderWidth: 1,
  },
};

export interface GameButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: GameVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function GameButton({
  children,
  onPress,
  variant = 'outline',
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
}: GameButtonProps) {
  const v = VARIANT[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: spacing[12],
          paddingHorizontal: spacing[6],
          borderRadius: radii.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          backgroundColor: v.background,
          borderWidth: v.borderWidth,
          borderColor: v.border ?? colors.transparent,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={[
            {
              color: v.foreground,
              fontSize: typography.fontSize.sm, // web: text-base-sm = 0.875rem @ 18px
              lineHeight: typography.fontSize.sm * 1.5,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily.body,
            },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export interface GameCardProps {
  children: ReactNode;
  glow?: 'p1' | 'p2' | 'gold' | null;
  style?: StyleProp<ViewStyle>;
}

export function GameCard({ children, glow, style }: GameCardProps) {
  return (
    <View
      style={[
        {
          position: 'relative',
          backgroundColor: colors.card,
          borderRadius: radii.cardLg,
          borderWidth: 1,
          borderColor: glow ? alpha(colors[glow], 0.35) : colors.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function BalancePill({ coins, onClick }: { coins: number; onClick?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Saldo: ${coins} Kwanza. Abrir carteira.`}
      onPress={onClick}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        borderRadius: radii.pill,
        backgroundColor: pressed ? colors.surface : colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        paddingLeft: spacing[3],
        paddingRight: 6,
        paddingVertical: spacing[2],
        minHeight: spacing[12],
      })}
    >
      <Coins width={16} height={16} color={colors.gold} />
      <Text
        style={{
          fontSize: typography.fontSize.sm, // web: text-sm
          fontWeight: typography.fontWeight.semibold,
          color: colors.text,
          fontVariant: ['tabular-nums'],
          fontFamily: typography.fontFamily.body,
        }}
      >
        {coins.toLocaleString('pt-PT')}
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontWeight: typography.fontWeight.medium,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.body,
        }}
      >
        KZ
      </Text>
      <View
        style={{
          marginLeft: 2,
          width: 24,
          height: 24,
          borderRadius: radii.pill,
          backgroundColor: colors.gold,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: typography.fontSize.base, // web: text-base
            fontWeight: typography.fontWeight.bold,
            color: colors.primaryForeground,
            lineHeight: typography.fontSize.base,
            fontFamily: typography.fontFamily.body,
          }}
        >
          +
        </Text>
      </View>
    </Pressable>
  );
}

// web: text-sm (15.75) / text-lg (20.25) / text-2xl (27) @ base 18px
const AVATAR_DIMS = { sm: 36, md: 48, lg: 64 } as const;
const AVATAR_ICON = { sm: 16, md: 20, lg: 28 } as const;
const AVATAR_TEXT = { sm: 15.75, md: 20.25, lg: 27 } as const;
const AVATAR_BADGE = { sm: 16, md: 20, lg: 24 } as const;
const AVATAR_BADGE_TEXT = { sm: 11, md: 12, lg: 15.75 } as const;

export function LevelAvatar({
  name,
  kind = 'human',
  level,
  size = 'md',
  isTop = false,
  online,
}: {
  name?: string;
  kind?: 'human' | 'ai';
  level: number;
  size?: 'sm' | 'md' | 'lg';
  isTop?: boolean;
  online?: boolean;
}) {
  const dim = AVATAR_DIMS[size];
  const initial = name?.trim().charAt(0).toUpperCase();
  return (
    <View style={{ position: 'relative' }}>
      <View
        style={{
          width: dim,
          height: dim,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: alpha(colors.gold, 0.4),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isTop ? (
          <View style={{ position: 'absolute', top: -8, left: '50%', marginLeft: -8 }}>
            <Crown width={16} height={16} color={colors.gold} fill={colors.gold} />
          </View>
        ) : null}
        {kind === 'ai' ? (
          <Bot width={AVATAR_ICON[size]} height={AVATAR_ICON[size]} color={colors.gold} />
        ) : initial ? (
          <Text
            style={{
              fontFamily: typography.fontFamily.display,
              fontSize: AVATAR_TEXT[size],
              lineHeight: AVATAR_TEXT[size],
              color: colors.gold,
            }}
          >
            {initial}
          </Text>
        ) : (
          <User width={AVATAR_ICON[size]} height={AVATAR_ICON[size]} color={colors.gold} />
        )}
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: -4,
          right: -4,
          minWidth: AVATAR_BADGE[size],
          height: AVATAR_BADGE[size],
          borderRadius: radii.pill,
          backgroundColor: colors.gold,
          borderWidth: 2,
          borderColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 2,
        }}
      >
        <Text
          style={{
            fontSize: AVATAR_BADGE_TEXT[size],
            fontWeight: typography.fontWeight.bold,
            color: colors.primaryForeground,
            fontFamily: typography.fontFamily.body,
          }}
        >
          {level}
        </Text>
      </View>
      {online !== undefined ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: radii.pill,
            borderWidth: 2,
            borderColor: colors.card,
            backgroundColor: online ? colors.p1 : colors.textMuted,
          }}
        />
      ) : null}
    </View>
  );
}

export function XpBar({ xp, level }: { xp: number; level: number }) {
  const { current, needed, pct } = xpProgress(xp, level);
  return (
    <View style={{ width: '100%' }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <Text style={XP_LABEL}>Nível {level}</Text>
        <Text style={[XP_LABEL, { fontVariant: ['tabular-nums'] }]}>
          {current.toLocaleString('pt-PT')} / {needed.toLocaleString('pt-PT')} XP
        </Text>
      </View>
      <View
        style={{
          height: spacing[2],
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: colors.gold,
            borderRadius: radii.pill,
          }}
        />
      </View>
    </View>
  );
}

const XP_LABEL: TextStyle = {
  fontSize: 12,
  fontWeight: typography.fontWeight.medium,
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
};

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onClick}
      style={{
        paddingHorizontal: spacing[4],
        paddingVertical: 10,
        borderRadius: radii.pill,
        minHeight: spacing[12],
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: active ? colors.gold : colors.transparent,
        backgroundColor: active ? colors.gold : colors.surfaceAlt,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: typography.fontWeight.medium,
          color: active ? colors.primaryForeground : colors.textMuted,
          fontFamily: typography.fontFamily.body,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function ResultBadge({
  result,
  playerSide: _playerSide,
}: {
  result: 'P1' | 'P2' | 'DRAW';
  playerSide?: 'P1' | 'P2';
}) {
  const cfg = {
    P1: { label: 'Vitória', bg: alpha(colors.p1, 0.15), fg: colors.p1, border: alpha(colors.p1, 0.3) },
    P2: { label: 'Derrota', bg: alpha(colors.p2, 0.15), fg: colors.p2, border: alpha(colors.p2, 0.3) },
    DRAW: {
      label: 'Empate',
      bg: colors.surfaceAlt,
      fg: colors.textMuted,
      border: colors.border,
    },
  }[result];
  return (
    <View
      style={{
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: cfg.border,
        backgroundColor: cfg.bg,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: typography.fontWeight.semibold,
          color: cfg.fg,
          fontFamily: typography.fontFamily.body,
        }}
      >
        {cfg.label}
      </Text>
    </View>
  );
}

export function GameLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = { sm: 36, md: 48, lg: 80 }[size];
  const rows = [0, 1, 2];
  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: radii.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: alpha(colors.gold, 0.5),
        backgroundColor: colors.border,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        {rows.map((row) => (
          <View key={row} style={{ flex: 1, flexDirection: 'row', gap: 1 }}>
            {rows.map((col) => {
              const center = row === 1 && col === 1;
              const bg = row === 0 ? colors.p1 : row === 2 ? colors.p2 : colors.surfaceAlt;
              return (
                <View
                  key={col}
                  style={{
                    flex: 1,
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {center ? (
                    <View
                      style={{
                        width: '50%',
                        height: '50%',
                        borderRadius: radii.pill,
                        borderWidth: 2,
                        borderColor: colors.gold,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: '33%',
                          height: '33%',
                          borderRadius: radii.pill,
                          backgroundColor: colors.gold,
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[3],
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: typography.fontWeight.semibold,
          letterSpacing: typography.letterSpacing.tight,
          color: colors.text,
          fontFamily: typography.fontFamily.body,
        }}
      >
        {title}
      </Text>
      {action}
    </View>
  );
}
