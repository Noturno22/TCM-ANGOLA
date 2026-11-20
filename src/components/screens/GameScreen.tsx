'use client';

import { useEffect, useState, useCallback, forwardRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
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
  Trophy,
  Handshake,
  Frown,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import { useI18n } from '@/lib/i18n/hook';
import type { I18nKey, I18nVars } from '@/lib/i18n';

type Translator = (key: I18nKey, vars?: I18nVars) => string;
import { isGameOver, type Square, type Threat, type Move, type Cell } from '@tira/engine';
import { playSound } from '@/lib/sound';
import { Board } from '@/components/game/Board';
import { ArenaBackground } from '@/components/game/ArenaBackground';
import { RobotAvatar } from '@/components/game/RobotAvatar';
import { GameButton, GameCard } from '@/components/game/ui';
import { Confetti } from '@/components/game/Confetti';
import { CocoDoMeioPopup } from '@/components/game/CocoDoMeioPopup';
import { isTrappedInMiddle } from '@/lib/cocoDoMeio';
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
  const { t } = useI18n();
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
    mode === 'pvp'
      ? t('game.player1')
      : mode === 'cvc'
        ? `${t('game.ia')} (P1)`
        : humanSide === 'P1'
          ? t('game.you')
          : `${t('game.ia')} ${t(`diff.${difficulty}`)}`;
  const p2Label =
    mode === 'pvp'
      ? t('game.player2')
      : mode === 'cvc'
        ? `${t('game.ia')} (P2)`
        : humanSide === 'P2'
          ? t('game.you')
          : `${t('game.ia')} ${t(`diff.${difficulty}`)}`;

  const p1Active = state.currentPlayer === 'P1' && !isGameOver(state);
  const p2Active = state.currentPlayer === 'P2' && !isGameOver(state);
  const flipped = (mode === 'pve' || mode === 'practice') && humanSide === 'P2';

  const gameOver = isGameOver(state);

  // "Tira o coco do meio": jogador da vez (humano ou IA) encurralado no meio
  const cocoActive = !gameOver && isTrappedInMiddle(state);

  const handleExit = () => {
    if (!isGameOver(state) && mode !== 'cvc') {
      forfeit(humanSide);
    }
    back();
  };

  const modeText =
    mode === 'pvp'
      ? t('mode.pvp')
      : mode === 'pve'
        ? t('game.vs_ai')
        : mode === 'cvc'
          ? t('mode.cvc')
          : t('mode.practice');
  const diffText = mode !== 'pvp' ? t(`diff.${difficulty}`) : null;
  const bannerTone: 'green' | 'red' | 'gold' = gameOver ? 'gold' : p1Active ? 'green' : 'red';

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      {/* Arena neon de fundo (SVG) */}
      <ArenaBackground />

      {/* Cabeçalho da partida */}
      <header className="relative z-10 px-4 pt-3 pb-1">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleExit}
            className="h-12 w-12 shrink-0 rounded-full border border-white/12 bg-black/55 text-white/90 backdrop-blur-sm transition hover:bg-black/75 active:scale-95"
            aria-label="Voltar"
          >
            <ChevronLeft className="mx-auto h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[13px] font-extrabold uppercase tracking-wide text-white">
              {modeText}
              {diffText && (
                <>
                  {' · '}
                  <span className="text-p1 text-glow-p1">{diffText}</span>
                </>
              )}
            </p>
            <p className="text-[12px] font-semibold text-white/85">
              {t('game.match', { n: moveCount })}
              {showThreats && ` • ${t('mode.tutorial')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('how-to-play')}
            className="h-12 w-12 shrink-0 rounded-full border border-white/12 bg-black/55 text-white/90 backdrop-blur-sm transition hover:bg-black/75 active:scale-95"
            aria-label="Como jogar"
          >
            <MessageCircle className="mx-auto h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {/* Área principal */}
      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-custom px-4 pb-6">
        {/* Jogadores + relógios + VS */}
        <div className="mb-3 flex items-stretch gap-2 pt-1">
          <PlayerCard
            label={p1Label}
            active={p1Active}
            time={p1Time}
            showClock={hasClock}
            isHuman={mode === 'pve' || mode === 'practice' ? humanSide === 'P1' : mode !== 'cvc'}
            isP1
          />
          <div className="flex shrink-0 items-center px-0.5">
            <span
              className="font-display text-[26px] italic leading-none text-white"
              style={{
                textShadow:
                  '0 0 14px rgba(45,255,120,0.85), 0 0 32px rgba(45,255,120,0.45)',
              }}
              aria-hidden
            >
              VS
            </span>
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

        {/* Banner de estado */}
        <StatusBanner tone={bannerTone}>
          <AnimatePresence mode="wait">
            <motion.p
              key={state.status + moveCount}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className={cn(
                'text-[13.5px] font-semibold',
                p1Active && 'text-[#45ff95]',
                p2Active && 'text-[#ff6b6b]',
                gameOver && 'text-gold',
                !p1Active && !p2Active && !gameOver && 'text-muted-foreground',
              )}
            >
              {getStatusMessage(state, mode, humanSide, isAiThinking, showThreats, currentThreats, t)}
            </motion.p>
          </AnimatePresence>
        </StatusBanner>

        {/* Tabuleiro */}
        <div className="mb-4 flex justify-center px-1">
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

        {/* Contadores */}
        <div className="mb-4 flex flex-wrap justify-center gap-3">
          <StatChip
            icon={<Trophy className="h-4 w-4 text-white/80" />}
            value={moveCount}
            label={t('game.moves')}
          />
          <StatChip
            icon={<Trophy className="h-4 w-4 text-gold" />}
            value={state.history.length}
            label={t('profile.history')}
          />
          {showThreats && (
            <StatChip
              icon={<Eye className={cn('h-4 w-4', currentThreats.length > 0 ? 'text-p2' : 'text-white/60')} />}
              value={currentThreats.length}
              label={t('game.threats')}
            />
          )}
        </div>

        {/* Ações */}
        <div className="mx-auto mb-2.5 grid max-w-[540px] grid-cols-3 gap-2.5">
          <NeonButton
            tone="green"
            onClick={undo}
            disabled={moveCount === 0 || mode === 'cvc' || gameOver}
            className="px-2 text-[12.5px]"
          >
            <Undo2 className="h-4 w-4 shrink-0" />
            {t('game.undo')}
          </NeonButton>
          <NeonButton tone="gold" onClick={toggleThreats} className="px-2 text-[12.5px]">
            <Eye className="h-4 w-4 shrink-0" />
            {showThreats ? t('game.hide') : t('game.threats')}
          </NeonButton>
          <NeonButton tone="green" onClick={restart} className="px-2 text-[12.5px]">
            <RotateCcw className="h-4 w-4 shrink-0" />
            {t('game.restart')}
          </NeonButton>
        </div>

        <div className="mx-auto grid max-w-[540px] grid-cols-[1.45fr_1fr] gap-2.5">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <NeonButton tone="red" disabled={gameOver} className="font-extrabold">
                <Flag className="h-4 w-4 shrink-0" />
                {t('game.resign')}
              </NeonButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('game.resign.confirm')}</AlertDialogTitle>
                <AlertDialogDescription>{t('game.resign.desc')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    resign();
                  }}
                  className="bg-p2 text-white hover:bg-p2/90"
                >
                  {t('common.yes_resign')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <NeonButton tone="green">
                <LogOut className="h-4 w-4 shrink-0" />
                {t('game.exit')}
              </NeonButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('game.exit.confirm')}</AlertDialogTitle>
                <AlertDialogDescription>{t('game.exit.desc')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.continue')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (!gameOver) resign();
                    back();
                  }}
                  className="bg-p2 text-white hover:bg-p2/90"
                >
                  {t('game.exit')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* "Tira o coco do meio" — pop-ups animados */}
      <CocoDoMeioPopup active={cocoActive} moveCount={state.moveCount} />

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

/* ============================================================
   BANNER DE ESTADO — painel hexagonal com borda neon
   ============================================================ */
const BANNER_CLIP =
  'polygon(16px 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0% 50%)';

const BANNER_TONES: Record<'green' | 'red' | 'gold', { edge: string; glow: string }> = {
  green: {
    edge: 'linear-gradient(90deg, rgba(45,255,120,0.12) 0%, rgba(45,255,120,0.95) 50%, rgba(45,255,120,0.12) 100%)',
    glow: '0 0 18px rgba(45,255,120,0.4)',
  },
  red: {
    edge: 'linear-gradient(90deg, rgba(255,59,59,0.12) 0%, rgba(255,59,59,0.95) 50%, rgba(255,59,59,0.12) 100%)',
    glow: '0 0 18px rgba(255,59,59,0.4)',
  },
  gold: {
    edge: 'linear-gradient(90deg, rgba(245,180,38,0.12) 0%, rgba(245,180,38,0.95) 50%, rgba(245,180,38,0.12) 100%)',
    glow: '0 0 18px rgba(245,180,38,0.4)',
  },
};

function StatusBanner({ tone, children }: { tone: 'green' | 'red' | 'gold'; children: ReactNode }) {
  const t = BANNER_TONES[tone];
  return (
    <div
      className="relative mx-auto mb-4 w-full max-w-[440px]"
      style={{ filter: `drop-shadow(${t.glow})` }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ clipPath: BANNER_CLIP, background: t.edge }}
      />
      <div
        aria-hidden
        className="absolute inset-[2px]"
        style={{
          clipPath: BANNER_CLIP,
          background: 'linear-gradient(180deg, rgba(5,12,9,0.97), rgba(2,6,4,0.97))',
        }}
      />
      <div className="relative px-8 py-2 text-center">{children}</div>
    </div>
  );
}

/* ============================================================
   CHIP DE ESTATÍSTICA
   ============================================================ */
function StatChip({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="min-w-[118px] rounded-2xl border border-white/15 bg-black/55 px-5 py-1.5 text-center backdrop-blur-sm">
      <div className="flex items-center justify-center gap-2">
        {icon}
        <span className="font-display text-[26px] leading-none text-white tabular-nums">
          {value}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
        {label}
      </p>
    </div>
  );
}

/* ============================================================
   BOTÃO NEON (transparente, borda com glow)
   ============================================================ */
type NeonTone = 'green' | 'gold' | 'red';

const NEON_TONES: Record<NeonTone, string> = {
  green:
    'border-[#2dff7e]/85 bg-[#060d09]/85 backdrop-blur-sm text-white shadow-[0_0_14px_rgba(45,255,120,0.4),inset_0_0_12px_rgba(45,255,120,0.12)] hover:shadow-[0_0_20px_rgba(45,255,120,0.6),inset_0_0_14px_rgba(45,255,120,0.18)]',
  gold:
    'border-[#f5b426]/85 bg-[#060d09]/85 backdrop-blur-sm text-white shadow-[0_0_14px_rgba(245,180,38,0.4),inset_0_0_12px_rgba(245,180,38,0.12)] hover:shadow-[0_0_20px_rgba(245,180,38,0.6),inset_0_0_14px_rgba(245,180,38,0.18)]',
  red:
    'border-[#ff8080]/60 bg-gradient-to-b from-[#ff4b4b] to-[#cf1414] text-white shadow-[0_8px_20px_rgba(255,60,60,0.45)] hover:from-[#ff5f5f] hover:to-[#dd1b1b]',
};

const NeonButton = forwardRef<HTMLButtonElement, { tone?: NeonTone } & ComponentProps<'button'>>(
  function NeonButton({ tone = 'green', className, onClick, children, ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        className={cn(
          'flex h-11 items-center justify-center gap-1.5 rounded-full border-2 px-3',
          'text-[13px] font-bold transition-all duration-200',
          'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
          NEON_TONES[tone],
          className,
        )}
        onClick={(e) => {
          if (!props.disabled) playSound('click');
          onClick?.(e);
        }}
      >
        {children}
      </button>
    );
  },
);

/* ============================================================
   CARD DE JOGADOR — avatar robot SVG + relógio + estado
   ============================================================ */
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
  const timeStr = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;

  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-1 items-center gap-2.5 rounded-[20px] border-2 px-2.5 py-2 transition-all duration-300',
        active
          ? isP1
            ? 'border-[#2dff7e] bg-[#05150c]/85 shadow-[0_0_20px_rgba(45,255,120,0.4),inset_0_0_20px_rgba(45,255,120,0.1)]'
            : 'border-[#ff3b3b] bg-[#170607]/85 shadow-[0_0_20px_rgba(255,59,59,0.38),inset_0_0_20px_rgba(255,59,59,0.1)]'
          : 'border-white/12 bg-black/55 backdrop-blur-sm',
      )}
    >
      {/* Avatar robot */}
      <div
        className={cn(
          'relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 bg-[#0a120e]',
          isP1
            ? 'border-[#2dff7e] shadow-[0_0_12px_rgba(45,255,120,0.55)]'
            : 'border-[#ff3b3b] shadow-[0_0_12px_rgba(255,59,59,0.5)]',
        )}
      >
        <RobotAvatar variant={isHuman ? 'human' : 'ai'} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate pr-3 text-[15px] font-bold leading-tight text-white">{label}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <Clock
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              lowTime && active ? 'text-[#ff5a5a]' : 'text-white/55',
            )}
          />
          <span
            className={cn(
              'font-display text-lg leading-none tabular-nums',
              lowTime && active
                ? 'text-[#ff5a5a]'
                : active
                  ? isP1
                    ? 'text-[#45ff95]'
                    : 'text-[#ff6b6b]'
                  : 'text-white/85',
            )}
          >
            {showClock ? timeStr : '—:—'}
          </span>
          {active && (
            <span
              className={cn(
                'ml-auto shrink-0 text-[9.5px] font-extrabold uppercase tracking-wider',
                isP1 ? 'text-[#45ff95]' : 'text-[#ff6b6b]',
              )}
            >
              {isHuman ? 'Sua vez' : 'A pensar…'}
            </span>
          )}
          {!active && !showClock && (
            <span className="ml-auto shrink-0 text-[9.5px] font-medium text-white/45">
              Sem relógio
            </span>
          )}
        </div>
      </div>

      {active && (
        <span
          aria-hidden
          className={cn(
            'absolute right-2.5 top-2.5 h-2.5 w-2.5 animate-pulse-glow rounded-full',
            isP1 ? 'bg-[#2dff7e]' : 'bg-[#ff3b3b]',
          )}
          style={{
            boxShadow: isP1 ? '0 0 8px #2dff7e' : '0 0 8px #ff3b3b',
          }}
        />
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
  const { t } = useI18n();
  const isDraw = winner === null;
  const humanWon = (mode === 'pve' || mode === 'practice') && winner === humanSide;
  const humanLost = (mode === 'pve' || mode === 'practice') && winner && winner !== humanSide;

  // Vitória/derrota com linha vencedora (vitória "natural"). Quando `winningLine`
  // é nulo, a partida terminou por desistência, tempo esgotado ou desistência.
  const naturalWin = winner !== null && winningLine !== null && winningLine.length === 3;

  const title = isDraw
    ? t('game.draw')
    : mode === 'pve' || mode === 'practice'
      ? humanWon
        ? t('game.victory')
        : t('game.defeat')
      : mode === 'cvc'
        ? t('game.ai_won', { n: winner === 'P1' ? 1 : 2 })
        : t('game.player_won', { n: winner === 'P1' ? 1 : 2 });

  const subtitle = isDraw
    ? t('game.draw.desc')
    : naturalWin
      ? mode === 'pve' || mode === 'practice'
        ? humanWon
          ? t('game.win.human')
          : t('game.win.ai')
        : t('game.win.line')
      : t('game.end.no_winner');

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
                ? t('game.end.board_win')
                : t('game.end.board_final')}
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
                {t('game.end.won_by')}{' '}
                <span className="text-foreground font-medium">{describeLine(winningLine, t)}</span>
                {lastMove && (
                  <span className="block mt-0.5">
                    {t('game.end.final_move', { from: lastMove.from, to: lastMove.to })}
                  </span>
                )}
              </p>
            ) : (
              <p>
                {lastMove
                  ? `${t('game.end.last_move', { from: lastMove.from, to: lastMove.to })} `
                  : ''}
                {isDraw ? t('game.end.no_line_draw') : t('game.end.no_line')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <GameButton variant="p1" className="w-full h-12" onClick={onRestart}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {t('game.play_again')}
            </GameButton>
            <GameButton variant="outline" className="w-full h-12" onClick={onExit}>
              <LogOut className="w-4 h-4 mr-2" />
              {t('game.exit')}
            </GameButton>
          </div>
        </GameCard>
      </motion.div>
    </motion.div>
  );
}

const LINE_LABEL_KEYS: Record<string, I18nKey> = {
  '1,2,3': 'game.line.bottom',
  '4,5,6': 'game.line.mid',
  '7,8,9': 'game.line.top',
  '1,4,7': 'game.line.col_left',
  '2,5,8': 'game.line.col_mid',
  '3,6,9': 'game.line.col_right',
  '1,5,9': 'game.line.diag_main',
  '3,5,7': 'game.line.diag_sec',
};

function describeLine(line: readonly number[], t: Translator): string {
  const key = [...line].sort((a, b) => a - b).join(',');
  return t(LINE_LABEL_KEYS[key] ?? 'game.line.other');
}

function getStatusMessage(
  state: { status: string; currentPlayer: 'P1' | 'P2'; winner: 'P1' | 'P2' | null },
  mode: 'pvp' | 'pve' | 'cvc' | 'practice',
  humanSide: 'P1' | 'P2',
  isAiThinking: boolean,
  showThreats: boolean,
  currentThreats: Threat[],
  t: Translator,
): string {
  if (state.status === 'WIN_P1' || state.status === 'WIN_P2') {
    if (mode === 'pve' || mode === 'practice') {
      return state.winner === humanSide ? t('game.win_status') : t('game.lose_status');
    }
    if (mode === 'cvc') return t('game.ai_won', { n: state.winner === 'P1' ? 1 : 2 });
    return t('game.player_won', { n: state.winner === 'P1' ? 1 : 2 });
  }
  if (state.status === 'DRAW') return t('game.draw');
  if (mode === 'cvc') return isAiThinking ? t('game.ai_thinking') : `${t('game.ia')} vs ${t('game.ia')}`;
  if (isAiThinking) return t('game.ai_thinking');
  const isHumanTurn = mode === 'pve' || mode === 'practice' ? state.currentPlayer === humanSide : true;
  if (isHumanTurn) {
    if (showThreats && currentThreats.length > 0) return t('game.threat_warning');
    return t('game.your_turn');
  }
  return t('game.opponent_turn');
}
