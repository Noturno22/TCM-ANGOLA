'use client';

import { useState, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useChallenge } from '@/store/challenge';
import { useProfile } from '@/store/profile';
import { getTodayPuzzle, getPuzzleByIndex, PUZZLES, type Puzzle } from '@/lib/puzzles';
import { applyMove, getLegalMoves, getWinningMoves, isGameOver, type Square, type Move } from '@/lib/engine';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard, LevelAvatar, SectionTitle } from '@/components/game/ui';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';

type PuzzleState = 'idle' | 'correct' | 'wrong';

export function ChallengeScreen() {
  const navigate = useApp((s) => s.navigate);
  const markSolved = useChallenge((s) => s.markSolved);
  const recordAttempt = useChallenge((s) => s.recordAttempt);
  const isSolved = useChallenge((s) => s.isSolved);
  const totalSolved = useChallenge((s) => s.totalSolved);
  const addCoins = useProfile((s) => s.addCoins);

  const todayPuzzle = useMemo(() => getTodayPuzzle(), []);
  const isTodaySolved = isSolved(todayPuzzle.id);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validTargets, setValidTargets] = useState<Square[]>([]);
  const [result, setResult] = useState<PuzzleState>('idle');
  const [showHint, setShowHint] = useState(false);
  const [wrongMove, setWrongMove] = useState<Move | null>(null);

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (result === 'correct') return;
      const piece = todayPuzzle.board[sq - 1];
      if (piece === 'P1') {
        // Selecionar peça
        const state = {
          board: todayPuzzle.board,
          currentPlayer: 'P1' as const,
          status: 'PLAYER_1_TURN' as const,
          winner: null,
          winningLine: null,
          moveCount: 0,
          history: [],
          positionCounts: {},
          config: {
            movementMode: 'free-blocked' as const,
            firstPlayer: 'P1' as const,
            homeLineCounts: true,
            repetitionLimit: 3,
            maxPlies: null,
            noMovesOutcome: 'lose' as const,
          },
        };
        const legal = getLegalMoves(state, 'P1');
        const targets = legal.filter((m) => m.from === sq).map((m) => m.to);
        setSelectedSquare(sq);
        setValidTargets(targets);
        playSound('select');
      } else if (selectedSquare && validTargets.includes(sq)) {
        // Tentar mover
        const move: Move = { from: selectedSquare, to: sq };
        recordAttempt();
        const isCorrect =
          move.from === todayPuzzle.solution.from &&
          move.to === todayPuzzle.solution.to;
        if (isCorrect) {
          setResult('correct');
          markSolved(todayPuzzle.id);
          addCoins(200); // recompensa por resolver
          playSound('win');
          // Atualizar o tabuleiro para mostrar a vitória
          setSelectedSquare(null);
          setValidTargets([]);
        } else {
          setResult('wrong');
          setWrongMove(move);
          playSound('error');
          setTimeout(() => {
            setResult('idle');
            setWrongMove(null);
            setSelectedSquare(null);
            setValidTargets([]);
          }, 1500);
        }
      }
    },
    [result, selectedSquare, validTargets, todayPuzzle, markSolved, recordAttempt, addCoins],
  );

  // Tabuleiro para mostrar: ou a posição inicial do puzzle, ou a posição após a jogada correta
  const displayBoard = useMemo(() => {
    if (result === 'correct') {
      // Mostrar o tabuleiro resolvido
      const board = [...todayPuzzle.board];
      const fromIdx = todayPuzzle.solution.from - 1;
      const toIdx = todayPuzzle.solution.to - 1;
      board[fromIdx] = null;
      board[toIdx] = 'P1';
      return board;
    }
    if (result === 'wrong' && wrongMove) {
      // Mostrar a jogada errada brevemente
      const board = [...todayPuzzle.board];
      const fromIdx = wrongMove.from - 1;
      const toIdx = wrongMove.to - 1;
      board[fromIdx] = null;
      board[toIdx] = 'P1';
      return board;
    }
    return todayPuzzle.board;
  }, [result, todayPuzzle, wrongMove]);

  const winningLine = useMemo(() => {
    if (result !== 'correct') return null;
    // Encontrar a linha vencedora após a jogada correta
    const state = {
      board: displayBoard,
      currentPlayer: 'P1' as const,
      status: 'WIN_P1' as const,
      winner: 'P1' as const,
      winningLine: null as readonly number[] | null,
      moveCount: 1,
      history: [],
      positionCounts: {},
      config: {
        movementMode: 'free-blocked' as const,
        firstPlayer: 'P1' as const,
        homeLineCounts: true,
        repetitionLimit: 3,
        maxPlies: null,
        noMovesOutcome: 'lose' as const,
      },
    };
    // Verificar as linhas
    for (const line of [
      [1, 2, 3], [4, 5, 6], [7, 8, 9],
      [1, 4, 7], [2, 5, 8], [3, 6, 9],
      [1, 5, 9], [3, 5, 7],
    ] as const) {
      if (line.every((s) => displayBoard[s - 1] === 'P1')) return line;
    }
    return null;
  }, [result, displayBoard]);

  const reset = () => {
    setResult('idle');
    setSelectedSquare(null);
    setValidTargets([]);
    setWrongMove(null);
    setShowHint(false);
  };

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
              Desafio de hoje
            </p>
          </div>
        </div>
      </GameCard>

      {/* Descrição */}
      <div className="text-center px-2">
        <p className="text-sm text-foreground">{todayPuzzle.description}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Vence em {todayPuzzle.mateIn} jogada. És o Jogador 1 (verde).
        </p>
      </div>

      {/* Tabuleiro do puzzle */}
      <div className="flex justify-center">
        <div className="relative">
          <Board
            board={displayBoard}
            selectedSquare={selectedSquare}
            validTargets={validTargets}
            lastMove={wrongMove}
            winningLine={winningLine}
            threatSquares={[]}
            onSquareClick={handleSquareClick}
            disabled={result === 'correct'}
            size="md"
          />
          {/* Overlay de sucesso */}
          <AnimatePresence>
            {result === 'correct' && (
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
                  <p className="text-xs text-gold mt-1">+200 KZ de recompensa</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Overlay de erro */}
          <AnimatePresence>
            {result === 'wrong' && (
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
        {result !== 'correct' && (
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
          {showHint && result !== 'correct' && (
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

        {result === 'correct' && (
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

        {(selectedSquare || result === 'wrong') && result !== 'correct' && (
          <GameButton variant="ghost" size="sm" className="w-full" onClick={reset}>
            Limpar seleção
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

      {/* Lista de todos os puzzles (para treinar) */}
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
        {solved ? '✅' : '🧩'}
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
        <p className="text-[10px] text-muted-foreground">{puzzle.difficulty} • Vitória em {puzzle.mateIn}</p>
      </div>
      {solved && <Trophy className="w-4 h-4 text-gold" />}
    </GameCard>
  );
}
