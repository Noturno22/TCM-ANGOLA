'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Check,
  X,
  RefreshCw,
  Trophy,
  Calendar,
  Target,
  ChevronRight,
  Loader2,
  Zap,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useChallenge } from '@/store/challenge';
import { useProfile } from '@/store/profile';
import { getTodayPuzzle, getPuzzleByIndex, PUZZLES, type Puzzle } from '@/lib/puzzles';
import { applyMove, getLegalMoves, getWinningMoves, isGameOver, type Square, type Move, type Cell, type GameState, DEFAULT_CONFIG } from '@/lib/engine';
import { chooseMove } from '@/lib/ai';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard, LevelAvatar, SectionTitle } from '@/components/game/ui';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';

type Phase = 'first-move' | 'awaiting-ia' | 'second-move' | 'solved' | 'wrong';

function makePuzzleState(board: Cell[], player: 'P1' | 'P2' = 'P1'): GameState {
  return {
    board,
    currentPlayer: player,
    status: player === 'P1' ? 'PLAYER_1_TURN' : 'PLAYER_2_TURN',
    winner: null,
    winningLine: null,
    moveCount: 0,
    history: [],
    positionCounts: {},
    config: DEFAULT_CONFIG,
  };
}

export function ChallengeScreen() {
  const navigate = useApp((s) => s.navigate);
  const markSolved = useChallenge((s) => s.markSolved);
  const recordAttempt = useChallenge((s) => s.recordAttempt);
  const isSolved = useChallenge((s) => s.isSolved);
  const totalSolved = useChallenge((s) => s.totalSolved);
  const addCoins = useProfile((s) => s.addCoins);

  const todayPuzzle = useMemo(() => getTodayPuzzle(), []);
  const isTodaySolved = isSolved(todayPuzzle.id);

  // Estado do puzzle (evolui conforme o jogador joga)
  const [currentState, setCurrentState] = useState<GameState>(() =>
    makePuzzleState(todayPuzzle.board, 'P1'),
  );
  const [phase, setPhase] = useState<Phase>('first-move');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validTargets, setValidTargets] = useState<Square[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [wrongMove, setWrongMove] = useState<Move | null>(null);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [prevPuzzleId, setPrevPuzzleId] = useState(todayPuzzle.id);

  // Reset quando o puzzle muda (padrão "adjust state during render" do React)
  if (prevPuzzleId !== todayPuzzle.id) {
    setPrevPuzzleId(todayPuzzle.id);
    setCurrentState(makePuzzleState(todayPuzzle.board, 'P1'));
    setPhase('first-move');
    setSelectedSquare(null);
    setValidTargets([]);
    setWrongMove(null);
    setWrongFlash(false);
    setShowHint(false);
  }

  const isMate2 = todayPuzzle.mateIn === 2;

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (phase === 'solved' || phase === 'awaiting-ia' || phase === 'wrong') return;

      const piece = currentState.board[sq - 1];
      if (piece === 'P1') {
        // Selecionar peça
        const legal = getLegalMoves(currentState, 'P1');
        const targets = legal.filter((m) => m.from === sq).map((m) => m.to);
        setSelectedSquare(sq);
        setValidTargets(targets);
        playSound('select');
      } else if (selectedSquare && validTargets.includes(sq)) {
        // Tentar mover
        const move: Move = { from: selectedSquare, to: sq };
        recordAttempt();

        if (phase === 'first-move') {
          const isCorrectFirst =
            move.from === todayPuzzle.solution.from &&
            move.to === todayPuzzle.solution.to;
          if (isCorrectFirst) {
            // Jogada correta!
            const { state: newState } = applyMove(currentState, move);
            setCurrentState(newState);
            setSelectedSquare(null);
            setValidTargets([]);
            playSound('move');
            if (isMate2) {
              // Mate-in-2: a IA responde, depois o jogador encontra a vitória
              setPhase('awaiting-ia');
            } else {
              // Mate-in-1: resolvido!
              setPhase('solved');
              markSolved(todayPuzzle.id);
              addCoins(200);
              playSound('achievement');
            }
          } else {
            // Jogada errada
            setPhase('wrong');
            setWrongMove(move);
            setWrongFlash(true);
            playSound('error');
            setTimeout(() => {
              setWrongFlash(false);
              setWrongMove(null);
              setSelectedSquare(null);
              setValidTargets([]);
              setPhase('first-move');
            }, 1500);
          }
        } else if (phase === 'second-move') {
          // Mate-in-2, segunda jogada: deve ser uma jogada vencedora
          const wins = getWinningMoves(currentState, 'P1');
          const isWin = wins.some((m) => m.from === move.from && m.to === move.to);
          if (isWin) {
            const { state: newState } = applyMove(currentState, move);
            setCurrentState(newState);
            setSelectedSquare(null);
            setValidTargets([]);
            playSound('win');
            setPhase('solved');
            markSolved(todayPuzzle.id);
            addCoins(400);
            playSound('achievement');
          } else {
            // Jogada errada (continua em second-move)
            setPhase('wrong');
            setWrongMove(move);
            setWrongFlash(true);
            playSound('error');
            setTimeout(() => {
              setWrongFlash(false);
              setWrongMove(null);
              setSelectedSquare(null);
              setValidTargets([]);
              setPhase('second-move');
            }, 1500);
          }
        }
      }
    },
    [phase, selectedSquare, validTargets, currentState, todayPuzzle, isMate2, recordAttempt, markSolved, addCoins],
  );

  // IA responde (para mate-in-2)
  useEffect(() => {
    if (phase !== 'awaiting-ia') return;
    const timer = setTimeout(() => {
      // A IA joga o melhor movimento (perfeito, para garantir que o puzzle funciona)
      const iaMove = chooseMove(currentState, 'perfect', Date.now());
      if (iaMove) {
        const { state: newState } = applyMove(currentState, iaMove);
        setCurrentState(newState);
        playSound('move');
        // Verificar se ainda há jogadas vencedoras para o jogador
        const wins = getWinningMoves(newState, 'P1');
        if (wins.length > 0) {
          setPhase('second-move');
        } else {
          // Algo correu mal (não deveria acontecer com puzzles verificados)
          setPhase('first-move');
        }
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [phase, currentState]);

  // Tabuleiro a mostrar (pode incluir jogada errada brevemente)
  const displayBoard = useMemo(() => {
    if (wrongFlash && wrongMove) {
      const board = [...currentState.board];
      board[wrongMove.from - 1] = null;
      board[wrongMove.to - 1] = 'P1';
      return board;
    }
    return currentState.board;
  }, [wrongFlash, wrongMove, currentState.board]);

  // Linha vencedora (quando resolvido)
  const winningLine = useMemo(() => {
    if (phase !== 'solved') return null;
    for (const line of [
      [1, 2, 3], [4, 5, 6], [7, 8, 9],
      [1, 4, 7], [2, 5, 8], [3, 6, 9],
      [1, 5, 9], [3, 5, 7],
    ] as const) {
      if (line.every((s) => displayBoard[s - 1] === 'P1')) return line;
    }
    return null;
  }, [phase, displayBoard]);

  const reset = () => {
    setCurrentState(makePuzzleState(todayPuzzle.board, 'P1'));
    setPhase('first-move');
    setSelectedSquare(null);
    setValidTargets([]);
    setWrongMove(null);
    setWrongFlash(false);
    setShowHint(false);
  };

  const statusMessage = useMemo(() => {
    if (phase === 'solved') return 'Resolvido! 🎉';
    if (phase === 'awaiting-ia') return 'A IA está a responder…';
    if (phase === 'second-move') return 'Encontra a jogada vencedora! ⚡';
    if (phase === 'wrong') return 'Tenta outra vez!';
    if (isMate2) return 'Faz a primeira jogada para vencer em 2!';
    return 'Faz a jogada vencedora!';
  }, [phase, isMate2]);

  return (
    <div className="space-y-5 animate-slide-up pb-4">
      {/* Cabeçalho do desafio */}
      <GameCard className="p-5" glow="gold">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
            <Target className="w-7 h-7 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider',
                todayPuzzle.difficulty === 'Fácil' && 'bg-p1/15 text-p1',
                todayPuzzle.difficulty === 'Médio' && 'bg-gold/15 text-gold',
                todayPuzzle.difficulty === 'Difícil' && 'bg-p2/15 text-p2',
              )}>
                {todayPuzzle.difficulty}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider bg-surface-2 text-muted-foreground">
                Vitória em {todayPuzzle.mateIn}
              </span>
              {isTodaySolved && (
                <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider bg-p1/15 text-p1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Resolvido
                </span>
              )}
            </div>
            <h2 className="font-display text-2xl tracking-wide leading-tight">
              {todayPuzzle.title}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Desafio de hoje • +{isMate2 ? 400 : 200} KZ
            </p>
          </div>
        </div>
      </GameCard>

      {/* Descrição + estado */}
      <div className="text-center px-2">
        <p className="text-sm text-foreground">{todayPuzzle.description}</p>
        <p className={cn(
          'text-sm font-medium mt-2 transition-colors',
          phase === 'solved' && 'text-p1',
          phase === 'wrong' && 'text-p2',
          (phase === 'first-move' || phase === 'second-move' || phase === 'awaiting-ia') && 'text-gold',
        )}>
          {statusMessage}
        </p>
      </div>

      {/* Tabuleiro do puzzle */}
      <div className="flex justify-center">
        <div className="relative">
          <Board
            board={displayBoard}
            selectedSquare={selectedSquare}
            validTargets={validTargets}
            lastMove={currentState.history.length > 0 ? currentState.history[currentState.history.length - 1] : wrongMove}
            winningLine={winningLine}
            threatSquares={[]}
            onSquareClick={handleSquareClick}
            disabled={phase === 'solved' || phase === 'awaiting-ia' || phase === 'wrong'}
            size="md"
          />
          {/* Overlay de sucesso */}
          <AnimatePresence>
            {phase === 'solved' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-2xl"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-p1/20 flex items-center justify-center mx-auto mb-3"
                  >
                    <Check className="w-12 h-12 text-p1" strokeWidth={3} />
                  </motion.div>
                  <h3 className="font-display text-2xl text-p1">Resolvido!</h3>
                  <p className="text-xs text-gold mt-1">+{isMate2 ? 400 : 200} KZ de recompensa</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Overlay de IA a pensar */}
          <AnimatePresence>
            {phase === 'awaiting-ia' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm rounded-2xl pointer-events-none"
              >
                <div className="flex items-center gap-2 text-gold">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">A IA responde…</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Overlay de erro */}
          <AnimatePresence>
            {phase === 'wrong' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-p2/20 backdrop-blur-sm rounded-2xl pointer-events-none"
              >
                <div className="text-center">
                  <X className="w-16 h-16 text-p2 mx-auto mb-2" strokeWidth={3} />
                  <h3 className="font-display text-xl text-p2">Tenta outra vez!</h3>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-2 max-w-md mx-auto w-full">
        {phase !== 'solved' && phase !== 'awaiting-ia' && (
          <GameButton
            variant="outline"
            className="w-full"
            onClick={() => setShowHint((v) => !v)}
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            {showHint ? 'Ocultar dica' : 'Ver dica'}
          </GameButton>
        )}
        <AnimatePresence>
          {showHint && phase !== 'solved' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <GameCard className="p-4 bg-gold/5 border-gold/30">
                <div className="flex gap-3">
                  <Lightbulb className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{todayPuzzle.hint}</p>
                </div>
              </GameCard>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'solved' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <GameButton variant="p1" className="w-full" onClick={reset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Resolver novamente
            </GameButton>
            <GameButton variant="outline" className="w-full" onClick={() => navigate('offline-select')}>
              Jogar partida normal
              <ChevronRight className="w-4 h-4 ml-1" />
            </GameButton>
          </motion.div>
        )}

        {phase !== 'solved' && (selectedSquare || phase === 'wrong') && (
          <GameButton variant="ghost" size="sm" className="w-full" onClick={reset}>
            Reiniciar puzzle
          </GameButton>
        )}
      </div>

      {/* Estatísticas de puzzles */}
      <GameCard className="p-4">
        <SectionTitle title="O teu desempenho" />
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="font-display text-2xl text-gold">{totalSolved}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Resolvidos</div>
          </div>
          <div>
            <div className="font-display text-2xl text-foreground">{PUZZLES.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Total</div>
          </div>
          <div>
            <div className="font-display text-2xl text-p1">
              {Math.round((totalSolved / PUZZLES.length) * 100)}%
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">Progresso</div>
          </div>
        </div>
      </GameCard>

      {/* Desafio Relâmpago */}
      <button
        type="button"
        onClick={() => navigate('lightning')}
        className="w-full text-left rounded-2xl overflow-hidden bg-gradient-to-r from-orange/20 via-gold/15 to-orange/20 border-2 border-orange/40 p-4 hover:border-orange/60 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Zap className="w-6 h-6 text-orange" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] uppercase tracking-wider text-orange font-semibold">
                Desafio Relâmpago
              </span>
            </div>
            <h3 className="font-display text-lg leading-tight">5 PUZZLES CRONOMETRADOS</h3>
            <p className="text-[10px] text-muted-foreground">
              Resolve 5 puzzles o mais rápido possível • +500 KZ bónus
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-orange/15 flex items-center justify-center group-hover:bg-orange/30 transition-colors">
            <ChevronRight className="w-4 h-4 text-orange" />
          </div>
        </div>
      </button>

      {/* Lista de todos os puzzles */}
      <div>
        <SectionTitle title="Todos os desafios" />
        <div className="space-y-2">
          {PUZZLES.map((p, i) => (
            <PuzzleRow
              key={p.id}
              puzzle={p}
              solved={isSolved(p.id)}
              isToday={p.id === todayPuzzle.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PuzzleRow({
  puzzle,
  solved,
  isToday,
}: {
  puzzle: Puzzle;
  solved: boolean;
  isToday: boolean;
}) {
  return (
    <GameCard
      className={cn(
        'p-3 flex items-center gap-3',
        solved && 'opacity-70',
        isToday && 'ring-1 ring-gold/40',
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0',
        solved ? 'bg-p1/15' : 'bg-surface-2',
      )}>
        {solved ? '✅' : puzzle.mateIn === 2 ? '🧩' : '🎯'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold truncate">{puzzle.title}</h4>
          {isToday && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/15 text-gold font-semibold uppercase">
              Hoje
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {puzzle.difficulty} • Vitória em {puzzle.mateIn}
        </p>
      </div>
      {solved && <Trophy className="w-4 h-4 text-gold" />}
    </GameCard>
  );
}
