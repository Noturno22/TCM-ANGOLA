'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, RefreshCw, ChevronRight, Trophy, Frown, Target } from 'lucide-react';
import { useApp } from '@/store/app';
import { useGame } from '@/store/game';
import { useTournament } from '@/store/tournament';
import { getEntrant } from '@/lib/tournament';
import { isGameOver, type Square } from '@tira/engine';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard } from '@/components/game/ui';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';

type ResultType = 'success' | 'failure' | null;

export function TournamentPlayScreen() {
  const navigate = useApp((s) => s.navigate);
  const back = useApp((s) => s.back);
  const tournamentMatchId = useApp((s) => s.tournamentMatchId);
  const bracket = useTournament((s) => s.bracket);
  const advance = useTournament((s) => s.advance);

  const match = useMemo(
    () => (bracket && tournamentMatchId ? bracket.matches[tournamentMatchId] ?? null : null),
    [bracket, tournamentMatchId],
  );
  const p1 = useMemo(() => getEntrant(bracket, match?.p1Id), [bracket, match]);
  const p2 = useMemo(() => getEntrant(bracket, match?.p2Id), [bracket, match]);

  const humanSide: 'P1' | 'P2' = p1?.isHuman ? 'P1' : 'P2';

  const game = useGame();

  const [result, setResult] = useState<ResultType>(null);
  const [resultComputed, setResultComputed] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const matchId = match?.id ?? null;

  // Inicia a partida ao montar / mudar de partida. Usa getState() para o
  // efeito não depender do snapshot completo da store (evita reexecuções).
  useEffect(() => {
    if (!matchId || !match || match.winnerId) return;
    useGame.getState().startGame({
      mode: 'pve',
      difficulty: 'medium',
      humanSide,
      showThreats: true,
      timePerTurn: 0,
    });
    Promise.resolve().then(() => setGameStarted(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, humanSide]);

  // Avalia o resultado quando o jogo termina (ajuste de estado durante render).
  const gameEnded = isGameOver(game.state);
  if (gameEnded && match && gameStarted && !resultComputed) {
    setResultComputed(true);
    const humanWon = game.state.winner === humanSide;
    if (humanWon) {
      setResult('success');
      advance(match.id, 'human');
      playSound('win');
    } else {
      setResult('failure');
      const oppId = humanSide === 'P1' ? match.p2Id : match.p1Id;
      if (oppId) advance(match.id, oppId);
      playSound('error');
    }
  }

  const handleSquareClick = useCallback(
    (sq: Square) => {
      const g = useGame.getState();
      if (isGameOver(g.state)) return;
      if (g.state.currentPlayer !== g.humanSide) return;
      const cell = g.state.board[sq - 1];
      if (cell === g.state.currentPlayer) {
        g.selectSquare(sq);
      } else if (g.selectedSquare && g.validTargets.includes(sq)) {
        g.attemptMove(sq);
      }
    },
    [],
  );

  const handleRestart = useCallback(() => {
    setResult(null);
    setResultComputed(false);
    setGameStarted(false);
    useGame.getState().startGame({
      mode: 'pve',
      difficulty: 'medium',
      humanSide,
      showThreats: true,
      timePerTurn: 0,
    });
    Promise.resolve().then(() => setGameStarted(true));
  }, [humanSide]);

  if (!match || !bracket) {
    return (
      <div className="space-y-5 animate-slide-up pb-4">
        <GameCard className="p-8 text-center">
          <Flag className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">Nenhuma partida selecionada.</p>
          <GameButton variant="p1" onClick={() => navigate('tournament')}>
            Voltar ao Torneio
          </GameButton>
        </GameCard>
      </div>
    );
  }

  const oppName = humanSide === 'P1' ? p2?.name : p1?.name;
  const roundLabel =
    match.round === 3 ? 'Final' : match.round === 2 ? 'Meias-finais' : '1/4 Final';

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0 angolan-pattern opacity-30" />
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
              Torneio • {roundLabel}
            </p>
            <p className="text-xs text-gold font-medium truncate">Tu vs {oppName}</p>
          </div>
          <div className="w-9 h-9" />
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-custom px-4 py-4">
        <GameCard className="p-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-gold/15 text-gold">
              <Target className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Partida</p>
              <p className="text-sm font-medium">Vence para passar à ronda seguinte</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Jogadas</p>
              <p className="font-display text-lg">{game.moveCount}</p>
            </div>
          </div>
        </GameCard>

        <div className="flex justify-center mb-4">
          <Board
            board={game.state.board}
            selectedSquare={game.selectedSquare}
            validTargets={game.validTargets}
            lastMove={game.lastMove}
            winningLine={game.winningLine}
            threatSquares={[]}
            onSquareClick={handleSquareClick}
            disabled={game.state.currentPlayer !== game.humanSide}
            size="md"
          />
        </div>

        <div className="flex gap-2 max-w-md mx-auto">
          <GameButton variant="p2" className="flex-1" onClick={handleRestart}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reiniciar
          </GameButton>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-background/95 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-[420px] my-auto"
            >
              <GameCard
                className={cn(
                  'p-5 text-center',
                  result === 'success' ? 'border-p1/40' : 'border-p2/40',
                )}
                glow={result === 'success' ? 'gold' : null}
              >
                <div className="flex items-center gap-3 mb-3 text-left">
                  <div
                    className={cn(
                      'w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center',
                      result === 'success' ? 'bg-gold/15 text-gold' : 'bg-p2/15 text-p2',
                    )}
                  >
                    {result === 'success' ? (
                      <Trophy className="w-7 h-7" />
                    ) : (
                      <Frown className="w-7 h-7" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2
                      className={cn(
                        'font-display text-3xl leading-none tracking-wide',
                        result === 'success' ? 'text-p1 text-glow-gold' : 'text-p2',
                      )}
                    >
                      {result === 'success' ? 'GANHASTE!' : 'PERDESTE'}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {result === 'success'
                        ? 'Avanças na chave do torneio'
                        : 'O teu adversário avança'}
                    </p>
                  </div>
                </div>

                {/* Tabuleiro REAL da posição final */}
                <div className="rounded-xl border border-border/60 bg-surface-2/60 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    {game.winningLine && game.winningLine.length === 3
                      ? 'Como foi a vitória'
                      : 'Posição final'}
                  </p>
                  <div className="flex justify-center">
                    <Board
                      board={game.state.board}
                      selectedSquare={null}
                      validTargets={[]}
                      lastMove={game.lastMove}
                      winningLine={game.winningLine}
                      threatSquares={[]}
                      onSquareClick={() => undefined}
                      disabled
                      size="sm"
                    />
                  </div>
                </div>

                <p className="mt-3 mb-4 text-xs text-muted-foreground">
                  {game.lastMove
                    ? `Última jogada: casa ${game.lastMove.from} → casa ${game.lastMove.to}`
                    : 'Nenhuma linha foi completada.'}
                </p>

                <GameButton variant="p1" className="w-full" onClick={() => navigate('tournament')}>
                  Voltar ao Torneio
                </GameButton>
              </GameCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
