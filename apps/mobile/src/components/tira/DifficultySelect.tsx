/**
 * DifficultySelect — grelha 2×2 de dificuldades com desbloqueios da progressão
 * (web OfflineSelectScreen). `respectLocks=false` ignora locks (Treino Livre).
 */
import type { Difficulty } from '@tira/ai';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { getUnlockRequirement, getUnlockText, useProgression } from '@/store/progression';
import { colors, radii, spacing, type ColorToken } from '@/theme';
import { useT } from '@/lib/i18n/hook';
import { alpha } from './alpha';
import { TiraText, type TiraTextVariant } from './TiraText';

export interface DifficultySelectProps {
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
  /** Aplicar desbloqueios por vitórias (default true) */
  respectLocks?: boolean;
}

interface DifficultyMeta {
  id: Difficulty;
  emoji: string;
  color: TiraTextVariant;
  /** cor token para escalares (badge, etc.) */
  token: ColorToken;
}

const DIFFICULTIES: DifficultyMeta[] = [
  { id: 'easy', emoji: '😊', color: 'p1', token: 'p1' },
  { id: 'medium', emoji: '🧠', color: 'gold', token: 'gold' },
  { id: 'hard', emoji: '💎', color: 'orange', token: 'orange' },
  { id: 'perfect', emoji: '👑', color: 'p2', token: 'p2' },
];

export function DifficultySelect({ value, onChange, respectLocks = true }: DifficultySelectProps) {
  const { t } = useT();
  const { isUnlocked, winsByDifficulty } = useProgression();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
      {DIFFICULTIES.map((d) => {
        const locked = respectLocks && !isUnlocked(d.id);
        const wins = winsByDifficulty[d.id];
        const active = value === d.id;
        const req = getUnlockRequirement(d.id);
        const unlockText = req
          ? `${getUnlockText(d.id)}${wins > 0 ? ` (${wins}/${req.wins})` : ''}`
          : '';

        return (
          <Pressable
            key={d.id}
            disabled={locked}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: locked }}
            onPress={() => {
              if (locked) return;
              Haptics.selectionAsync().catch(() => undefined);
              onChange(d.id);
            }}
            style={({ pressed }) => [
              {
                flexGrow: 1,
                flexBasis: '47%',
                padding: spacing[3],
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: active ? colors.gold : colors.border,
                backgroundColor: active
                  ? alpha(colors.gold, 0.1)
                  : locked
                    ? alpha(colors.surface, 0.5)
                    : colors.surface,
                opacity: locked ? 0.6 : pressed ? 0.85 : 1,
                position: 'relative',
              },
            ]}
          >
            {wins > 0 && !locked ? (
              <View style={{ position: 'absolute', top: spacing[1], right: spacing[2] }}>
                <TiraText size="xs" variant="muted" style={{ opacity: 0.6 }}>{`${wins}✓`}</TiraText>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] }}>
              <TiraText size="lg">{locked ? '🔒' : d.emoji}</TiraText>
              <TiraText size="sm" weight="semibold" variant={locked ? 'muted' : d.color}>
                {t(`diff.${d.id}`)}
              </TiraText>
            </View>
            {locked ? (
              <TiraText size="xs" variant="gold" style={{ opacity: 0.7 }}>
                {unlockText}
              </TiraText>
            ) : (
              <TiraText size="xs" variant="muted">
                {t(`diff.${d.id}.desc`)}
              </TiraText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
