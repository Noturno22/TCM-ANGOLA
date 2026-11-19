/**
 * Tutorial — port 1:1 de `src/components/screens/TutorialScreen.tsx` (web).
 * Percurso guiado passo a passo das regras, com tabuleiros ilustrativos
 * (estados manuais do motor) e a mesma navegação/indicadores do ecrã web.
 */
import { router } from 'expo-router';
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crown,
  Grid3x3,
  Hand,
  Play,
  Shield,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import {
  createGame,
  type Cell,
  type GameState,
  type Line,
  type Move,
  type Square,
  type Threat,
} from '@tira/engine';
import { Board } from '@/components/board/Board';
import { GameButton, GameCard } from '@/components/game/ui';
import { TiraHeading, TiraScreen, TiraText, alpha } from '@/components/tira';
import { useT } from '@/lib/i18n/hook';
import { boardGeometry, colors, radii, spacing, typography } from '@/theme';

const P1 = 'P1' as const;
const P2 = 'P2' as const;
const _ = null;
const WIN_LINE: Line = [1, 5, 9];

function makeState(board: Cell[], extra: Partial<GameState> = {}): GameState {
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

type StepHighlight = 'p1' | 'p2' | 'gold';

interface TutorialStep {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Estado do tabuleiro a mostrar. */
  state: GameState;
  selected?: Square | null;
  legalMoves?: Move[];
  threats?: readonly Threat[];
  /** Anotação extra abaixo do tabuleiro. */
  annotation?: string;
  highlight?: StepHighlight;
}

const STEPS: TutorialStep[] = [
  {
    title: 'Este é o tabuleiro',
    description:
      'Um tabuleiro 3x3 com 9 casas numeradas. A casa central (5) tem um alvo dourado.',
    icon: Grid3x3,
    state: createGame(),
    annotation: 'Casas 1-3 no topo, 4-6 no meio, 7-9 na base.',
    highlight: 'gold',
  },
  {
    title: 'Controlas três peças',
    description:
      'Tu és o Jogador 1. As tuas peças são verdes (triângulo) e começam nas casas 1, 2 e 3.',
    icon: Hand,
    state: makeState([P1, P1, P1, _, _, _, P2, P2, P2]),
    selected: 2,
    legalMoves: [],
    annotation: 'Peças verdes = tu. Peças vermelhas (círculo) = adversário.',
    highlight: 'p1',
  },
  {
    title: 'O Jogador 1 começa',
    description:
      'O jogo começa sempre com o Jogador 1 (verde). Depois, os jogadores alternam turnos.',
    icon: Play,
    state: createGame(),
    annotation: 'Seta verde aponta para quem joga primeiro.',
    highlight: 'p1',
  },
  {
    title: 'Escolhe uma peça',
    description:
      'Toca numa peça tua para a selecionar. Vai aparecer um contorno dourado à volta.',
    icon: Hand,
    state: createGame(),
    selected: 2,
    legalMoves: [],
    annotation: 'Peça selecionada (contorno dourado): casa 2.',
    highlight: 'p1',
  },
  {
    title: 'Move uma casa de cada vez',
    description:
      'Só podes mover uma peça para uma casa vizinha LIGADA POR UMA LINHA do tabuleiro (horizontal, vertical ou uma diagonal).',
    icon: Target,
    state: createGame(),
    selected: 1,
    legalMoves: [
      { from: 1, to: 4 },
      { from: 1, to: 5 },
    ],
    annotation:
      'Da casa 1 podes ir para a casa 4 (para baixo) ou para a casa 5 (diagonal sobre a linha 1-5-9).',
    highlight: 'p1',
  },
  {
    title: 'Diagonais fora das linhas não contam',
    description:
      'Uma diagonal só é válida se estiver sobre uma das linhas do tabuleiro. As casas 4 e 6, a partir da casa 2, não estão.',
    icon: Ban,
    state: createGame(),
    selected: 2,
    legalMoves: [{ from: 2, to: 5 }],
    annotation:
      'Da casa 2 só podes ir para o centro (5). As casas 4 e 6 estão na diagonal, mas fora das linhas — não são destinos válidos.',
    highlight: 'p2',
  },
  {
    title: 'Forma uma linha de três',
    description:
      'Vence quem primeiro alinhar as suas 3 peças numa das 8 linhas (3 horizontais, 3 verticais, 2 diagonais).',
    icon: Crown,
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
    icon: Shield,
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
    icon: CircleDot,
    state: createGame(),
    annotation: 'A casa 5 é a mais poderosa do tabuleiro.',
    highlight: 'gold',
  },
  {
    title: 'Quem formar três primeiro vence',
    description:
      'Estás pronto! Lembra-te: seleciona, move, alinha três. Simples de começar, difícil de dominar.',
    icon: Crown,
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

function ButtonLabel({ children, color }: { children: string; color: string }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        color,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.body,
      }}
    >
      {children}
    </Text>
  );
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

  const Icon = current.icon;
  const iconColor = current.highlight ? colors[current.highlight] : colors.text;

  return (
    <TiraScreen>
      {/* Cabeçalho do tutorial */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <TiraText
            variant="gold"
            weight="semibold"
            style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}
          >
            {t('tutorial.title')}
          </TiraText>
          <TiraHeading level="h2" style={{ letterSpacing: 0.675, lineHeight: 36 }}>{t('tutorial.step', { n: step + 1, total: STEPS.length })}</TiraHeading>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tutorial.skip')}
          onPress={goHome}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[1],
            paddingHorizontal: spacing[3],
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: alpha(colors.surface, 0.6),
            borderWidth: 1,
            borderColor: alpha(colors.white, 0.04),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <TiraText size="xs" variant="muted">
            {t('tutorial.skip')}
          </TiraText>
          <X size={14} color={colors.textMuted} />
        </Pressable>
      </View>

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
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        {STEPS.map((s, i) => (
          <Pressable
            key={s.title}
            accessibilityRole="button"
            accessibilityLabel={`Ir para passo ${i + 1}`}
            accessibilityState={{ selected: i === step }}
            onPress={() => setStep(i)}
            style={{
              width: i === step ? spacing[6] : 6,
              height: 6,
              borderRadius: radii.pill,
              backgroundColor:
                i === step ? colors.gold : i < step ? colors.p1 : colors.surfaceAlt,
            }}
          />
        ))}
      </View>

      {/* Cartão do passo atual */}
      <GameCard glow={current.highlight ?? null} style={{ padding: spacing[5] }}>
        {/* Ícone + título */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing[3],
            marginBottom: spacing[4],
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.xl,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: current.highlight
                ? alpha(colors[current.highlight], 0.15)
                : colors.surfaceAlt,
            }}
          >
            <Icon size={20} color={iconColor} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TiraHeading level="h3" style={{ fontSize: 22.5, letterSpacing: 0.5625, lineHeight: 28.125 }}>
              {current.title}
            </TiraHeading>
            <TiraText
              size="sm"
              variant="muted"
              style={{
                marginTop: spacing[1],
                lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.relaxed),
              }}
            >
              {current.description}
            </TiraText>
          </View>
        </View>

        {/* Tabuleiro ilustrativo */}
        <View style={{ alignItems: 'center', marginBottom: spacing[3] }}>
          <Board
            state={current.state}
            selectedSquare={current.selected ?? null}
            legalMoves={current.legalMoves ?? []}
            threats={current.threats ?? []}
            size={boardSize}
          />
        </View>

        {/* Anotação */}
        {current.annotation ? (
          <View
            style={{
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderRadius: radii.lg,
              backgroundColor: alpha(colors.surface, 0.6),
              borderWidth: 1,
              borderColor: alpha(colors.white, 0.04),
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.xs,
                lineHeight: Math.round(typography.fontSize.xs * typography.lineHeight.relaxed),
                fontFamily: typography.fontFamily.body,
                color: alpha(colors.text, 0.9),
              }}
            >
              <Text
                style={{
                  fontFamily: typography.fontFamily.body,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.gold,
                }}
              >
                ▸{' '}
              </Text>
              {current.annotation}
            </Text>
          </View>
        ) : null}
      </GameCard>

      {/* Botões de navegação */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <GameButton
          variant="outline"
          style={{ flex: 1, paddingHorizontal: spacing[2] }}
          disabled={isFirst}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          accessibilityLabel="Passo anterior"
        >
          <ChevronLeft size={16} color={colors.text} />
          <ButtonLabel color={colors.text}>{t('tutorial.prev')}</ButtonLabel>
        </GameButton>

        {isLast ? (
          <GameButton
            variant="p1"
            style={{ flex: 1, paddingHorizontal: spacing[2] }}
            onPress={() => router.push('/offline')}
            accessibilityLabel="Começar a jogar"
          >
            <Check size={16} color={colors.white} />
            <ButtonLabel color={colors.white}>{t('tutorial.done')}</ButtonLabel>
          </GameButton>
        ) : (
          <GameButton
            variant="p1"
            style={{ flex: 1, paddingHorizontal: spacing[2] }}
            onPress={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            accessibilityLabel="Próximo passo"
          >
            <ButtonLabel color={colors.white}>{t('tutorial.next')}</ButtonLabel>
            <ChevronRight size={16} color={colors.white} />
          </GameButton>
        )}
      </View>

      {/* Saltar para o fim */}
      {!isLast ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setStep(STEPS.length - 1)}
          style={{ width: '100%', alignItems: 'center', paddingVertical: spacing[1] }}
        >
          <TiraText size="xs" variant="muted">
            {t('tutorial.skip_end')}
          </TiraText>
        </Pressable>
      ) : null}
    </TiraScreen>
  );
}
