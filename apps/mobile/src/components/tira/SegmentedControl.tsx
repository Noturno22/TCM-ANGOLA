/**
 * SegmentedControl — seletor em segmentos (tempo por jogada, lados…).
 * Pill — chip de filtro individual (web FilterChip).
 */
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radii, spacing } from '@/theme';
import { TiraText } from './TiraText';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing[1],
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (opt.value === value) return;
              Haptics.selectionAsync().catch(() => undefined);
              onChange(opt.value);
            }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing[2],
              paddingHorizontal: spacing[3],
              borderRadius: radii.pill,
              backgroundColor: active ? colors.gold : colors.transparent,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <TiraText size="sm" weight="semibold" variant={active ? 'inverse' : 'muted'} numberOfLines={1}>
              {opt.label}
            </TiraText>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface PillProps {
  children: ReactNode;
  active?: boolean;
  onPress?: () => void;
}

export function Pill({ children, active = false, onPress }: PillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        if (!onPress) return;
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        borderRadius: radii.pill,
        backgroundColor: active ? colors.gold : colors.surfaceAlt,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <TiraText size="xs" weight={active ? 'semibold' : 'medium'} variant={active ? 'inverse' : 'muted'}>
        {children}
      </TiraText>
    </Pressable>
  );
}
