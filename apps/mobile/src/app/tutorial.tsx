/**
 * Tutorial — port do TutorialScreen web: percurso guiado passo a passo
 * das regras, com tabuleiros ilustrativos (estados manuais do motor).
 * No fim, "Começar a jogar" leva ao modo offline.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, useWindowDimensions, View } from 'react-native';
import {
  createGame,
  type Cell,
  type GameState,
  type Line,
  type Square,
  type Threat,
} from '@tira/engine';
import { Board } from '@/components/board/Board';
import {
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { useT } from '@/lib/i18n/hook';
import { boardGeometry, colors, radii, spacing, type ColorToken } from '@/theme';

const P1 = 'P1' as const;
const P2 = 'P2' as const;
const _ = null;
const WIN_LINE: Line = [1, 5, 9];

function makeState(board: Cell[], extra?: Partial<GameState>): GameState {
  return {
    ...createGame(),
    board,
    currentPlayer: 'P1',
    status: 'PLAYER_1_TURN',
    winner: null,
    winningLine: null,
    moveCount: 0,
    history: [],
    positionCounts: {},
    ...extra,
  };
}

interface TutorialStep {
  title: string;
  description: string;
  emoji: string;
  state?: GameState;
  selected?: Square | null;
  validTargets?: Square[];
  threats?: readonly Threat[];
  annotation?: string;
  highlight?: ColorToken;
}

const STEPS: TutorialStep[] = [
  {
    title: 'Este é o tabuleiro',
    description:
      'Um tabuleiro 3x3 com 9 casas numeradas. A casa central (5) tem um alvo dourado.',
    emoji: '📋',
    state: createGame(),
    annotation: 'Casas 1-3 no topo, 4-6 no meio, 7-9 na base.',
    highlight: 'gold',
  },
  {
    title: 'Controlas três peças',
    description:
      'Tu és o Jogador 1. As tuas peças são verdes (▲) e começam nas casas 1, 2 e 3.',
    emoji: '✋',
    state: makeState([P1, P1, P1, _, _, _, P2, P2, P2]),
    selected: 2,
    annotation: 'Peças verdes = tu. Peças vermelhas (●) = adversário.',
    highlight: 'p1',
  },
  {
    title: 'O Jogador 1 começa',
    description:
      'O jogo começa sempre com o Jogador 1 (verde). Depois, os jogadores alternam turnos.',
    emoji: '▶️',
    state: createGame(),
    annotation: 'Durante a partida, o painel indica sempre de quem é a vez.',
    highlight: 'p1',
  },
  {
    title: 'Escolhe uma peça',
    description:
      'Toca numa peça tua para a selecionar. Vai aparecer um contorno dourado à volta.',
    emoji: '☝️',
    state: createGame(),
    selected: 2,
    validTargets: [5],
    annotation: 'Peça selecionada: casa 2. A casa 5 é o destino mais direto.',
    highlight: 'p1',
  },
  {
    title: 'Escolhe uma casa livre',
    description:
      'As casas válidas ficam marcadas com um ponto verde a pulsar. Toca numa delas para mover.',
    emoji: '🎯',
    state: createGame(),
    selected: 2,
    validTargets: [4, 5, 6],
    annotation: 'Da casa 2 podes ir para qualquer casa livre vizinha.',
    highlight: 'p1',
  },
  {
    title: 'Não é permitido saltar peças',
    description:
      'Se uma peça estiver no caminho, não podes saltá-la. O movimento fica bloqueado.',
    emoji: '🚫',
    state: makeState([_, P1, P1, _, P2, _, P2, P2, _]),
    selected: 2,
    validTargets: [4, 6],
    annotation:
      'Da casa 2 não podes ir para a 8 porque a casa 5 está ocupada por uma peça vermelha.',
    highlight: 'p2',
  },
  {
    title: 'Forma uma linha de três',
    description:
      'Vence quem primeiro alinhar as suas 3 peças numa das 8 linhas (3 horizontais, 3 verticais, 2 diagonais).',
    emoji: '👑',
    state: makeState([P1, P2, _, _, P1, P2, P2, _, P1], {
      winner: 'P1',
      winningLine: WIN_LINE,
      status: 'WIN_P1',
    }),
    annotation: 'Linha diagonal 1-5-9 completa. Vitória do Jogador 1!',
    highlight: 'gold',
  },
  {
    title: 'Bloqueia o adversário',
    description:
      'Se o adversário tiver duas peças alinhadas, tens de bloquear a casa que falta. Caso contrário, ele vence.',
    emoji: '🛡️',
    state: makeState([P2, P1, P1, _, P2, P2, P1, _, _]),
    threats: [{ player: 'P2', from: 6, to: 9, line: WIN_LINE }],
    annotation:
      'A casa 9 está a piscar: o adversário pode completar a linha 1-5-9 se não bloqueares.',
    highlight: 'p2',
  },
  {
    title: 'O centro é estratégico',
    description:
      'A casa 5 participa em 4 das 8 linhas vencedoras (linha do meio, coluna do meio e duas diagonais). Controlá-la dá vantagem.',
    emoji: '🧭',
    state: createGame(),
    annotation: 'A casa 5 é a mais poderosa do tabuleiro.',
    highlight: 'gold',
  },
  {
    title: 'Quem formar três primeiro vence',
    description:
      'Estás pronto! Lembra-te: seleciona, move, alinha três. Simples de começar, difícil de dominar.',
    emoji: '🏆',
    state: makeState([P1, P2, P2, P2, P1, _, _, _, P1], {
      winner: 'P1',
      winningLine: WIN_LINE,
      status: 'WIN_P1',
    }),
    annotation: 'Boa sorte! Vais jogar a tua primeira partida.',
    highlight: 'gold',
  },
];

function goHome(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

export default function TutorialScreen() {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const { width } = useWindowDimensions();

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  const boardSize = Math.min(
    boardGeometry.gridSizePresets.sm,
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );

  const legalMoves =
    current.selected != null && current.validTargets
      ? current.validTargets.map((to) => ({ from: current.selected as Square, to }))
      : [];

  const cardBorder = current.highlight ? alpha(colors[current.highlight], 0.3) : colors.border;

  return (
    <TiraScreen
      title={t('tutorial.title')}
      subtitle={t('tutorial.step', { n: step + 1, total: STEPS.length })}
      showBack
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tutorial.skip')}
          onPress={goHome}
          style={({ pressed }) => ({
            paddingVertical: spacing[1],
            paddingHorizontal: spacing[3],
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <TiraText size="xs" variant="muted">{`${t('tutorial.skip')} ✕`}</TiraText>
        </Pressable>
      }
    >
      {/* Barra de progresso */}
      <View
        style={{
          height: 6,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: colors.p1,
          }}
        />
      </View>

      {/* Indicadores de passos */}
      <View style={{ flexDirection: 'row', gap: spacing[1], justifyContent: 'center' }}>
        {STEPS.map((s, i) => (
          <Pressable
            key={s.title}
            accessibilityRole="button"
            accessibilityLabel={t('tutorial.step', { n: i + 1, total: STEPS.length })}
            accessibilityState={{ selected: i === step }}
            onPress={() => setStep(i)}
            style={{
              width: i === step ? spacing[6] : spacing[1],
              height: 6,
              borderRadius: radii.pill,
              backgroundColor: i === step ? colors.gold : i < step ? colors.p1 : colors.surfaceAlt,
            }}
          />
        ))}
      </View>

      {/* Cartão do passo atual */}
      <TiraCard style={{ borderColor: cardBorder }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], marginBottom: spacing[4] }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.xl,
              backgroundColor: current.highlight
                ? alpha(colors[current.highlight], 0.15)
                : colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TiraText style={{ fontSize: 22 }}>{current.emoji}</TiraText>
          </View>
          <View style={{ flex: 1, gap: spacing[1] }}>
            <TiraHeading level="h3">{current.title}</TiraHeading>
            <TiraText size="sm" variant="muted">
              {current.description}
            </TiraText>
          </View>
        </View>

        {current.state ? (
          <View style={{ alignItems: 'center', marginBottom: spacing[3] }}>
            <Board
              state={current.state}
              selectedSquare={current.selected ?? null}
              legalMoves={legalMoves}
              threats={current.threats ?? []}
              size={boardSize}
            />
          </View>
        ) : null}

        {current.annotation ? (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing[2],
              padding: spacing[3],
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <TiraText size="sm" variant="gold" weight="bold">
              ▸
            </TiraText>
            <TiraText size="xs" style={{ flex: 1 }}>
              {current.annotation}
            </TiraText>
          </View>
        ) : null}
      </TiraCard>

      {/* Navegação */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <TiraButton
          variant="outline"
          size="lg"
          style={{ flex: 1 }}
          disabled={isFirst}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          accessibilityLabel={t('tutorial.prev')}
        >
          {`‹ ${t('tutorial.prev')}`}
        </TiraButton>
        {isLast ? (
          <TiraButton
            variant="p1"
            size="lg"
            style={{ flex: 1 }}
            onPress={() => router.push('/offline')}
            accessibilityLabel={t('tutorial.done')}
          >
            {`✓ ${t('tutorial.done')}`}
          </TiraButton>
        ) : (
          <TiraButton
            variant="p1"
            size="lg"
            style={{ flex: 1 }}
            onPress={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            accessibilityLabel={t('tutorial.next')}
          >
            {`${t('tutorial.next')} ›`}
          </TiraButton>
        )}
      </View>

      {!isLast ? (
        <TiraButton variant="ghost" size="sm" fullWidth onPress={() => setStep(STEPS.length - 1)}>
          {t('tutorial.skip_end')}
        </TiraButton>
      ) : null}
    </TiraScreen>
  );
}
