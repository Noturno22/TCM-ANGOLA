'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Play,
  Hand,
  Target,
  Ban,
  Crown,
  Shield,
  CircleDot,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard } from '@/components/game/ui';
import { createGame, type Cell, type GameState, type Move, type Square } from '@/lib/engine';
import { cn } from '@/lib/utils';

/** Constrói um estado de jogo manual a partir de um board. */
function makeState(
  board: (Cell)[],
  extra: Partial<GameState> = {},
): GameState {
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
  icon: React.ReactNode;
  /** Estado do tabuleiro a mostrar (null = sem tabuleiro) */
  board?: readonly Cell[];
  selected?: Square | null;
  validTargets?: Square[];
  lastMove?: Move | null;
  winningLine?: readonly number[] | null;
  threatSquares?: Square[];
  /** Anotação extra abaixo do tabuleiro */
  annotation?: string;
  highlight?: 'p1' | 'p2' | 'gold';
}

const P1 = 'P1' as const;
const P2 = 'P2' as const;
const _ = null;

const STEPS: TutorialStep[] = [
  {
    title: 'Este é o tabuleiro',
    description:
      'Um tabuleiro 3x3 com 9 casas numeradas. A casa central (5) tem um alvo dourado.',
    icon: <GridIcon />,
    board: createGame().board,
    annotation: 'Casas 1-3 no topo, 4-6 no meio, 7-9 na base.',
    highlight: 'gold',
  },
  {
    title: 'Controlas três peças',
    description:
      'Tu és o Jogador 1. As tuas peças são verdes (▲) e começam nas casas 1, 2 e 3.',
    icon: <Hand className="w-5 h-5" />,
    board: makeState([P1, P1, P1, _, _, _, P2, P2, P2]).board,
    selected: 2,
    validTargets: [],
    annotation: 'Peças verdes = tu. Peças vermelhas (●) = adversário.',
    highlight: 'p1',
  },
  {
    title: 'O Jogador 1 começa',
    description:
      'O jogo começa sempre com o Jogador 1 (verde). Depois, os jogadores alternam turnos.',
    icon: <Play className="w-5 h-5" />,
    board: createGame().board,
    annotation: 'Seta verde aponta para quem joga primeiro.',
    highlight: 'p1',
  },
  {
    title: 'Escolhe uma peça',
    description:
      'Toca numa peça tua para a selecionar. Vai aparecer um contorno dourado à volta.',
    icon: <Hand className="w-5 h-5" />,
    board: createGame().board,
    selected: 2,
    validTargets: [5],
    annotation: 'Peça selecionada: casa 2. A casa 5 é o destino mais direto.',
    highlight: 'p1',
  },
  {
    title: 'Escolhe uma casa livre',
    description:
      'As casas válidas ficam marcadas com um ponto verde a pulsar. Toca numa delas para mover.',
    icon: <Target className="w-5 h-5" />,
    board: createGame().board,
    selected: 2,
    validTargets: [4, 5, 6, 7, 9],
    annotation: 'Da casa 2 podes ir para qualquer casa livre não bloqueada.',
    highlight: 'p1',
  },
  {
    title: 'Não é permitido saltar peças',
    description:
      'Se uma peça estiver no caminho, não podes saltá-la. O movimento fica bloqueado.',
    icon: <Ban className="w-5 h-5" />,
    board: makeState([_, P1, P1, _, P2, _, P2, P2, _]).board,
    selected: 2,
    validTargets: [4, 6, 7, 9],
    annotation:
      'Da casa 2 não podes ir para a 8 porque a casa 5 está ocupada por uma peça vermelha.',
    highlight: 'p2',
  },
  {
    title: 'Forma uma linha de três',
    description:
      'Vence quem primeiro alinhar as suas 3 peças numa das 8 linhas (3 horizontais, 3 verticais, 2 diagonais).',
    icon: <Crown className="w-5 h-5" />,
    board: makeState(
      [P1, P2, _, _, P1, P2, P2, _, P1],
      { winner: 'P1', winningLine: [1, 5, 9], status: 'WIN_P1' },
    ).board,
    winningLine: [1, 5, 9],
    annotation: 'Linha diagonal 1-5-9 completa. Vitória do Jogador 1!',
    highlight: 'gold',
  },
  {
    title: 'Bloqueia o adversário',
    description:
      'Se o adversário tiver duas peças alinhadas, tens de bloquear a casa que falta. Caso contrário, ele vence.',
    icon: <Shield className="w-5 h-5" />,
    board: makeState([P2, P1, P1, _, P2, P2, P1, _, _]).board,
    threatSquares: [9],
    annotation:
      'A casa 9 está a piscar: o adversário pode completar a linha 1-5-9 se não bloqueares.',
    highlight: 'p2',
  },
  {
    title: 'O centro é estratégico',
    description:
      'A casa 5 participa em 4 das 8 linhas vencedoras (linha do meio, coluna do meio e duas diagonais). Controlá-la dá vantagem.',
    icon: <CircleDot className="w-5 h-5" />,
    board: createGame().board,
    annotation: 'A casa 5 é a mais poderosa do tabuleiro.',
    highlight: 'gold',
  },
  {
    title: 'Quem formar três primeiro vence',
    description:
      'Estás pronto! Lembra-te: seleciona, move, alinha três. Simples de começar, difícil de dominar.',
    icon: <Crown className="w-5 h-5" />,
    board: makeState(
      [P1, P2, P2, P2, P1, _, _, _, P1],
      { winner: 'P1', winningLine: [1, 5, 9], status: 'WIN_P1' },
    ).board,
    winningLine: [1, 5, 9],
    annotation: 'Boa sorte! Vais jogar a tua primeira partida.',
    highlight: 'gold',
  },
];

