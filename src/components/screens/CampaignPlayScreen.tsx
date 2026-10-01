'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flag,
  Check,
  X,
  RefreshCw,
  ChevronRight,
  Target,
  Zap,
  Clock,
  Lightbulb,
  Trophy,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useGame } from '@/store/game';
import { useCampaign } from '@/store/campaign';
import { useProfile } from '@/store/profile';
import { getCampaignLevel, type CampaignLevel } from '@/lib/campaign';
import { isGameOver, type Square } from '@/lib/engine';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard } from '@/components/game/ui';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';

type ResultType = 'success' | 'failure' | null;

export function CampaignPlayScreen() {
  const navigate = useApp((s) => s.navigate);
  const back = useApp((s) => s.back);
  const campaignLevelId = useApp((s) => s.campaignLevelId);
  const completeLevel = useCampaign((s) => s.completeLevel);
  const recordAttempt = useCampaign((s) => s.recordAttempt);
  const addCoins = useProfile((s) => s.addCoins);

  const level = useMemo<CampaignLevel | null>(
    () => (campaignLevelId ? getCampaignLevel(campaignLevelId) : null),
    [campaignLevelId],
  );

  const {
    state,
    mode,
    difficulty,
    humanSide,
    selectedSquare,
    validTargets,
    lastMove,
    winner,
    winningLine,
    moveCount,
    startGame,
    selectSquare,
    attemptMove,
  } = useGame();

  const [result, setResult] = useState<ResultType>(null);
  const [showHint, setShowHint] = useState(false);
  const [attemptRecorded, setAttemptRecorded] = useState(false);
  const [startedLevelId, setStartedLevelId] = useState<number | null>(null);
  const [prevGameEnded, setPrevGameEnded] = useState(false);

  // Iniciar o nível quando muda — padrão "adjust state during render"
  if (level && startedLevelId !== level.id) {
    setStartedLevelId(level.id);
    startGame({
      mode: 'pve',
      difficulty: level.difficulty,
      humanSide: level.humanSide,
      showThreats: true,
      timePerTurn: 0,
    });
    setResult(null);
    setShowHint(false);
    setAttemptRecorded(false);
    setPrevGameEnded(false);
  }

  // Verificar objetivo quando o jogo termina — padrão "adjust state during render"
  const gameEnded = isGameOver(state);
  if (gameEnded !== prevGameEnded) {
    setPrevGameEnded(gameEnded);
    if (gameEnded && level && !attemptRecorded) {
      setAttemptRecorded(true);
      recordAttempt(level.id);
      const success = checkObjective(level, state, moveCount);
      if (success) {
        setResult('success');
        completeLevel(level.id);
        addCoins(level.reward);
        playSound('win');
      } else {
        setResult('failure');
        playSound('error');
      }
    }
    // Se o jogo reiniciou (não terminado), limpar resultado
    if (!gameEnded && result !== null) {
      setResult(null);
    }
  }

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (isGameOver(state)) return;
      if (state.currentPlayer !== humanSide) return;
      const cell = state.board[sq - 1];
      if (cell === state.currentPlayer) {
        selectSquare(sq);
      } else if (selectedSquare && validTargets.includes(sq)) {
        attemptMove(sq);
      }
    },
    [state, humanSide, selectedSquare, validTargets, selectSquare, attemptMove],
  );

  const handleRestart = () => {
    if (!level) return;
    startGame({
      mode: 'pve',
      difficulty: level.difficulty,
      humanSide: level.humanSide,
      showThreats: true,
      timePerTurn: 0,
    });
    setResult(null);
    setAttemptRecorded(false);
    setPrevGameEnded(false);
  };

  const handleNextLevel = () => {
    if (!level) return;
    const nextId = level.id + 1;
    const nextLevel = getCampaignLevel(nextId);
    if (nextLevel) {
      useApp.getState().setCampaignLevelId(nextId);
      handleRestart();
    } else {
      navigate('campaign');
    }
  };

  if (!level) {
    return (
      <div className="space-y-5 animate-slide-up pb-4">
        <GameCard className="p-8 text-center">
          <Flag className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum nível selecionado.</p>
          <GameButton variant="p1" onClick={() => navigate('campaign')}>
            Voltar à Campanha
          </GameButton>
        </GameCard>
      </div>
    );
  }

  const flipped = level.humanSide === 'P2';

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0 angolan-pattern opacity-30" />

      {/* Cabeçalho */}
      <header className="relative z-10 px-4 py-3 border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            className="w-9 h-9 rounded-full bg-surface/60 flex items-center justify-center hover:bg-surface"
            aria-label="Voltar"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="text-center flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Nível {level.id} • {diffLabel(level.difficulty)}
            </p>
            <p className="text-xs text-gold font-medium truncate">{level.title}</p>
          </div>
          <div className="w-9 h-9" />
        </div>
      </header>

      {/* Área principal */}
      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-custom px-4 py-4">
        {/* Objetivo */}
        <GameCard className={cn('p-3 mb-4', result === 'success' && 'border-p1/40', result === 'failure' && 'border-p2/40')}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              result === 'success' ? 'bg-p1/15 text-p1' :
              result === 'failure' ? 'bg-p2/15 text-p2' :
              'bg-gold/15 text-gold',
            )}>
              {result === 'success' ? <Check className="w-5 h-5" strokeWidth={3} /> :
               result === 'failure' ? <X className="w-5 h-5" strokeWidth={3} /> :
               <Target className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Objetivo</p>
              <p className="text-sm font-medium">
                {objectiveText(level)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Jogadas</p>
              <p className={cn(
                'font-display text-lg',
                level.objective.type === 'win_fast' && moveCount > (level.objective.maxMoves ?? 0)
                  ? 'text-p2'
                  : 'text-foreground',
              )}>
                {moveCount}
                {level.objective.maxMoves && `/${level.objective.maxMoves}`}
                {level.objective.minMoves && `/${level.objective.minMoves}`}
              </p>
            </div>
          </div>
        </GameCard>

        {/* Tabuleiro */}
        <div className="flex justify-center mb-4">
          <Board
            board={state.board}
            selectedSquare={selectedSquare}
            validTargets={validTargets}
            lastMove={lastMove}
            winningLine={winningLine}
            threatSquares={[]}
            onSquareClick={handleSquareClick}
            flipped={flipped}
            disabled={state.currentPlayer !== humanSide}
            size="md"
          />
        </div>

        {/* Ações */}
        <div className="flex gap-2 max-w-md mx-auto">
          <GameButton
            variant="outline"
            className="flex-1"
            onClick={() => setShowHint((v) => !v)}
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Dica
          </GameButton>
          <GameButton
            variant="p2"
            className="flex-1"
            onClick={handleRestart}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reiniciar
          </GameButton>
        </div>

        {/* Dica */}
        <AnimatePresence>
          {showHint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden max-w-md mx-auto mt-2"
            >
              <GameCard className="p-4 bg-gold/5 border-gold/30">
                <div className="flex gap-3">
                  <Lightbulb className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{level.hint}</p>
                </div>
              </GameCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Overlay de resultado */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-sm"
            >
              <GameCard className={cn('p-6 text-center', result === 'success' ? 'border-p1/40' : 'border-p2/40')} glow={result === 'success' ? 'gold' : null}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                  className="text-6xl mb-3"
                >
                  {result === 'success' ? '🏆' : '😔'}
                </motion.div>
                <h2 className={cn(
                  'font-display text-3xl tracking-wide mb-1',
                  result === 'success' ? 'text-p1 text-glow-gold' : 'text-p2',
                )}>
                  {result === 'success' ? 'NÍVEL COMPLETO!' : 'Tenta outra vez'}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {result === 'success'
                    ? `+${level.reward} KZ de recompensa`
                    : 'Não desistas! Tenta uma estratégia diferente.'}
                </p>

                <div className="space-y-2">
                  {result === 'success' ? (
                    <>
                      <GameButton variant="p1" className="w-full" onClick={handleNextLevel}>
                        <ChevronRight className="w-4 h-4 mr-2" />
                        {getCampaignLevel(level.id + 1) ? 'Próximo nível' : 'Concluir campanha'}
                      </GameButton>
                      <GameButton variant="outline" className="w-full" onClick={handleRestart}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Jogar novamente
                      </GameButton>
                    </>
                  ) : (
                    <>
                      <GameButton variant="p1" className="w-full" onClick={handleRestart}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Tentar novamente
                      </GameButton>
                      <GameButton variant="outline" className="w-full" onClick={() => navigate('campaign')}>
                        Voltar à Campanha
                      </GameButton>
                    </>
                  )}
                </div>
              </GameCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function checkObjective(
  level: CampaignLevel,
  state: { winner: 'P1' | 'P2' | null; status: string },
  moveCount: number,
): boolean {
  const { objective, humanSide } = level;
  const humanWon = state.winner === humanSide;

  if (objective.type === 'win') {
    return humanWon;
  }
  if (objective.type === 'win_fast') {
    return humanWon && moveCount <= (objective.maxMoves ?? 0);
  }
  if (objective.type === 'survive') {
    // Sobreviver = o jogo terminou (qualquer resultado) após N jogadas
    // ou o humano ganhou
    return (state.status !== 'PLAYER_1_TURN' && state.status !== 'PLAYER_2_TURN') ||
      humanWon;
  }
  return false;
}

function objectiveText(level: CampaignLevel): string {
  const { objective } = level;
  if (objective.type === 'win') return 'Vence a partida';
  if (objective.type === 'win_fast') return `Vence em ${objective.maxMoves} jogadas ou menos`;
  if (objective.type === 'survive') return `Resiste ${objective.minMoves} jogadas sem perder`;
  return 'Vence a partida';
}

function diffLabel(d: string): string {
  return d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : d === 'hard' ? 'Difícil' : 'Perfeito';
}
