'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Bot, Cpu, ChevronRight, ArrowLeft, BookOpen, Info, HelpCircle, Sparkles } from 'lucide-react';
import { useApp } from '@/store/app';
import { useGame } from '@/store/game';
import type { Difficulty } from '@/lib/ai';
import type { PlayerId } from '@/lib/engine';
import { useProgression, getUnlockRequirement, getUnlockText } from '@/store/progression';
import { GameButton, GameCard } from '@/components/game/ui';
import { cn } from '@/lib/utils';

const DIFFICULTIES: { id: Difficulty; label: string; desc: string; emoji: string; color: string }[] = [
  { id: 'easy', label: 'Fácil', desc: 'Para iniciantes. A IA comete erros.', emoji: '😊', color: 'text-p1' },
  { id: 'medium', label: 'Médio', desc: 'Bloqueia ameaças e valoriza o centro.', emoji: '🧠', color: 'text-gold' },
  { id: 'hard', label: 'Difícil', desc: 'Minimax + Alpha-Beta. Muito forte.', emoji: '💎', color: 'text-orange' },
  { id: 'perfect', label: 'Perfeito', desc: 'Análise retrógrada. Imbatível.', emoji: '👑', color: 'text-p2' },
];

export function OfflineSelectScreen() {
  const navigate = useApp((s) => s.navigate);
  const startGame = useGame((s) => s.startGame);
  const isUnlocked = useProgression((s) => s.isUnlocked);
  const winsByDifficulty = useProgression((s) => s.winsByDifficulty);
  const unlocked = useProgression((s) => s.unlocked);

  const [mode, setMode] = useState<'pvp' | 'pve' | 'cvc' | 'practice' | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [side, setSide] = useState<PlayerId>('P1');
  const [showThreats, setShowThreats] = useState(false);
  const [timeMode, setTimeMode] = useState<'normal' | 'quick' | 'none'>('normal');

  // Ajustar dificuldade se a selecionada ficar bloqueada — padrão "adjust state during render"
  const [prevUnlocked, setPrevUnlocked] = useState(unlocked);
  if (prevUnlocked !== unlocked) {
    setPrevUnlocked(unlocked);
    if (unlocked.hard && difficulty !== 'hard') setDifficulty('hard');
    else if (!unlocked.hard && unlocked.medium && difficulty === 'hard') setDifficulty('medium');
    else if (!unlocked.medium && difficulty === 'medium') setDifficulty('easy');
    else if (!isUnlocked(difficulty)) setDifficulty('easy');
  }

  const TIME_OPTIONS: { id: 'normal' | 'quick' | 'none'; label: string; desc: string; seconds: number; emoji: string }[] = [
    { id: 'normal', label: 'Normal', desc: '45s por jogada', seconds: 45, emoji: '🕐' },
    { id: 'quick', label: 'Rápida', desc: '15s por jogada — adrenalina!', seconds: 15, emoji: '⚡' },
    { id: 'none', label: 'Sem relógio', desc: 'Pensa com calma, sem pressão', seconds: 0, emoji: '🧘' },
  ];

  const handleStart = () => {
    const timePerTurn = TIME_OPTIONS.find((t) => t.id === timeMode)?.seconds ?? 45;
    if (mode === 'pvp') {
      startGame({ mode: 'pvp', showThreats, timePerTurn });
    } else if (mode === 'pve') {
      startGame({ mode: 'pve', difficulty, humanSide: side, showThreats, timePerTurn });
    } else if (mode === 'cvc') {
      startGame({ mode: 'cvc', difficulty, humanSide: 'P1', showThreats, timePerTurn });
    } else if (mode === 'practice') {
      // Treino Livre: sem relógio (0s), sem estatísticas, vs IA
      startGame({ mode: 'practice', difficulty, humanSide: side, showThreats, timePerTurn: 0 });
    }
    navigate('game');
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div>
        <h1 className="font-display text-3xl tracking-wide mb-1">MODO DE JOGO</h1>
        <p className="text-sm text-muted-foreground">Escolhe como queres jogar offline.</p>
      </div>

      {/* Modos de jogo */}
      <div className="space-y-2.5">
        <ModeOption
          icon={<Users className="w-5 h-5" />}
          title="2 Jogadores"
          desc="Joga com um amigo no mesmo dispositivo."
          active={mode === 'pvp'}
          onClick={() => setMode('pvp')}
          variant="p1"
        />
        <ModeOption
          icon={<Bot className="w-5 h-5" />}
          title="Contra o Computador"
          desc="Desafia a IA. Escolhe a dificuldade e o lado."
          active={mode === 'pve'}
          onClick={() => setMode('pve')}
          variant="orange"
        />
        <ModeOption
          icon={<Cpu className="w-5 h-5" />}
          title="Computador vs Computador"
          desc="Modo demonstração. Observa a IA a jogar."
          active={mode === 'cvc'}
          onClick={() => setMode('cvc')}
          variant="gold"
        />
        <ModeOption
          icon={<Sparkles className="w-5 h-5" />}
          title="Treino Livre"
          desc="Sem relógio, sem estatísticas. Undo ilimitado."
          active={mode === 'practice'}
          onClick={() => setMode('practice')}
          variant="gold"
        />
      </div>

      {/* Configurações de PvE */}
      {mode === 'pve' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4 overflow-hidden"
        >
          <GameCard className="p-4">
            <h3 className="font-display text-lg mb-3">Dificuldade da IA</h3>
            <div className="grid grid-cols-2 gap-2">
              {DIFFICULTIES.map((d) => {
                const unlocked = isUnlocked(d.id);
                const wins = winsByDifficulty[d.id];
                const req = getUnlockRequirement(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => unlocked && setDifficulty(d.id)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all relative',
                      !unlocked && 'opacity-60 cursor-not-allowed',
                      unlocked && difficulty === d.id
                        ? 'border-gold bg-gold/10'
                        : unlocked
                          ? 'border-border/40 bg-surface/40 hover:border-border'
                          : 'border-border/40 bg-surface/20',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{unlocked ? d.emoji : '🔒'}</span>
                      <span className={cn('font-semibold text-sm', unlocked ? d.color : 'text-muted-foreground')}>{d.label}</span>
                    </div>
                    {unlocked ? (
                      <p className="text-[10px] text-muted-foreground leading-tight">{d.desc}</p>
                    ) : (
                      <p className="text-[10px] text-gold/70 leading-tight">
                        {req ? `${getUnlockText(d.id)}${wins > 0 ? ` (${wins}/${req.wins})` : ''}` : ''}
                      </p>
                    )}
                    {unlocked && wins > 0 && (
                      <span className="absolute top-1 right-1 text-[9px] text-muted-foreground/60">
                        {wins}✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </GameCard>

          <GameCard className="p-4">
            <h3 className="font-display text-lg mb-3">Que lado jogas?</h3>
            <div className="grid grid-cols-2 gap-2">
              <SideOption
                side="P1"
                label="Jogador 1 (verde)"
                desc="Jogas primeiro"
                active={side === 'P1'}
                onClick={() => setSide('P1')}
              />
              <SideOption
                side="P2"
                label="Jogador 2 (vermelho)"
                desc="A IA joga primeiro"
                active={side === 'P2'}
                onClick={() => setSide('P2')}
              />
            </div>
          </GameCard>
        </motion.div>
      )}

      {/* Configurações de CvC */}
      {mode === 'cvc' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <GameCard className="p-4">
            <h3 className="font-display text-lg mb-3">Dificuldade (IA vs IA)</h3>
            <div className="grid grid-cols-2 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all',
                    difficulty === d.id
                      ? 'border-gold bg-gold/10'
                      : 'border-border/40 bg-surface/40',
                  )}
                >
                  <span className="text-lg mr-2">{d.emoji}</span>
                  <span className="text-sm font-semibold">{d.label}</span>
                </button>
              ))}
            </div>
          </GameCard>
        </motion.div>
      )}

      {/* Configurações de Treino Livre */}
      {mode === 'practice' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4 overflow-hidden"
        >
          <GameCard className="p-4">
            <h3 className="font-display text-lg mb-3">Dificuldade da IA</h3>
            <div className="grid grid-cols-2 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all',
                    difficulty === d.id
                      ? 'border-gold bg-gold/10'
                      : 'border-border/40 bg-surface/40 hover:border-border',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{d.emoji}</span>
                    <span className={cn('font-semibold text-sm', d.color)}>{d.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">{d.desc}</p>
                </button>
              ))}
            </div>
          </GameCard>

          <GameCard className="p-4">
            <h3 className="font-display text-lg mb-3">Que lado treinamos?</h3>
            <div className="grid grid-cols-2 gap-2">
              <SideOption
                side="P1"
                label="Jogador 1 (verde)"
                desc="Jogas primeiro"
                active={side === 'P1'}
                onClick={() => setSide('P1')}
              />
              <SideOption
                side="P2"
                label="Jogador 2 (vermelho)"
                desc="A IA joga primeiro"
                active={side === 'P2'}
                onClick={() => setSide('P2')}
              />
            </div>
          </GameCard>

          {/* Aviso de modo treino */}
          <GameCard className="p-4 bg-gold/5 border-gold/30">
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold mb-1">Modo Treino Livre</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Joga sem pressão: sem relógio, sem estatísticas, sem conquistas.
                  Podes anular jogadas ilimitadamente para experimentar estratégias.
                </p>
              </div>
            </div>
          </GameCard>
        </motion.div>
      )}

      {/* Opção tutorial: mostrar ameaças */}
      {mode && mode !== 'cvc' && (
        <GameCard className="p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <h3 className="font-semibold text-sm">Modo Tutorial</h3>
              <p className="text-[11px] text-muted-foreground">Realça as ameaças do adversário</p>
            </div>
            <input
              type="checkbox"
              checked={showThreats}
              onChange={(e) => setShowThreats(e.target.checked)}
              className="w-5 h-5 accent-gold"
            />
          </label>
        </GameCard>
      )}

      {/* Seletor de tempo por turno (todas as modalidades exceto CvC) */}
      {mode && mode !== 'cvc' && (
        <GameCard className="p-4">
          <h3 className="font-display text-lg mb-3">Tempo por jogada</h3>
          <div className="grid grid-cols-3 gap-2">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeMode(t.id)}
                className={cn(
                  'p-3 rounded-xl border text-center transition-all',
                  timeMode === t.id
                    ? 'border-gold bg-gold/10'
                    : 'border-border/40 bg-surface/40 hover:border-border',
                )}
              >
                <div className="text-xl mb-1">{t.emoji}</div>
                <div className={cn(
                  'font-semibold text-xs',
                  timeMode === t.id ? 'text-gold' : 'text-foreground',
                )}>
                  {t.label}
                </div>
                <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
          {timeMode === 'quick' && (
            <p className="text-[11px] text-orange mt-2 text-center animate-fade-in">
              ⚡ Modo Rápido: pensa rápido ou perde!
            </p>
          )}
        </GameCard>
      )}

      {/* Botão começar */}
      {mode && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <GameButton variant="p1" className="w-full h-12" onClick={handleStart}>
            COMEÇAR PARTIDA
            <ChevronRight className="w-4 h-4 ml-2" />
          </GameButton>
        </motion.div>
      )}

      {/* Atalhos informativos */}
      <div className="pt-4 border-t border-border/40 space-y-2">
        <InfoLink
          icon={<BookOpen className="w-4 h-4" />}
          label="Tutorial (10 passos)"
          onClick={() => navigate('tutorial')}
        />
        <InfoLink
          icon={<HelpCircle className="w-4 h-4" />}
          label="Como jogar"
          onClick={() => navigate('how-to-play')}
        />
        <InfoLink
          icon={<Info className="w-4 h-4" />}
          label="Sobre o jogo"
          onClick={() => navigate('about')}
        />
      </div>
    </div>
  );
}

function ModeOption({
  icon,
  title,
  desc,
  active,
  onClick,
  variant,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
  variant: 'p1' | 'p2' | 'gold' | 'orange';
}) {
  const colors = {
    p1: 'border-p1/50 bg-p1/5',
    p2: 'border-p2/50 bg-p2/5',
    gold: 'border-gold/50 bg-gold/5',
    orange: 'border-orange/50 bg-orange/5',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4',
        active ? colors[variant] : 'border-border/40 bg-surface/40 hover:border-border',
      )}
    >
      <div className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
        active ? 'bg-background/30' : 'bg-surface-2',
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-lg leading-tight">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      {active && <div className="w-2 h-2 rounded-full bg-gold" />}
    </button>
  );
}

function SideOption({
  label,
  desc,
  active,
  onClick,
}: {
  side: PlayerId;
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'p-3 rounded-xl border text-left transition-all',
        active ? 'border-gold bg-gold/10' : 'border-border/40 bg-surface/40',
      )}
    >
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-[10px] text-muted-foreground">{desc}</div>
    </button>
  );
}

function InfoLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface/60 transition-colors text-left"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-foreground flex-1">{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}
