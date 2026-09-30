'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lock, Trophy, Sparkles } from 'lucide-react';
import { useProfile, type Achievement } from '@/store/profile';
import { GameCard, SectionTitle } from '@/components/game/ui';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export function AchievementsScreen() {
  const achievements = useProfile((s) => s.achievements);

  const { unlocked, locked, pct } = useMemo(() => {
    const u = achievements.filter((a) => a.unlockedAt);
    const l = achievements.filter((a) => !a.unlockedAt);
    const p = achievements.length === 0 ? 0 : (u.length / achievements.length) * 100;
    return { unlocked: u, locked: l, pct: p };
  }, [achievements]);

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-3xl tracking-wide">CONQUISTAS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Desbloqueia todas as conquistas do jogo.
        </p>
      </div>

      {/* Progresso geral */}
      <GameCard className="p-5" glow="gold">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            {/* Círculo de progresso */}
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-surface-2"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className="text-gold transition-all"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - pct / 100)}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-gold" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-gold font-semibold">
              Progresso total
            </p>
            <p className="font-display text-3xl tracking-wide leading-none mt-1">
              {unlocked.length}
              <span className="text-muted-foreground text-xl">/{achievements.length}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {unlocked.length === achievements.length
                ? 'Conquista completa! 🏆'
                : `${locked.length} por desbloquear`}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Progress value={pct} className="h-1.5" />
        </div>
      </GameCard>

      {/* Conquistas desbloqueadas */}
      {unlocked.length > 0 && (
        <div>
          <SectionTitle
            title="Desbloqueadas"
            action={
              <span className="text-[11px] text-p1 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {unlocked.length}
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-2.5">
            {unlocked.map((a, i) => (
              <AchievementCard key={a.id} achievement={a} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Conquistas bloqueadas */}
      {locked.length > 0 && (
        <div>
          <SectionTitle
            title="Por desbloquear"
            action={
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {locked.length}
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-2.5">
            {locked.map((a, i) => (
              <AchievementCard key={a.id} achievement={a} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Dica */}
      <p className="text-[10px] text-muted-foreground/70 text-center leading-relaxed pt-2">
        Continua a jogar para desbloquear novas conquistas. Algumas são muito raras!
      </p>
    </div>
  );
}

function AchievementCard({ achievement, index }: { achievement: Achievement; index: number }) {
  const unlocked = !!achievement.unlockedAt;
  const date = unlocked
    ? new Date(achievement.unlockedAt as string).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
    >
      <GameCard
        className={cn(
          'p-3 h-full',
          unlocked
            ? 'border-gold/50 bg-gradient-to-b from-gold/10 to-transparent'
            : 'border-border/40 bg-surface/40',
        )}
        glow={unlocked ? 'gold' : null}
      >
        <div className="flex flex-col items-center text-center">
          {/* Ícone */}
          <div
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-2 transition-all',
              unlocked
                ? 'bg-gold/15 shadow-lg shadow-gold/20'
                : 'bg-surface-2 grayscale opacity-50',
            )}
          >
            {unlocked ? (
              achievement.icon
            ) : (
              <span className="text-muted-foreground">
                <Lock className="w-5 h-5" />
              </span>
            )}
          </div>

          {/* Título */}
          <h4
            className={cn(
              'font-semibold text-xs leading-tight',
              unlocked ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {achievement.title}
          </h4>

          {/* Descrição */}
          <p className="text-[10px] text-muted-foreground mt-1 leading-tight min-h-[28px]">
            {achievement.description}
          </p>

          {/* Data de desbloqueio ou estado */}
          {unlocked ? (
            <div className="mt-2 flex items-center gap-1 text-[9px] text-gold font-semibold uppercase tracking-wider">
              <Sparkles className="w-2.5 h-2.5" />
              {date}
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground/60 uppercase tracking-wider">
              <Lock className="w-2.5 h-2.5" />
              Bloqueada
            </div>
          )}
        </div>
      </GameCard>
    </motion.div>
  );
}
