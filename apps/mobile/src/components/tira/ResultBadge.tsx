/**
 * ResultBadge — badge de resultado da partida (port do ResultBadge web).
 * Sem `playerSide` assume-se que o jogador é P1 (semântica da web);
 * com `playerSide`, P1/P2 é avaliado pelo lado verdadeiro do jogador.
 */
import { View } from 'react-native';
import { useT } from '@/lib/i18n/hook';
import { colors, radii, spacing } from '@/theme';
import { alpha } from './alpha';
import { TiraText } from './TiraText';

export type MatchResult = 'P1' | 'P2' | 'DRAW';
export type MatchSide = 'P1' | 'P2';

export interface ResultBadgeProps {
  result: MatchResult;
  playerSide?: MatchSide;
}

type Outcome = 'win' | 'loss' | 'draw';

const CFG: Record<Outcome, { bg: string; fg: string; border: string; key: 'result.win' | 'result.loss' | 'result.draw' }> = {
  win: {
    bg: alpha(colors.p1, 0.15),
    fg: colors.p1,
    border: alpha(colors.p1, 0.3),
    key: 'result.win',
  },
  loss: {
    bg: alpha(colors.p2, 0.15),
    fg: colors.p2,
    border: alpha(colors.p2, 0.3),
    key: 'result.loss',
  },
  draw: {
    bg: colors.surfaceAlt,
    fg: colors.textMuted,
    border: colors.border,
    key: 'result.draw',
  },
};

export function ResultBadge({ result, playerSide }: ResultBadgeProps) {
  const { t } = useT();
  const outcome: Outcome =
    result === 'DRAW' ? 'draw' : result === (playerSide ?? 'P1') ? 'win' : 'loss';
  const c = CFG[outcome];

  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radii.sm,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        alignSelf: 'flex-start',
      }}
    >
      <TiraText
        size="xs"
        weight="semibold"
        style={{ color: c.fg, textTransform: 'uppercase' }}
      >
        {t(c.key)}
      </TiraText>
    </View>
  );
}
