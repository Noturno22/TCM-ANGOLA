'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Clock,
  Calendar,
  Bot,
  Users,
  Cpu,
  Trophy,
  Handshake,
  X,
  Info,
  Share2,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useProfile, type MatchRecord } from '@/store/profile';
import { Board } from '@/components/game/Board';
import { GameButton, GameCard, ResultBadge } from '@/components/game/ui';
import { replayFrom } from '@/lib/engine';
import { decodeMatch } from '@/lib/share';
import { cn } from '@/lib/utils';

export function ReplayScreen() {
  const navigate = useApp((s) => s.navigate);
  const replayMatchId = useApp((s) => s.replayMatchId);
  const shareCode = useApp((s) => s.shareCode);
  const matches = useProfile((s) => s.matches);

  const match = useMemo(
    () => matches.find((m) => m.id === replayMatchId) ?? null,
    [matches, replayMatchId],
  );

  // Se há um share code, descodificar e mostrar como MatchRecord virtual
  const sharedMatch = useMemo(() => {
    if (!shareCode) return null;
    const decoded = decodeMatch(shareCode);
    if (!decoded) return null;
    // Construir um MatchRecord virtual
    const states = replayFrom(decoded.moves);
    const final = states[states.length - 1];
    return {
      id: 'shared',
      date: new Date().toISOString(),
      mode: decoded.mode,
      difficulty: decoded.difficulty,
      result: (final.winner ?? 'DRAW') as 'P1' | 'P2' | 'DRAW',
      playerSide: decoded.humanSide,
      opponent: 'Partida partilhada',
      moves: decoded.moves,
      moveCount: decoded.moves.length,
      durationSec: 0,
    } as MatchRecord;
  }, [shareCode]);

  // Prioridade: share code > match do histórico
  if (sharedMatch) {
    return <ReplayView match={sharedMatch} isShared />;
  }
  if (!match) {
    return <EmptyReplay onGoToProfile={() => navigate('profile')} />;
  }
  return <ReplayView match={match} />;
}

function EmptyReplay({ onGoToProfile }: { onGoToProfile: () => void }) {
  return (
    <div className="space-y-5 animate-slide-up pb-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide">REPLAY</h1>
        <p className="text-sm text-muted-foreground mt-1">Reve uma partida anterior.</p>
      </div>
      <GameCard className="p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-surface-2 mx-auto flex items-center justify-center mb-3">
          <Info className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="font-display text-xl mb-1">Nenhuma partida selecionada</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
          Vai ao teu perfil e escolhe uma partida do histórico para rever jogada a jogada.
        </p>
        <GameButton variant="p1" className="w-full" onClick={onGoToProfile}>
          Ir para o Perfil
        </GameButton>
      </GameCard>
    </div>
  );
}

