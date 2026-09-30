'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Clock,
  Check,
  X,
  SkipForward,
  Trophy,
  Play,
  RefreshCw,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useProfile } from '@/store/profile';
import { useLightning, type LightningResult } from '@/store/lightning';
import { PUZZLES, type Puzzle } from '@/lib/puzzles';
import { getLegalMoves, getWinningMoves, applyMove, type Square, type Move, type Cell, type GameState, DEFAULT_CONFIG } from '@/lib/engine';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard, LevelAvatar, SectionTitle } from '@/components/game/ui';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';

type Phase = 'intro' | 'playing' | 'finished';

function makeState(board: Cell[]): GameState {
  return {
    board,
    currentPlayer: 'P1',
    status: 'PLAYER_1_TURN',
    winner: null,
    winningLine: null,
    moveCount: 0,
    history: [],
    positionCounts: {},
    config: DEFAULT_CONFIG,
  };
}

export function LightningChallengeScreen() {
  const navigate = useApp((s) => s.navigate);
  const addCoins = useProfile((s) => s.addCoins);
  const recordRun = useLightning((s) => s.recordRun);
  const bestTime = useLightning((s) => s.bestTimeSec);
  const bestSolved = useLightning((s) => s.bestSolved);
  const totalRuns = useLightning((s) => s.totalRuns);

  // Selecionar 5 puzzles (aleatórios, embaralhados)
  const [runPuzzles] = useState<Puzzle[]>(() => {
    const shuffled = [...PUZZLES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  });

  const [phase, setPhase] = useState<Phase>('intro');
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [currentState, setCurrentState] = useState<GameState>(() =>
    makeState(runPuzzles[0].board),
  );
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validTargets, setValidTargets] = useState<Square[]>([]);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [results, setResults] = useState<{ id: string; solved: boolean; timeSec: number }[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [puzzleStartTime, setPuzzleStartTime] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cronómetro total
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime]);

  const currentPuzzle = runPuzzles[puzzleIndex];
  const puzzleElapsed = Math.floor((Date.now() - puzzleStartTime) / 1000);

  const startRun = () => {
    setPhase('playing');
    setPuzzleIndex(0);
    setResults([]);
    setStartTime(Date.now());
    setPuzzleStartTime(Date.now());
    setElapsed(0);
    setCurrentState(makeState(runPuzzles[0].board));
    setSelectedSquare(null);
    setValidTargets([]);
    setFeedback('none');
    setShowHint(false);
    playSound('start');
  };

  const nextPuzzle = useCallback(
    (solved: boolean, skipped: boolean) => {
      const timeSec = Math.floor((Date.now() - puzzleStartTime) / 1000);
      const newResults = [...results, { id: currentPuzzle.id, solved, timeSec }];
      setResults(newResults);

      if (solved) {
        playSound('achievement');
        addCoins(100);
      }

      if (puzzleIndex + 1 >= runPuzzles.length) {
        // Fim do run
        const totalTimeSec = Math.floor((Date.now() - startTime) / 1000);
        const result: LightningResult = {
          date: new Date().toISOString(),
          totalTimeSec,
          solved: newResults.filter((r) => r.solved).length,
          skipped: newResults.filter((r) => !r.solved).length,
          puzzles: newResults.map((r) => ({ id: r.id, solved: r.solved, timeSec: r.timeSec })),
        };
        recordRun(result);
        // Bónus por completar todos
        if (result.solved === 5) {
          addCoins(500);
          playSound('win');
        }
        setPhase('finished');
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        // Próximo puzzle
        setPuzzleIndex(puzzleIndex + 1);
        setCurrentState(makeState(runPuzzles[puzzleIndex + 1].board));
        setSelectedSquare(null);
        setValidTargets([]);
        setFeedback('none');
        setShowHint(false);
        setPuzzleStartTime(Date.now());
        if (!solved && !skipped) {
          // erro: pequena pausa antes de avançar
        }
      }
    },
    [puzzleIndex, puzzleStartTime, results, startTime, runPuzzles, currentPuzzle, recordRun, addCoins],
  );

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (feedback !== 'none') return;
      const piece = currentState.board[sq - 1];
      if (piece === 'P1') {
        const legal = getLegalMoves(currentState, 'P1');
        const targets = legal.filter((m) => m.from === sq).map((m) => m.to);
        setSelectedSquare(sq);
        setValidTargets(targets);
        playSound('select');
      } else if (selectedSquare && validTargets.includes(sq)) {
        const move: Move = { from: selectedSquare, to: sq };
        // Verificar se é a solução (mate-in-1)
        const wins = getWinningMoves(currentState, 'P1');
        const isWin = wins.some((m) => m.from === move.from && m.to === move.to);
        if (isWin) {
          const { state: newState } = applyMove(currentState, move);
          setCurrentState(newState);
          setSelectedSquare(null);
          setValidTargets([]);
          setFeedback('correct');
          playSound('win');
          setTimeout(() => {
            setFeedback('none');
            nextPuzzle(true, false);
          }, 800);
        } else {
          // Para mate-in-2, verificar se é a primeira jogada correta
          if (currentPuzzle.mateIn === 2) {
            const isCorrectFirst =
              move.from === currentPuzzle.solution.from &&
              move.to === currentPuzzle.solution.to;
            if (isCorrectFirst) {
              const { state: newState } = applyMove(currentState, move);
              setCurrentState(newState);
              setSelectedSquare(null);
              setValidTargets([]);
              setFeedback('correct');
              playSound('move');
              // Simular resposta da IA e esperar pela vitória
              setTimeout(() => {
                // A IA joga perfeitamente (qualquer resposta perde)
                // Para o puzzle, basta o jogador ter feito a jogada correta → resolvido
                setFeedback('none');
                nextPuzzle(true, false);
              }, 1200);
              return;
            }
          }
          // Errado
          setFeedback('wrong');
          playSound('error');
          setTimeout(() => {
            setFeedback('none');
            setSelectedSquare(null);
            setValidTargets([]);
          }, 1000);
        }
      }
    },
    [feedback, currentState, selectedSquare, validTargets, currentPuzzle, nextPuzzle],
  );

  const skipPuzzle = () => {
    playSound('click');
    nextPuzzle(false, true);
  };

  // ============ INTRO ============
  if (phase === 'intro') {
    return (
      <div className="space-y-5 animate-slide-up pb-4">
        <GameCard className="p-6 text-center" glow="gold">
          <div className="w-16 h-16 rounded-2xl bg-gold/15 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-gold" />
          </div>
          <h2 className="font-display text-3xl tracking-wide mb-2">DESAFIO RELÂMPAGO</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
            Resolve 5 puzzles o mais rápido que conseguires. Cada vitória vale 100 KZ.
            Completa todos e ganha 500 KZ extra!
          </p>

          {/* Recorde */}
          {bestTime !== null && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div>
                <div className="font-display text-2xl text-gold">{formatTime(bestTime)}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Melhor tempo</div>
              </div>
              <div>
                <div className="font-display text-2xl text-p1">{bestSolved}/5</div>
                <div className="text-[10px] text-muted-foreground uppercase">Melhor resultado</div>
              </div>
              <div>
                <div className="font-display text-2xl text-foreground">{totalRuns}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Tentativas</div>
              </div>
            </div>
          )}

          <GameButton variant="gold" className="w-full h-12" onClick={startRun}>
            <Play className="w-4 h-4 mr-2" />
            COMEÇAR DESAFIO
          </GameButton>
        </GameCard>

        <GameCard className="p-4">
          <SectionTitle title="Como funciona" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>⚡ 5 puzzles aleatórios (mate-in-1 e mate-in-2)</p>
            <p>⏱️ Cronómetro total — quanto mais rápido, melhor</p>
            <p>💰 +100 KZ por puzzle resolvido, +500 KZ bónus por completar todos</p>
            <p>⏭️ Podes saltar um puzzle (não conta como resolvido)</p>
            <p>❌ Jogada errada → volta a tentar (sem penalização de tempo)</p>
          </div>
        </GameCard>

        <GameButton variant="outline" className="w-full" onClick={() => navigate('challenge')}>
          Ver Desafio Diário
          <ChevronRight className="w-4 h-4 ml-1" />
        </GameButton>
      </div>
    );
  }

  // ============ FINISHED ============
  if (phase === 'finished') {
    const solvedCount = results.filter((r) => r.solved).length;
    const totalTime = results.reduce((s, r) => s + r.timeSec, 0);
    const isPerfect = solvedCount === 5;
    const newRecord = bestTime !== null && totalTime < bestTime && solvedCount === 5;

    return (
      <div className="space-y-5 animate-slide-up pb-4">
        <GameCard className="p-6 text-center" glow={isPerfect ? 'gold' : null}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="text-6xl mb-3"
          >
            {isPerfect ? '🏆' : solvedCount >= 3 ? '🥈' : '🎯'}
          </motion.div>
          <h2 className="font-display text-3xl tracking-wide mb-1">
            {isPerfect ? 'PERFEITO!' : `${solvedCount}/5 resolvidos`}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tempo total: <span className="text-gold font-display">{formatTime(totalTime)}</span>
          </p>

          {newRecord && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-p1 font-semibold mb-4 animate-pulse-glow"
            >
              ⚡ NOVO RECORDE PESSOAL!
            </motion.p>
          )}

          {/* Resultados por puzzle */}
          <div className="space-y-1.5 mb-6 text-left">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-surface/40">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                  r.solved ? 'bg-p1/15 text-p1' : 'bg-p2/15 text-p2',
                )}>
                  {r.solved ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </div>
                <span className="text-xs text-muted-foreground">Puzzle {i + 1}</span>
                <span className="text-xs text-foreground ml-auto">{r.timeSec}s</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <GameButton variant="gold" className="w-full" onClick={startRun}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </GameButton>
            <GameButton variant="outline" className="w-full" onClick={() => navigate('home')}>
              Voltar ao início
            </GameButton>
          </div>
        </GameCard>
      </div>
    );
  }

  // ============ PLAYING ============
  return (
    <div className="space-y-4 animate-slide-up pb-4">
      {/* Cabeçalho com cronómetro e progresso */}
      <GameCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Puzzle {puzzleIndex + 1} de {runPuzzles.length}
            </p>
            <p className="font-display text-2xl text-gold">{formatTime(elapsed)}</p>
          </div>
          <div className="flex gap-1.5">
            {runPuzzles.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-8 rounded-full transition-all',
                  i < puzzleIndex ? 'bg-p1' :
                  i === puzzleIndex ? 'bg-gold animate-pulse-glow' :
                  'bg-surface-2',
                )}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {currentPuzzle.title} • {currentPuzzle.difficulty} • Vitória em {currentPuzzle.mateIn}
          </span>
          <span className="text-xs text-gold font-mono">
            ⏱️ {puzzleElapsed}s
          </span>
        </div>
      </GameCard>

      {/* Mensagem de estado */}
      <div className="text-center min-h-[24px]">
        <AnimatePresence mode="wait">
          <motion.p
            key={feedback + puzzleIndex}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={cn(
              'text-sm font-medium',
              feedback === 'correct' && 'text-p1',
              feedback === 'wrong' && 'text-p2',
              feedback === 'none' && 'text-muted-foreground',
            )}
          >
            {feedback === 'correct'
              ? '✅ Resolvido!'
              : feedback === 'wrong'
                ? '❌ Tenta outra vez!'
                : currentPuzzle.mateIn === 2
                  ? 'Encontra a jogada que leva à vitória forçada'
                  : 'Encontra a jogada vencedora!'}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Tabuleiro */}
      <div className="flex justify-center">
        <div className="relative">
          <Board
            board={currentState.board}
            selectedSquare={selectedSquare}
            validTargets={validTargets}
            lastMove={currentState.history.length > 0 ? currentState.history[currentState.history.length - 1] : null}
            winningLine={null}
            threatSquares={[]}
            onSquareClick={handleSquareClick}
            disabled={feedback !== 'none'}
            size="md"
          />
          {feedback === 'correct' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-2xl"
            >
              <Check className="w-16 h-16 text-p1" strokeWidth={3} />
            </motion.div>
          )}
          {feedback === 'wrong' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-p2/20 backdrop-blur-sm rounded-2xl pointer-events-none"
            >
              <X className="w-16 h-16 text-p2" strokeWidth={3} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-2 max-w-md mx-auto w-full">
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
          onClick={skipPuzzle}
        >
          <SkipForward className="w-4 h-4 mr-2" />
          Saltar
        </GameButton>
      </div>

      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden max-w-md mx-auto w-full"
          >
            <GameCard className="p-4 bg-gold/5 border-gold/30">
              <div className="flex gap-3">
                <Lightbulb className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{currentPuzzle.hint}</p>
              </div>
            </GameCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
