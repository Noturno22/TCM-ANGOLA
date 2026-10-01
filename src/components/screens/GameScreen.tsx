'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  LogOut,
  Flag,
  MessageCircle,
  Clock,
  Trophy,
  Handshake,
  ChevronLeft,
  Undo2,
  Eye,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import { isGameOver, getLegalMoves, type Square } from '@/lib/engine';
import { playSound } from '@/lib/sound';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard, LevelAvatar } from '@/components/game/ui';
import { Confetti } from '@/components/game/Confetti';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export function GameScreen() {
  const navigate = useApp((s) => s.navigate);
  const back = useApp((s) => s.back);
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
    isAiThinking,
    moveCount,
    currentThreats,
    showThreats,
    timePerTurn,
    selectSquare,
    attemptMove,
    resign,
    restart,
    undo,
    toggleThreats,
  } = useGame();

  const [p1Time, setP1Time] = useState(timePerTurn);
  const [p2Time, setP2Time] = useState(timePerTurn);
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const hasClock = timePerTurn > 0;

  // Relógio por turno (configurável: 45s normal, 15s rápido, 0 sem relógio)
  useEffect(() => {
    if (!hasClock || isGameOver(state)) return;
    const interval = setInterval(() => {
      if (state.currentPlayer === 'P1') {
        setP1Time((t) => {
          const next = Math.max(0, t - 1);
          // Som de countdown nos últimos 5 segundos (apenas vez do humano)
          if (next <= 5 && next > 0 && (mode === 'pvp' || (mode === 'pve' && state.currentPlayer === humanSide))) {
            playSound('countdown');
          }
          return next;
        });
      } else {
        setP2Time((t) => {
          const next = Math.max(0, t - 1);
          if (next <= 5 && next > 0 && (mode === 'pvp' || (mode === 'pve' && state.currentPlayer === humanSide))) {
            playSound('countdown');
          }
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.currentPlayer, state.status, hasClock, mode, humanSide]);

  // Reset relógio quando muda o turno — padrão "adjust state during render"
  const [lastPlayer, setLastPlayer] = useState(state.currentPlayer);
  if (hasClock && lastPlayer !== state.currentPlayer) {
    setLastPlayer(state.currentPlayer);
    if (state.currentPlayer === 'P1') setP1Time(timePerTurn);
    else setP2Time(timePerTurn);
  }

  // Timeout: jogada legal aleatória se o tempo acabar
  useEffect(() => {
    if (!hasClock || isGameOver(state) || mode === 'cvc') return;
    const isHumanTurn = mode === 'pve' || mode === 'practice' ? state.currentPlayer === humanSide : true;
    const timeLeft = state.currentPlayer === 'P1' ? p1Time : p2Time;
    if (timeLeft === 0 && isHumanTurn) {
      const legal = getLegalMoves(state, state.currentPlayer);
      if (legal.length > 0) {
        const random = legal[Math.floor(Math.random() * legal.length)];
        attemptMove(random.to);
      }
    }
  }, [p1Time, p2Time, hasClock, state, mode, humanSide, attemptMove]);

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (isGameOver(state)) return;
      if (mode === 'cvc') return;
      if ((mode === 'pve' || mode === 'practice') && state.currentPlayer !== humanSide) return;

      const cell = state.board[sq - 1];
      if (cell === state.currentPlayer) {
        // Selecionar peça
        selectSquare(sq);
      } else if (selectedSquare && validTargets.includes(sq)) {
        // Mover para destino
        attemptMove(sq);
      }
    },
    [state, mode, humanSide, selectedSquare, validTargets, selectSquare, attemptMove],
  );

  // Ameaças para destacar (modo tutorial)
  const threatSquares: Square[] = showThreats
    ? currentThreats.map((t) => t.to)
    : [];

  // Determinar se o tabuleiro deve estar flipped (peças do humano em baixo)
  const flipped = (mode === 'pve' || mode === 'practice') && humanSide === 'P2';

  const p1Label =
    mode === 'pve' || mode === 'practice'
      ? humanSide === 'P1' ? 'Tu' : `IA ${diffLabel(difficulty)}`
      : mode === 'cvc'
        ? `IA ${diffLabel(difficulty)} (P1)`
        : 'Jogador 1';
  const p2Label =
    mode === 'pve' || mode === 'practice'
      ? humanSide === 'P2' ? 'Tu' : `IA ${diffLabel(difficulty)}`
      : mode === 'cvc'
        ? `IA ${diffLabel(difficulty)} (P2)`
        : 'Jogador 2';

  const p1Active = state.currentPlayer === 'P1' && !isGameOver(state);
  const p2Active = state.currentPlayer === 'P2' && !isGameOver(state);

  const gameOver = isGameOver(state);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      {/* Padrão de fundo subtil */}
      <div className="pointer-events-none absolute inset-0 angolan-pattern opacity-30" />

      {/* Cabeçalho da partida */}
      <header className="relative z-10 px-4 py-3 border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            className="w-9 h-9 rounded-full bg-surface/60 flex items-center justify-center hover:bg-surface"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {mode === 'pvp' ? '2 Jogadores' : mode === 'pve' ? 'vs IA' : mode === 'practice' ? 'Treino Livre' : 'IA vs IA'}
              {mode !== 'pvp' && ` • ${diffLabel(difficulty)}`}
            </p>
            <p className="text-xs text-gold font-medium truncate">
              Partida #{moveCount} {showThreats && '• Tutorial'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('how-to-play')}
            className="w-9 h-9 rounded-full bg-surface/60 flex items-center justify-center hover:bg-surface"
            aria-label="Como jogar"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Área principal */}
      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-custom px-4 py-4">
        {/* Jogadores + relógios */}
        <div className="flex items-stretch gap-3 mb-5">
          <PlayerCard
            label={p1Label}
            emoji="🟢"
            active={p1Active}
            time={p1Time}
            showClock={hasClock}
            isHuman={mode === 'pve' || mode === 'practice' ? humanSide === 'P1' : mode !== 'cvc'}
            isP1
          />
          <div className="flex items-center justify-center px-1">
            <span className="font-display text-xl text-muted-foreground">VS</span>
          </div>
          <PlayerCard
            label={p2Label}
            emoji="🔴"
            active={p2Active}
            time={p2Time}
            showClock={hasClock}
            isHuman={mode === 'pve' || mode === 'practice' ? humanSide === 'P2' : mode !== 'cvc'}
            isP1={false}
          />
        </div>

        {/* Estado / mensagem */}
        <div className="text-center mb-4 min-h-[28px]">
          <AnimatePresence mode="wait">
            <motion.p
              key={state.status + moveCount}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className={cn(
                'text-sm font-medium',
                p1Active && 'text-p1',
                p2Active && 'text-p2',
                gameOver && 'text-gold',
                !p1Active && !p2Active && !gameOver && 'text-muted-foreground',
              )}
            >
              {getStatusMessage(state, mode, humanSide, isAiThinking, showThreats, currentThreats)}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Tabuleiro */}
        <div className="flex justify-center mb-5">
          <Board
            board={state.board}
            selectedSquare={selectedSquare}
            validTargets={validTargets}
            lastMove={lastMove}
            winningLine={winningLine}
            threatSquares={threatSquares}
            onSquareClick={handleSquareClick}
            flipped={flipped}
            disabled={mode === 'cvc' || ((mode === 'pve' || mode === 'practice') && state.currentPlayer !== humanSide)}
            size="md"
          />
        </div>

        {/* Contadores de jogadas */}
        <div className="flex justify-center gap-6 text-center mb-4">
          <div>
            <div className="font-display text-xl text-foreground">{moveCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Jogadas</div>
          </div>
          <div className="w-px bg-border/40" />
          <div>
            <div className="font-display text-xl text-gold">{state.history.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Histórico</div>
          </div>
          {showThreats && (
            <>
              <div className="w-px bg-border/40" />
              <div>
                <div className={cn('font-display text-xl', currentThreats.length > 0 ? 'text-p2' : 'text-muted-foreground')}>
                  {currentThreats.length}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase">Ameaças</div>
              </div>
            </>
          )}
        </div>

        {/* Ações */}
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
          <GameButton
            variant="outline"
            size="sm"
            className="h-10"
            onClick={undo}
            disabled={moveCount === 0 || mode === 'cvc' || gameOver}
          >
            <Undo2 className="w-4 h-4 mr-1" />
            Anular
          </GameButton>
          <GameButton
            variant="outline"
            size="sm"
            className="h-10"
            onClick={toggleThreats}
          >
            <Eye className="w-4 h-4 mr-1" />
            {showThreats ? 'Ocultar' : 'Ameaças'}
          </GameButton>
          <GameButton
            variant="outline"
            size="sm"
            className="h-10"
            onClick={restart}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reiniciar
          </GameButton>
        </div>

        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto mt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <GameButton variant="p2" size="sm" className="h-10" disabled={gameOver}>
                <Flag className="w-4 h-4 mr-1" />
                Desistir
              </GameButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desistir da partida?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vais perder a partida. Isto conta como derrota nas tuas estatísticas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    resign();
                  }}
                  className="bg-p2 text-white hover:bg-p2/90"
                >
                  Sim, desistir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <GameButton variant="outline" size="sm" className="h-10">
                <LogOut className="w-4 h-4 mr-1" />
                Sair
              </GameButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair da partida?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se saíres agora, a partida conta como derrota. Queres mesmo sair?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continuar a jogar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (!gameOver) resign();
                    back();
                  }}
                  className="bg-p2 text-white hover:bg-p2/90"
                >
                  Sair
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Overlay de fim de jogo */}
      <AnimatePresence>
        {gameOver && (
          <GameOverOverlay
            winner={winner}
            mode={mode}
            humanSide={humanSide}
            onRestart={restart}
            onExit={back}
            reduceMotion={reduceMotion}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerCard({
  label,
  emoji,
  active,
  time,
  showClock,
  isHuman,
  isP1,
}: {
  label: string;
  emoji: string;
  active: boolean;
  time: number;
  showClock: boolean;
  isHuman: boolean;
  isP1: boolean;
}) {
  const lowTime = time <= 10;
  return (
    <div
      className={cn(
        'flex-1 rounded-xl border p-2.5 transition-all',
        active
          ? isP1
            ? 'border-p1/60 bg-p1/10 shadow-lg shadow-p1/10'
            : 'border-p2/60 bg-p2/10 shadow-lg shadow-p2/10'
          : 'border-border/40 bg-surface/40',
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0',
            isP1 ? 'bg-gradient-to-br from-p1 to-emerald-700' : 'bg-gradient-to-br from-p2 to-red-900',
          )}
        >
          {isHuman ? '👤' : '🤖'}
        </div>
        <span className="text-xs font-semibold truncate">{label}</span>
        {active && (
          <span className="ml-auto">
            <span className={cn('w-2 h-2 rounded-full block', isP1 ? 'bg-p1' : 'bg-p2', 'animate-pulse-glow')} />
          </span>
        )}
      </div>
      {showClock ? (
        <div className="flex items-center gap-1">
          <Clock className={cn('w-3 h-3', lowTime ? 'text-p2' : 'text-muted-foreground')} />
          <span
            className={cn(
              'font-display text-lg leading-none',
              lowTime ? 'text-p2' : active ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {String(Math.floor(time / 60)).padStart(2, '0')}:
            {String(time % 60).padStart(2, '0')}
          </span>
          {active && (
            <span className="text-[9px] text-muted-foreground ml-auto uppercase">
              {isHuman ? 'Sua vez' : 'A pensar…'}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground italic">Sem relógio</span>
          {active && (
            <span className="text-[9px] text-muted-foreground ml-auto uppercase">
              {isHuman ? 'Sua vez' : 'A pensar…'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function GameOverOverlay({
  winner,
  mode,
  humanSide,
  onRestart,
  onExit,
  reduceMotion,
}: {
  winner: 'P1' | 'P2' | null;
  mode: 'pvp' | 'pve' | 'cvc' | 'practice';
  humanSide: 'P1' | 'P2';
  onRestart: () => void;
  onExit: () => void;
  reduceMotion: boolean;
}) {
  const isDraw = winner === null;
  const humanWon = (mode === 'pve' || mode === 'practice') && winner === humanSide;
  const humanLost = (mode === 'pve' || mode === 'practice') && winner && winner !== humanSide;

  const title = isDraw
    ? 'Empate!'
    : mode === 'pve' || mode === 'practice'
      ? humanWon
        ? 'Vitória!'
        : 'Derrota'
      : mode === 'cvc'
        ? `IA ${winner === 'P1' ? '1' : '2'} venceu!`
        : `Jogador ${winner === 'P1' ? '1' : '2'} venceu!`;

  const subtitle = isDraw
    ? 'A posição repetiu-se.'
    : mode === 'pve' || mode === 'practice'
      ? humanWon
        ? 'Venceste a IA. Parabéns!'
        : 'A IA foi mais forte. Tenta novamente!'
      : 'Linha de três completa!';

  const emoji = isDraw ? '🤝' : humanWon ? '🏆' : humanLost ? '😔' : winner === 'P1' ? '🟢' : '🔴';
  const color = isDraw
    ? 'text-muted-foreground'
    : humanWon || ((mode !== 'pve' && mode !== 'practice') && winner)
      ? 'text-gold'
      : 'text-p2';

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-6"
    >
      {/* Confetti apenas em vitória humana e sem reduceMotion */}
      {humanWon && !reduceMotion && <Confetti count={50} />}
      {/* Raios de vitória */}
      {!isDraw && !reduceMotion && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div
            className="w-96 h-96 rounded-full animate-victory-rays"
            style={{
              background: `conic-gradient(from 0deg, transparent, ${humanWon ? 'var(--p1)' : 'var(--p2)'} 20%, transparent 25%, ${humanWon ? 'var(--p1)' : 'var(--p2)'} 45%, transparent 50%, ${humanWon ? 'var(--p1)' : 'var(--p2)'} 70%, transparent 75%, ${humanWon ? 'var(--p1)' : 'var(--p2)'} 95%, transparent)`,
              opacity: 0.15,
            }}
          />
        </div>
      )}
      <motion.div
        initial={reduceMotion ? undefined : { scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm relative z-10"
      >
        <GameCard className="p-6 text-center" glow="gold">
          <motion.div
            initial={reduceMotion ? undefined : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
            className="text-6xl mb-3"
          >
            {emoji}
          </motion.div>
          <h2 className={cn('font-display text-4xl tracking-wide mb-1', color, humanWon && 'text-glow-gold')}>{title}</h2>
          <p className="text-sm text-muted-foreground mb-5">{subtitle}</p>

          {!isDraw && (
            <div className="flex justify-center gap-2 mb-5">
              <div className={cn(
                'w-12 h-12 rounded-full',
                winner === 'P1' ? 'bg-gradient-to-br from-p1 to-emerald-700 piece-glow-p1' : 'bg-gradient-to-br from-p2 to-red-900 piece-glow-p2',
              )} />
              <div className={cn(
                'w-12 h-12 rounded-full',
                winner === 'P2' ? 'bg-gradient-to-br from-p2 to-red-900 piece-glow-p2' : 'bg-surface-2 opacity-50',
              )} />
            </div>
          )}

          <div className="space-y-2">
            <GameButton variant="p1" className="w-full h-11" onClick={onRestart}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Jogar novamente
            </GameButton>
            <GameButton variant="outline" className="w-full h-11" onClick={onExit}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </GameButton>
          </div>
        </GameCard>
      </motion.div>
    </motion.div>
  );
}

function getStatusMessage(
  state: { status: string; currentPlayer: 'P1' | 'P2'; winner: 'P1' | 'P2' | null },
  mode: 'pvp' | 'pve' | 'cvc' | 'practice',
  humanSide: 'P1' | 'P2',
  isAiThinking: boolean,
  showThreats: boolean,
  currentThreats: { length: number; to: number }[],
): string {
  if (state.status === 'WIN_P1' || state.status === 'WIN_P2') {
    if (mode === 'pve' || mode === 'practice') {
      return state.winner === humanSide ? 'Venceste!' : 'A IA venceu!';
    }
    return `Jogador ${state.winner === 'P1' ? '1' : '2'} venceu!`;
  }
  if (state.status === 'DRAW') return 'Empate! A posição repetiu-se.';
  if (isAiThinking) return 'A IA está a pensar…';
  const isHumanTurn = mode === 'pve' || mode === 'practice' ? state.currentPlayer === humanSide : true;
  if (isHumanTurn) {
    if (showThreats && currentThreats.length > 0) {
      return '⚠️ Ameaça do adversário! Bloqueia!';
    }
    return 'A tua vez. Escolhe uma peça.';
  }
  return 'Vez do adversário…';
}

function diffLabel(d: string): string {
  return d === 'easy' ? 'Fácil' : d === 'medium' ? 'Média' : d === 'hard' ? 'Difícil' : 'Perfeita';
}