function ReplayView({ match, isShared = false }: { match: MatchRecord; isShared?: boolean }) {
  const navigate = useApp((s) => s.navigate);
  const setReplayMatchId = useApp((s) => s.setReplayMatchId);

  // Gerar estados por replay
  const states = useMemo(() => replayFrom(match.moves), [match.moves]);
  const totalPlies = states.length - 1; // nº de jogadas

  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Reset ply quando muda a partida — padrão "adjust state during render"
  // (evita setState síncrono dentro de useEffect, que causaria renders em cascata)
  const [lastMatchId, setLastMatchId] = useState(match.id);
  if (lastMatchId !== match.id) {
    setLastMatchId(match.id);
    setPly(0);
    setPlaying(false);
  }

  const isAtEnd = ply >= totalPlies;

  // Auto-play: agenda o próximo tick se estiver a reproduzir e não estiver no fim.
  // O "stop at end" é implícito: isAtEnd torna-se true, o effect re-corre e o
  // early-return evita agendar um novo timeout.
  useEffect(() => {
    if (!playing || isAtEnd) return;
    const t = setTimeout(() => {
      setPly((p) => Math.min(totalPlies, p + 1));
    }, 900);
    return () => clearTimeout(t);
  }, [playing, isAtEnd, totalPlies]);

  const current = states[ply];
  const lastMove = ply > 0 ? match.moves[ply - 1] : null;

  const handlePlay = useCallback(() => {
    if (isAtEnd) {
      setPly(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  }, [isAtEnd]);

  const handleStepFwd = useCallback(() => {
    setPlaying(false);
    setPly((p) => Math.min(totalPlies, p + 1));
  }, [totalPlies]);

  const handleStepBack = useCallback(() => {
    setPlaying(false);
    setPly((p) => Math.max(0, p - 1));
  }, []);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setPly(0);
  }, []);

  const noop = () => {};

  const date = new Date(match.date);
  const dateStr = date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const modeIcon =
    match.mode === 'pvp' ? <Users className="w-3.5 h-3.5" /> : match.mode === 'pve' ? <Bot className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />;
  const modeLabel =
    match.mode === 'pvp' ? '2 Jogadores' : match.mode === 'pve' ? 'vs IA' : 'IA vs IA';

  const resultEmoji =
    match.result === 'DRAW' ? '🤝' : match.result === 'P1' ? '🟢' : '🔴';
  const resultLabel =
    match.result === 'DRAW'
      ? 'Empate'
      : match.playerSide
        ? match.result === match.playerSide
          ? 'Vitória'
          : 'Derrota'
        : `Vitória ${match.result}`;

  return (
    <div className="space-y-4 animate-slide-up pb-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-3xl tracking-wide">REPLAY</h1>
        <p className="text-sm text-muted-foreground mt-1">Partida jogada a {dateStr}.</p>
      </div>

      {/* Info da partida */}
      <GameCard className="p-4" glow={match.result === 'DRAW' ? null : 'gold'}>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Info2 icon={<Calendar className="w-3.5 h-3.5" />} label="Data" value={`${dateStr} · ${timeStr}`} />
          <Info2 icon={modeIcon} label="Modo" value={modeLabel} />
          <Info2 icon={<Users className="w-3.5 h-3.5" />} label="Adversário" value={match.opponent} />
          <Info2 icon={<Clock className="w-3.5 h-3.5" />} label="Duração" value={`${match.durationSec}s`} />
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2">
            <span className="text-lg">{resultEmoji}</span>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Resultado</p>
              <p className="text-sm font-semibold">{resultLabel}</p>
            </div>
          </div>
          <ResultBadge result={match.result} />
        </div>
        {match.reason && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            {match.reason === 'LINE'
              ? 'Linha de três completada'
              : match.reason === 'REPETITION'
                ? 'Empate por repetição'
                : 'Desistência'}
          </p>
        )}
      </GameCard>

      {/* Tabuleiro */}
      <div className="flex justify-center">
        <Board
          board={current.board}
          selectedSquare={null}
          validTargets={[]}
          lastMove={lastMove}
          winningLine={current.winningLine}
          threatSquares={[]}
          onSquareClick={noop}
          disabled
          size="md"
        />
      </div>

      {/* Indicador de jogada atual */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Jogada <span className="font-display text-lg text-gold mx-1">{ply}</span> de{' '}
          <span className="font-semibold text-foreground">{totalPlies}</span>
        </p>
        <p className="text-[11px] mt-1">
          {ply === 0 ? (
            <span className="text-muted-foreground">Posição inicial</span>
          ) : (
            <span className={current.currentPlayer === 'P1' ? 'text-p1' : 'text-p2'}>
              {current.currentPlayer === 'P1' ? '🟢' : '🔴'} Vez do Jogador{' '}
              {current.currentPlayer === 'P1' ? '1' : '2'}
            </span>
          )}
        </p>
      </div>

      {/* Slider de progresso */}
      <div className="px-2">
        <input
          type="range"
          min={0}
          max={totalPlies}
          value={ply}
          onChange={(e) => {
            setPlaying(false);
            setPly(Number(e.target.value));
          }}
          aria-label="Progresso da partida"
          className="w-full accent-gold h-2"
        />
      </div>

      {/* Controlos */}
      <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
        <CtrlButton onClick={handleReset} disabled={ply === 0} aria-label="Reiniciar">
          <RotateCcw className="w-4 h-4" />
        </CtrlButton>
        <CtrlButton onClick={handleStepBack} disabled={ply === 0} aria-label="Recuar">
          <SkipBack className="w-4 h-4" />
        </CtrlButton>
        <CtrlButton
          onClick={handlePlay}
          variant="p1"
          aria-label={playing && !isAtEnd ? 'Pausar' : 'Reproduzir'}
          className="col-span-1"
        >
          {playing && !isAtEnd ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </CtrlButton>
        <CtrlButton onClick={handleStepFwd} disabled={ply >= totalPlies} aria-label="Avançar">
          <SkipForward className="w-4 h-4" />
        </CtrlButton>
        <CtrlButton
          onClick={() => {
            setReplayMatchId(null);
            navigate('profile');
          }}
          aria-label="Fechar replay"
        >
          <X className="w-4 h-4" />
        </CtrlButton>
      </div>

      {/* Estado final */}
      {ply === totalPlies && totalPlies > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GameCard className="p-4 text-center" glow="gold">
            {match.result === 'DRAW' ? (
              <>
                <Handshake className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                <p className="font-display text-lg">Empate</p>
              </>
            ) : (
              <>
                <Trophy className="w-8 h-8 text-gold mx-auto mb-1" />
                <p className="font-display text-lg">Vitória {match.result === 'P1' ? 'P1' : 'P2'}</p>
              </>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">Fim da partida</p>
          </GameCard>
        </motion.div>
      )}
    </div>
  );
}

function Info2({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function CtrlButton({
  children,
  onClick,
  disabled,
  variant = 'outline',
  className,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'outline' | 'p1';
  className?: string;
  'aria-label': string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'h-11 rounded-xl flex items-center justify-center transition-all',
        'disabled:opacity-40 disabled:pointer-events-none',
        'active:scale-95',
        variant === 'p1'
          ? 'bg-p1 text-background shadow-lg shadow-p1/20 hover:brightness-110'
          : 'bg-surface-2 text-foreground hover:bg-surface border border-border/40',
        className,
      )}
    >
      {children}
    </button>
  );
}
