'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  RefreshCw,
  Trophy,
  Frown,
  Clock,
  Wifi,
  Loader2,
  Handshake,
  Flag,
  Coins,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';
import { useMatch } from '@/store/match';
import { getLegalMoves, isGameOver, type Square } from '@tira/engine';
import {
  matchToGameState,
  potForStake,
  sideForUser,
  timeLeftSeconds,
} from '@/lib/online/match';
import { fetchProfiles } from '@/lib/online/rooms';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard } from '@/components/game/ui';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';

export function OnlineMatchScreen() {
  const navigate = useApp((s) => s.navigate);
  const uid = useAuth((s) => s.user?.id ?? null);

  const match = useMatch((s) => s.match);
  const queued = useMatch((s) => s.queued);
  const queuedStake = useMatch((s) => s.queuedStake);
  const loading = useMatch((s) => s.loading);
  const error = useMatch((s) => s.error);
  const roomId = useMatch((s) => s.roomId);
  const playMove = useMatch((s) => s.playMove);
  const resign = useMatch((s) => s.resign);
  const claimTimeout = useMatch((s) => s.claimTimeout);
  const cancelQueue = useMatch((s) => s.cancelQueue);
  const loadActiveMatch = useMatch((s) => s.loadActiveMatch);
  const leave = useMatch((s) => s.leave);
  const origin = useMatch((s) => s.origin);

  const [selected, setSelected] = useState<Square | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [oppName, setOppName] = useState<string | null>(null);
  const timeoutClaimed = useRef<string | null>(null);

  // Tenta retomar uma partida ativa que exista.
  useEffect(() => {
    if (!match && !queued) void loadActiveMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Relógio local (a verdade é o servidor).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Nome do adversário.
  useEffect(() => {
    if (!match || !uid) return;
    const oppId = match.p1Id === uid ? match.p2Id : match.p1Id;
    let cancelled = false;
    void fetchProfiles([oppId]).then((map) => {
      if (!cancelled) setOppName(map[oppId]?.username ?? 'Adversário');
    });
    return () => {
      cancelled = true;
    };
  }, [match, uid]);

  const state = useMemo(() => (match ? matchToGameState(match) : null), [match]);
  const mySide = match ? sideForUser(match, uid) : null;
  const turnSide = match?.turn ?? null;
  const isMyTurn = Boolean(state && mySide && turnSide === mySide && !isGameOver(state));

  const validTargets = useMemo<Square[]>(() => {
    if (!state || !selected || !isMyTurn) return [];
    return getLegalMoves(state)
      .filter((m) => m.from === selected)
      .map((m) => m.to);
  }, [state, selected, isMyTurn]);

  const timeLeft = match ? timeLeftSeconds(match, now) : 0;
  const clockRunning = Boolean(match && match.status === 'active' && match.timePerTurn > 0);

  // Reclama vitória por expiração do relógio do adversário.
  useEffect(() => {
    if (!match || match.status !== 'active' || !mySide) return;
    if (match.turn === mySide) return;
    if (timeLeft > 0) return;
    if (timeoutClaimed.current === match.id) return;
    timeoutClaimed.current = match.id;
    void claimTimeout();
  }, [match, mySide, timeLeft, claimTimeout]);

  // Efeitos sonoros de fim.
  useEffect(() => {
    if (!match || match.status !== 'finished' || !mySide) return;
    if (match.winner === mySide) playSound('win');
    else if (match.winner === 'draw') playSound('draw');
    else playSound('error');
  }, [match, mySide]);

  const handleSquareClick = (sq: Square) => {
    if (!state || !mySide || !isMyTurn) return;
    if (state.board[sq - 1] === mySide) {
      setSelected(sq);
    } else if (selected && validTargets.includes(sq)) {
      void playMove(selected, sq);
      setSelected(null);
    }
  };

  const handleLeave = () => {
    leave();
    navigate(origin === 'tournament' ? 'tournament' : 'rooms');
  };

  // ------------------------------- Estados -------------------------------

  if (loading && !match) {
    return (
      <CenteredCard icon={<Loader2 className="w-8 h-8 text-gold animate-spin" />} title="A carregar…">
        <p className="text-sm text-muted-foreground">A procurar a tua partida.</p>
      </CenteredCard>
    );
  }

  if (queued && !match) {
    return (
      <CenteredCard
        icon={<Loader2 className="w-8 h-8 text-gold animate-spin" />}
        title="À procura de adversário…"
      >
        <p className="text-sm text-muted-foreground mb-1">
          Sala: <span className="text-foreground font-medium">{roomId ?? '—'}</span>
        </p>
        {queuedStake > 0 && (
          <p className="text-xs text-gold font-semibold mb-3 flex items-center justify-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            Aposta retida: {queuedStake} KZ · Pot {potForStake(queuedStake)} KZ
          </p>
        )}
        <p className="text-xs text-muted-foreground mb-5">
          Vais entrar numa partida assim que houver um jogador disponível.
        </p>
        <GameButton variant="outline" className="w-full" onClick={() => void cancelQueue().then(handleLeave)}>
          Cancelar
        </GameButton>
      </CenteredCard>
    );
  }

  if (!match || !state || !mySide) {
    const insufficient = error === 'not_enough_coins';
    return (
      <CenteredCard
        icon={
          insufficient ? (
            <Coins className="w-8 h-8 text-gold" />
          ) : (
            <Wifi className="w-8 h-8 text-muted-foreground" />
          )
        }
        title={insufficient ? 'Moedas insuficientes' : 'Sem partida online'}
      >
        <p className="text-sm text-muted-foreground mb-5">
          {insufficient
            ? 'Não tens KZ virtuais suficientes para esta aposta.'
            : error
              ? 'Ocorreu um erro a iniciar a partida.'
              : 'Entra numa sala para jogar online.'}
        </p>
        {insufficient && (
          <GameButton
            variant="gold"
            className="w-full mb-2"
            onClick={() => {
              leave();
              navigate('wallet');
            }}
          >
            <Coins className="w-4 h-4 mr-2" />
            Ver carteira
          </GameButton>
        )}
        <GameButton variant="p1" className="w-full" onClick={handleLeave}>
          {origin === 'tournament' ? 'Voltar ao Torneio' : 'Voltar às Salas'}
        </GameButton>
      </CenteredCard>
    );
  }

  const finished = match.status === 'finished';
  const iWon = finished && match.winner === mySide;
  const draw = finished && match.winner === 'draw';

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0 angolan-pattern opacity-30" />

      <header className="relative z-10 px-4 py-3 border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleLeave}
            className="w-12 h-12 rounded-full bg-surface/60 flex items-center justify-center hover:bg-surface"
            aria-label="Sair"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="text-center flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-p1 animate-pulse" />
              Online • {match.roomId}
            </p>
            <p className="text-xs font-medium truncate">Tu vs {oppName ?? '…'}</p>
          </div>
          <div className="w-12 h-12" />
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-custom px-4 py-4">
        {/* Placar + relógio */}
        <GameCard className="p-3 mb-4">
          <div className="flex items-center justify-between">
            <SideBadge
              label="Tu"
              active={isMyTurn}
              highlight={mySide === 'P1' ? 'p1' : 'p2'}
            />
            <div className="text-center">
              {clockRunning ? (
                <span
                  className={cn(
                    'font-display text-2xl flex items-center gap-1.5',
                    timeLeft <= 10 ? 'text-p2' : 'text-foreground',
                  )}
                >
                  <Clock className="w-4 h-4" />
                  {timeLeft}s
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Jogadas: {match.moveCount}</span>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isMyTurn ? 'Tua vez' : finished ? 'Terminado' : 'Vez do adversário'}
              </p>
            </div>
            <SideBadge
              label={oppName ?? 'Adversário'}
              active={turnSide !== mySide && !finished}
              highlight={mySide === 'P1' ? 'p2' : 'p1'}
            />
          </div>
          {match.stake > 0 && (
            <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-center gap-1.5 text-[11px] text-gold font-semibold">
              <Coins className="w-3.5 h-3.5" />
              Aposta {match.stake} KZ · Pot {potForStake(match.stake)} KZ
            </div>
          )}
        </GameCard>

        {/* Tabuleiro */}
        <div className="flex justify-center mb-4">
          <Board
            board={state.board}
            selectedSquare={selected}
            validTargets={validTargets}
            lastMove={null}
            winningLine={state.winningLine}
            threatSquares={[]}
            onSquareClick={handleSquareClick}
            disabled={!isMyTurn}
            size="md"
          />
        </div>

        <div className="flex gap-2 max-w-md mx-auto">
          <GameButton
            variant="p2"
            className="flex-1"
            onClick={() => void resign()}
            disabled={finished}
          >
            <Flag className="w-4 h-4 mr-2" />
            Desistir
          </GameButton>
          <GameButton variant="outline" className="flex-1" onClick={handleLeave}>
            Sair
          </GameButton>
        </div>
      </div>

      {/* Overlay de resultado */}
      <AnimatePresence>
        {finished && (
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
                className={cn('p-5 text-center', iWon ? 'border-p1/40' : draw ? 'border-gold/40' : 'border-p2/40')}
                glow={iWon ? 'gold' : null}
              >
                <div className="flex items-center gap-3 mb-3 text-left">
                  <div
                    className={cn(
                      'w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center',
                      iWon ? 'bg-gold/15 text-gold' : draw ? 'bg-gold/15 text-gold' : 'bg-p2/15 text-p2',
                    )}
                  >
                    {iWon ? (
                      <Trophy className="w-7 h-7" />
                    ) : draw ? (
                      <Handshake className="w-7 h-7" />
                    ) : (
                      <Frown className="w-7 h-7" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2
                      className={cn(
                        'font-display text-3xl leading-none tracking-wide',
                        iWon ? 'text-p1 text-glow-gold' : draw ? 'text-gold' : 'text-p2',
                      )}
                    >
                      {iWon ? 'GANHASTE!' : draw ? 'EMPATE' : 'PERDESTE'}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {iWon ? 'Vitória online registada.' : draw ? 'Ninguém cedeu.' : 'Tenta outra vez.'}
                    </p>
                  </div>
                </div>

                {/* Tabuleiro REAL da posição final */}
                <div className="rounded-xl border border-border/60 bg-surface-2/60 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    {state.winningLine && state.winningLine.length === 3 ? 'Como foi a vitória' : 'Posição final'}
                  </p>
                  <div className="flex justify-center">
                    <Board
                      board={state.board}
                      selectedSquare={null}
                      validTargets={[]}
                      lastMove={null}
                      winningLine={state.winningLine}
                      threatSquares={[]}
                      onSquareClick={() => undefined}
                      disabled
                      size="sm"
                    />
                  </div>
                </div>

                {match.stake > 0 && (
                  <p
                    className={cn(
                      'text-sm font-semibold mt-3 mb-1 flex items-center justify-center gap-1.5',
                      iWon ? 'text-p1' : draw ? 'text-gold' : 'text-p2',
                    )}
                  >
                    <Coins className="w-4 h-4" />
                    {iWon
                      ? `+${match.stake} KZ ganhos`
                      : draw
                        ? 'Aposta devolvida'
                        : `−${match.stake} KZ perdidos`}
                  </p>
                )}
                <GameButton variant="p1" className="w-full mt-3" onClick={handleLeave}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Jogar outra vez
                </GameButton>
              </GameCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CenteredCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5 animate-slide-up pb-4 pt-8">
      <GameCard className="p-8 text-center">
        <div className="flex justify-center mb-3">{icon}</div>
        <h2 className="font-display text-xl tracking-wide mb-3">{title}</h2>
        {children}
      </GameCard>
    </div>
  );
}

function SideBadge({
  label,
  active,
  highlight,
}: {
  label: string;
  active: boolean;
  highlight: 'p1' | 'p2';
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 px-2 min-w-0 max-w-[30%]',
        active && 'scale-105 transition-transform',
      )}
    >
      <span
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
          highlight === 'p1' ? 'bg-p1 text-background' : 'bg-p2 text-background',
          active && 'ring-2 ring-gold',
        )}
      >
        {label.slice(0, 1).toUpperCase()}
      </span>
      <span className="text-[10px] truncate w-full text-center">{label}</span>
    </div>
  );
}
