'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  Play,
  Pause,
  SkipForward,
  RefreshCw,
  MessageCircle,
  Bot,
  Cpu,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { createGame, applyMove, getWinningMoves, getLegalMoves, isGameOver, type GameState, type Move } from '@/lib/engine';
import { chooseMove, type Difficulty } from '@/lib/ai';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { playSound } from '@/lib/sound';
import { commentOnMove, commentOnStart, type Commentary } from '@/lib/commentary';
import { cn } from '@/lib/utils';

type Phase = 'intro' | 'playing' | 'finished';

interface ChatMessage {
  id: number;
  commentary: Commentary;
  moveNum: number;
}

export function WatchScreen() {
  const navigate = useApp((s) => s.navigate);

  const [phase, setPhase] = useState<Phase>('intro');
  const [difficulty1, setDifficulty1] = useState<Difficulty>('medium');
  const [difficulty2, setDifficulty2] = useState<Difficulty>('hard');
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');

  const [state, setState] = useState<GameState>(() => createGame());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [playing, setPlaying] = useState(false);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const msgIdRef = useRef(0);
  const prevMoveRef = useRef<Move | null>(null);
  const stateRef = useRef<GameState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const speedMs = speed === 'slow' ? 2000 : speed === 'fast' ? 600 : 1200;

  // Adicionar mensagem
  const addMessage = useCallback((commentary: Commentary, moveNum: number) => {
    msgIdRef.current += 1;
    setMessages((prev) => [...prev.slice(-15), { id: msgIdRef.current, commentary, moveNum }]);
  }, []);

  // Fazer uma jogada da IA
  const makeAiMove = useCallback(() => {
    const currentState = stateRef.current;
    if (isGameOver(currentState)) {
      setPlaying(false);
      setPhase('finished');
      return;
    }
    const player = currentState.currentPlayer;
    const diff = player === 'P1' ? difficulty1 : difficulty2;
    const seed = (Date.now() + currentState.moveCount * 7919) | 0;
    const move = chooseMove(currentState, diff, seed);
    if (!move) {
      setPlaying(false);
      setPhase('finished');
      return;
    }
    const prevState = currentState;
    try {
      const { state: newState } = applyMove(currentState, move);
      setState(newState);
      setLastMove(move);
      const commentary = commentOnMove(prevState, move, newState, newState.moveCount);
      addMessage(commentary, newState.moveCount);
      // Sons
      if (newState.winner) {
        playSound('win');
      } else if (commentary.type === 'threat') {
        playSound('threat');
      } else {
        playSound('move');
      }
    } catch {
      setPlaying(false);
      setPhase('finished');
    }
  }, [difficulty1, difficulty2, addMessage]);

  // Auto-play loop (não chama setState no corpo do effect)
  useEffect(() => {
    if (phase !== 'playing' || !playing) return;
    if (isGameOver(state)) return;
    const timer = setTimeout(() => {
      makeAiMove();
    }, speedMs);
    return () => clearTimeout(timer);
  }, [phase, playing, state, speedMs, makeAiMove]);

  // Quando o jogo termina, parar o play e mudar de fase — padrão "adjust state during render"
  if (phase === 'playing' && isGameOver(state)) {
    setPlaying(false);
    setPhase('finished');
  }

  const startWatch = () => {
    const newState = createGame();
    setState(newState);
    setMessages([{ id: 0, commentary: commentOnStart(), moveNum: 0 }]);
    setLastMove(null);
    setPhase('playing');
    setPlaying(true);
    playSound('start');
  };

  const togglePause = () => {
    setPlaying((p) => !p);
    playSound('click');
  };

  const stepForward = () => {
    if (!isGameOver(state)) {
      makeAiMove();
    }
    playSound('click');
  };

  const reset = () => {
    const newState = createGame();
    setState(newState);
    setMessages([{ id: 0, commentary: commentOnStart(), moveNum: 0 }]);
    setLastMove(null);
    setPlaying(false);
    setPhase('playing');
    playSound('start');
  };

  const goIntro = () => {
    setPhase('intro');
    setPlaying(false);
    setState(createGame());
    setMessages([]);
    setLastMove(null);
  };

  // ============ INTRO ============
  if (phase === 'intro') {
    return (
      <div className="space-y-5 animate-slide-up pb-4">
        <GameCard className="p-6 text-center" glow="gold">
          <div className="w-16 h-16 rounded-2xl bg-gold/15 flex items-center justify-center mx-auto mb-4">
            <Eye className="w-8 h-8 text-gold" />
          </div>
          <h2 className="font-display text-3xl tracking-wide mb-2">ASSISTIR</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
            Observa duas IAs a competir com comentário ao vivo. Aprende estratégias vendo os mestres a jogar.
          </p>

          {/* Configuração das IAs */}
          <div className="space-y-4 text-left mb-6">
            <div>
              <h3 className="font-display text-lg mb-2 text-center">🟢 Jogador 1</h3>
              <div className="grid grid-cols-2 gap-2">
                {(['easy', 'medium', 'hard', 'perfect'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty1(d)}
                    className={cn(
                      'p-2.5 rounded-lg border text-sm transition-all',
                      difficulty1 === d ? 'border-p1 bg-p1/10 text-p1 font-semibold' : 'border-border/40 text-muted-foreground',
                    )}
                  >
                    {diffLabel(d)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-display text-lg mb-2 text-center">🔴 Jogador 2</h3>
              <div className="grid grid-cols-2 gap-2">
                {(['easy', 'medium', 'hard', 'perfect'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty2(d)}
                    className={cn(
                      'p-2.5 rounded-lg border text-sm transition-all',
                      difficulty2 === d ? 'border-p2 bg-p2/10 text-p2 font-semibold' : 'border-border/40 text-muted-foreground',
                    )}
                  >
                    {diffLabel(d)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-display text-lg mb-2 text-center">Velocidade</h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'slow' as const, label: 'Lenta', emoji: '🐢' },
                  { id: 'normal' as const, label: 'Normal', emoji: '🚶' },
                  { id: 'fast' as const, label: 'Rápida', emoji: '⚡' },
                ]).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSpeed(s.id)}
                    className={cn(
                      'p-2.5 rounded-lg border text-center transition-all',
                      speed === s.id ? 'border-gold bg-gold/10' : 'border-border/40',
                    )}
                  >
                    <div className="text-lg">{s.emoji}</div>
                    <div className={cn('text-[10px] font-medium', speed === s.id && 'text-gold')}>{s.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <GameButton variant="gold" className="w-full h-12" onClick={startWatch}>
            <Play className="w-4 h-4 mr-2" />
            COMEÇAR A ASSISTIR
          </GameButton>
        </GameCard>
      </div>
    );
  }

  // ============ PLAYING / FINISHED ============
  const gameOver = isGameOver(state);

  return (
    <div className="space-y-4 animate-slide-up pb-4">
      {/* Cabeçalho */}
      <GameCard className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🟢</span>
            <span className="text-xs font-semibold">{diffLabel(difficulty1)}</span>
            <span className="text-[10px] text-muted-foreground">vs</span>
            <span className="text-lg">🔴</span>
            <span className="text-xs font-semibold">{diffLabel(difficulty2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Jogada {state.moveCount}</span>
            {state.currentPlayer === 'P1' ? (
              <span className="w-2 h-2 rounded-full bg-p1 animate-pulse-glow" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-p2 animate-pulse-glow" />
            )}
          </div>
        </div>
      </GameCard>

      {/* Tabuleiro + Chat lado a lado (em desktop) ou empilhados (mobile) */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Tabuleiro */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Board
              board={state.board}
              selectedSquare={null}
              validTargets={[]}
              lastMove={lastMove}
              winningLine={state.winningLine}
              threatSquares={[]}
              onSquareClick={() => {}}
              disabled
              size="md"
            />
            {gameOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-2xl"
              >
                <div className="text-center">
                  <div className="text-5xl mb-2">
                    {state.winner === 'P1' ? '🟢' : state.winner === 'P2' ? '🔴' : '🤝'}
                  </div>
                  <h3 className="font-display text-2xl text-gold">
                    {state.winner ? `${state.winner === 'P1' ? 'Jogador 1' : 'Jogador 2'} vence!` : 'Empate!'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{state.moveCount} jogadas</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Controlos */}
          <div className="flex gap-2 mt-4 w-full max-w-xs">
            {!gameOver && (
              <GameButton
                variant={playing ? 'outline' : 'p1'}
                size="sm"
                className="flex-1"
                onClick={togglePause}
              >
                {playing ? (
                  <>
                    <Pause className="w-4 h-4 mr-1" />
                    Pausa
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Continuar
                  </>
                )}
              </GameButton>
            )}
            {!gameOver && !playing && (
              <GameButton variant="outline" size="sm" className="flex-1" onClick={stepForward}>
                <SkipForward className="w-4 h-4 mr-1" />
                Passo
              </GameButton>
            )}
            <GameButton variant="outline" size="sm" className="flex-1" onClick={reset}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Reiniciar
            </GameButton>
          </div>
        </div>

        {/* Chat de comentário */}
        <GameCard className="p-3 flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/40">
            <MessageCircle className="w-4 h-4 text-gold" />
            <h3 className="font-display text-sm tracking-wide">Comentário ao vivo</h3>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-custom space-y-2">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    'p-2 rounded-lg text-xs',
                    msg.commentary.type === 'win' && 'bg-gold/15 border border-gold/30',
                    msg.commentary.type === 'threat' && 'bg-p2/10 border border-p2/30',
                    msg.commentary.type === 'good' && 'bg-p1/10',
                    msg.commentary.type === 'bad' && 'bg-p2/10',
                    msg.commentary.type === 'neutral' && 'bg-surface-2/40',
                    msg.commentary.type === 'info' && 'bg-surface-2/40',
                  )}
                >
                  {msg.moveNum > 0 && (
                    <span className="text-[9px] text-muted-foreground mr-1.5 font-mono">
                      #{msg.moveNum}
                    </span>
                  )}
                  <span className="text-foreground">{msg.commentary.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </GameCard>
      </div>

      {/* Ações finais */}
      {gameOver && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <GameButton variant="p1" className="w-full" onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Ver outra partida
          </GameButton>
          <GameButton variant="outline" className="w-full" onClick={goIntro}>
            Mudar configuração
            <ChevronRight className="w-4 h-4 ml-1" />
          </GameButton>
        </motion.div>
      )}
    </div>
  );
}

function diffLabel(d: Difficulty): string {
  return d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : d === 'hard' ? 'Difícil' : 'Perfeito';
}
