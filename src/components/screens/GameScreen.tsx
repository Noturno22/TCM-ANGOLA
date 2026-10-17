'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  LogOut,
  Flag,
  MessageCircle,
  Clock,
  ChevronLeft,
  Undo2,
  Eye,
  User,
  Bot,
  Handshake,
  Trophy,
  Frown,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import { isGameOver, type Square, type Threat, type Move, type Cell } from '@tira/engine';
import { playSound } from '@/lib/sound';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard } from '@/components/game/ui';
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
    forfeit,
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
  }, [state, mode, humanSide, hasClock]);

  // Reset relógio quando muda o turno — padrão "adjust state during render"
  const [lastPlayer, setLastPlayer] = useState(state.currentPlayer);
  if (hasClock && lastPlayer !== state.currentPlayer) {
    setLastPlayer(state.currentPlayer);
    if (state.currentPlayer === 'P1') setP1Time(timePerTurn);
    else setP2Time(timePerTurn);
  }

  useEffect(() => {
    if (!hasClock || isGameOver(state) || mode === 'cvc') return;
    const timeLeft = state.currentPlayer === 'P1' ? p1Time : p2Time;
    if (timeLeft === 0) {
      forfeit(state.currentPlayer);
    }
  }, [p1Time, p2Time, hasClock, state, mode, forfeit]);

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

  const handleExit = () => {
    if (!isGameOver(state) && mode !== 'cvc') {
      forfeit(humanSide);
    }
    back();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      {/* Padrão de fundo subtil */}
      <div className="pointer-events-none absolute inset-0 angolan-pattern opacity-30" />

      {/* Cabeçalho da partida */}
      <header className="relative z-10 px-4 py-3 border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleExit}
            className="w-9 h-9 rounded-full bg-surface/60 flex items-center justify-center hover:bg-surface"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
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
            disabled={mode === 'cvc' || ((mode === 'pve' || mode === 'practice') && state.currentPlayer !== humanSide)}
            size="md"
          />
        </div>

        {/* Contadores de jogadas */}
        <div className="flex justify-center gap-6 text-center mb-4">
          <div>
            <div className="font-display text-xl text-foreground">{moveCount}</div>
            <div className="text-xs text-muted-foreground uppercase">Jogadas</div>
          </div>
          <div className="w-px bg-border/40" />
          <div>
            <div className="font-display text-xl text-gold">{state.history.length}</div>
            <div className="text-xs text-muted-foreground uppercase">Histórico</div>
          </div>
          {showThreats && (
            <>
              <div className="w-px bg-border/40" />
              <div>
                <div className={cn('font-display text-xl', currentThreats.length > 0 ? 'text-p2' : 'text-muted-foreground')}>
                  {currentThreats.length}
                </div>
                <div className="text-xs text-muted-foreground uppercase">Ameaças</div>
              </div>
            </>
          )}
        </div>

        {/* Ações */}
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
          <GameButton
            variant="outline"
            className="h-10 text-xs px-3"
            onClick={undo}
            disabled={moveCount === 0 || mode === 'cvc' || gameOver}
          >
            <Undo2 className="w-4 h-4 mr-1" />
            Anular
          </GameButton>
          <GameButton
            variant="outline"
            className="h-10 text-xs px-3"
            onClick={toggleThreats}
          >
            <Eye className="w-4 h-4 mr-1" />
            {showThreats ? 'Ocultar' : 'Ameaças'}
          </GameButton>
          <GameButton
            variant="outline"
            className="h-10 text-xs px-3"
            onClick={restart}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reiniciar
          </GameButton>
        </div>

        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto mt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <GameButton variant="p2" className="h-10 text-xs px-3" disabled={gameOver}>
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
              <GameButton variant="outline" className="h-10 text-xs px-3">
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
            board={state.board}
            winningLine={winningLine}
            lastMove={lastMove}
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
  active,
  time,
  showClock,
  isHuman,
  isP1,
}: {
  label: string;
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
            'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white',
            isP1 ? 'bg-p1' : 'bg-p2',
          )}
        >
          {isHuman ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
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
            <span className="text-[11px] text-muted-foreground ml-auto uppercase">
              {isHuman ? 'Sua vez' : 'A pensar…'}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground italic">Sem relógio</span>
          {active && (
            <span className="text-[11px] text-muted-foreground ml-auto uppercase">
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
  board,
  winningLine,
  lastMove,
  onRestart,
  onExit,
  reduceMotion,
}: {
  winner: 'P1' | 'P2' | null;
  mode: 'pvp' | 'pve' | 'cvc' | 'practice';
  humanSide: 'P1' | 'P2';
  board: readonly Cell[];
  winningLine: readonly number[] | null;
  lastMove: Move | null;
  onRestart: () => void;
  onExit: () => void;
  reduceMotion: boolean;
}) {
  const isDraw = winner === null;
  const humanWon = (mode === 'pve' || mode === 'practice') && winner === humanSide;
  const humanLost = (mode === 'pve' || mode === 'practice') && winner && winner !== humanSide;

  // Vitória/derrota com linha vencedora (vitória "natural"). Quando `winningLine`
  // é nulo, a partida terminou por desistência, tempo esgotado ou desistência.
  const naturalWin = winner !== null && winningLine !== null && winningLine.length === 3;

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
    : naturalWin
      ? mode === 'pve' || mode === 'practice'
        ? humanWon
          ? 'Venceste a IA. Parabéns!'
          : 'A IA foi mais forte. Tenta novamente!'
        : 'Linha de três completa!'
      : 'A partida terminou sem linha vencedora.';

  const ResultIcon = isDraw ? Handshake : humanWon ? Trophy : humanLost ? Frown : Trophy;
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
      className="absolute inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-background/95 backdrop-blur-sm p-4"
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
        className="w-full max-w-[420px] relative z-10 my-auto"
      >
        <GameCard className="p-5 text-center" glow={isDraw || humanLost ? null : 'gold'}>
          <motion.div
            initial={reduceMotion ? undefined : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
            className="flex items-center gap-3 mb-3 text-left"
          >
            <div
              className={cn(
                'w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center',
                isDraw
                  ? 'bg-surface-2 text-muted-foreground'
                  : humanLost
                    ? 'bg-p2/15 text-p2'
                    : 'bg-gold/15 text-gold',
              )}
            >
              <ResultIcon className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h2
                className={cn(
                  'font-display text-3xl leading-none tracking-wide',
                  color,
                  humanWon && 'text-glow-gold',
                )}
              >
                {title}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </div>
          </motion.div>

          {/* Tabuleiro REAL da posição final — o mesmo que se jogou */}
          <div className="rounded-xl border border-border/60 bg-surface-2/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              {winner && winningLine && winningLine.length === 3
                ? 'Como foi a vitória'
                : 'Posição final'}
            </p>
            <div className="flex justify-center">
              <Board
                board={board}
                selectedSquare={null}
                validTargets={[]}
                lastMove={lastMove}
                winningLine={winningLine}
                threatSquares={[]}
                onSquareClick={() => undefined}
                disabled
                size="sm"
              />
            </div>
          </div>

          <div className="mt-3 mb-4 text-xs text-muted-foreground space-y-0.5">
            {winner && winningLine && winningLine.length === 3 ? (
              <p>
                Como venceu:{' '}
                <span className="text-foreground font-medium">{describeLine(winningLine)}</span>
                {lastMove && (
                  <span className="block mt-0.5">
                    Jogada final: casa {lastMove.from} → casa {lastMove.to}
                  </span>
                )}
              </p>
            ) : (
              <p>
                {lastMove
                  ? `Última jogada: casa ${lastMove.from} → casa ${lastMove.to}. `
                  : ''}
                {isDraw
                  ? 'Nenhuma linha foi completada — a posição repetiu-se.'
                  : 'Nenhuma linha foi completada.'}
              </p>
            )}
          </div>

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

const LINE_LABELS: Record<string, string> = {
  '1,2,3': 'linha de baixo',
  '4,5,6': 'linha do meio',
  '7,8,9': 'linha de cima',
  '1,4,7': 'coluna da esquerda',
  '2,5,8': 'coluna do meio',
  '3,6,9': 'coluna da direita',
  '1,5,9': 'diagonal principal',
  '3,5,7': 'diagonal secundária',
};

function describeLine(line: readonly number[]): string {
  const key = [...line].sort((a, b) => a - b).join(',');
  return LINE_LABELS[key] ?? 'linha vencedora';
}

function getStatusMessage(
  state: { status: string; currentPlayer: 'P1' | 'P2'; winner: 'P1' | 'P2' | null },
  mode: 'pvp' | 'pve' | 'cvc' | 'practice',
  humanSide: 'P1' | 'P2',
  isAiThinking: boolean,
  showThreats: boolean,
  currentThreats: Threat[],
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
      return 'Ameaça do adversário! Bloqueia!';
    }
    return 'A tua vez. Escolhe uma peça.';
  }
  return 'Vez do adversário…';
}

function diffLabel(d: string): string {
  return d === 'easy' ? 'Fácil' : d === 'medium' ? 'Média' : d === 'hard' ? 'Difícil' : 'Perfeita';
}