export function TutorialScreen() {
  const navigate = useApp((s) => s.navigate);
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  const noop = () => {};

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      {/* Cabeçalho do tutorial */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gold font-semibold">
            Tutorial
          </p>
          <h1 className="font-display text-2xl tracking-wide">
            Passo {step + 1} de {STEPS.length}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('home')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full bg-surface/60 border border-border/40"
          aria-label="Saltar tutorial"
        >
          Saltar
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-p1 to-gold rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </div>

      {/* Indicadores de passos */}
      <div className="flex gap-1.5 justify-center">
        {STEPS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === step
                ? 'w-6 bg-gold'
                : i < step
                  ? 'w-1.5 bg-p1'
                  : 'w-1.5 bg-surface-2',
            )}
            aria-label={`Ir para passo ${i + 1}`}
            aria-current={i === step}
          />
        ))}
      </div>

      {/* Cartão do passo atual */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
        >
          <GameCard className="p-5" glow={current.highlight ?? null}>
            {/* Ícone + título */}
            <div className="flex items-start gap-3 mb-4">
              <div
                className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                  current.highlight === 'p1' && 'bg-p1/15 text-p1',
                  current.highlight === 'p2' && 'bg-p2/15 text-p2',
                  current.highlight === 'gold' && 'bg-gold/15 text-gold',
                  !current.highlight && 'bg-surface-2 text-foreground',
                )}
              >
                {current.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-xl tracking-wide leading-tight">
                  {current.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {current.description}
                </p>
              </div>
            </div>

            {/* Tabuleiro ilustrativo */}
            {current.board && (
              <div className="flex justify-center mb-3">
                <Board
                  board={current.board}
                  selectedSquare={current.selected ?? null}
                  validTargets={current.validTargets ?? []}
                  lastMove={current.lastMove ?? null}
                  winningLine={current.winningLine ?? null}
                  threatSquares={current.threatSquares ?? []}
                  onSquareClick={noop}
                  disabled
                  size="sm"
                />
              </div>
            )}

            {/* Anotação */}
            {current.annotation && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-surface/60 border border-border/40 text-xs text-foreground/90 leading-relaxed">
                <span className="text-gold font-semibold mr-1.5">▸</span>
                {current.annotation}
              </div>
            )}
          </GameCard>
        </motion.div>
      </AnimatePresence>

      {/* Botões de navegação */}
      <div className="grid grid-cols-2 gap-3">
        <GameButton
          variant="outline"
          className="h-12"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={isFirst}
          aria-label="Passo anterior"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Anterior
        </GameButton>

        {isLast ? (
          <GameButton
            variant="p1"
            className="h-12"
            onClick={() => navigate('offline-select')}
            aria-label="Começar a jogar"
          >
            <Check className="w-4 h-4 mr-1" />
            Começar a jogar
          </GameButton>
        ) : (
          <GameButton
            variant="p1"
            className="h-12"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            aria-label="Próximo passo"
          >
            Próximo
            <ChevronRight className="w-4 h-4 ml-1" />
          </GameButton>
        )}
      </div>

      {/* Saltar para o fim */}
      {!isLast && (
        <button
          type="button"
          onClick={() => setStep(STEPS.length - 1)}
          className="w-full text-center text-xs text-muted-foreground hover:text-gold transition-colors py-1"
        >
          Saltar para o fim →
        </button>
      )}
    </div>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  );
}
