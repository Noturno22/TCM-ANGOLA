/**
 * EmptyState — estado vazio centrado (emoji + título + descrição + ação).
 * Composto só com primitivas do kit; usado por Perfil, Amigos e Assistir.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme';
import { TiraButton } from './TiraButton';
import { TiraCard } from './TiraCard';
import { TiraText } from './TiraText';

export interface EmptyStateProps {
  emoji: string;
  title: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function EmptyState({
  emoji,
  title,
  desc,
  actionLabel,
  onAction,
  children,
}: EmptyStateProps) {
  return (
    <TiraCard>
      <View
        style={{
          alignItems: 'center',
          gap: spacing[2],
          paddingVertical: spacing[5],
        }}
      >
        <TiraText style={{ fontSize: 40, opacity: 0.5 }}>{emoji}</TiraText>
        <TiraText size="sm" weight="semibold" variant="muted" align="center">
          {title}
        </TiraText>
        {desc ? (
          <TiraText size="xs" variant="muted" align="center">
            {desc}
          </TiraText>
        ) : null}
        {children}
        {actionLabel && onAction ? (
          <TiraButton variant="p1" size="sm" onPress={onAction} style={{ marginTop: spacing[2] }}>
            {actionLabel}
          </TiraButton>
        ) : null}
      </View>
    </TiraCard>
  );
}
