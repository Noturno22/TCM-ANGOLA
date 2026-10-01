'use client';

import { motion } from 'framer-motion';
import {
  Flag,
  Lock,
  Check,
  Star,
  ChevronRight,
  Trophy,
  Zap,
  Target,
  Clock,
  Crown,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useCampaign } from '@/store/campaign';
import { CAMPAIGN_LEVELS, TOTAL_CAMPAIGN_LEVELS, type CampaignLevel } from '@/lib/campaign';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { cn } from '@/lib/utils';

export function CampaignScreen() {
  const navigate = useApp((s) => s.navigate);
  const setCampaignLevelId = useApp((s) => s.setCampaignLevelId);
  const completed = useCampaign((s) => s.completed);
  const currentLevel = useCampaign((s) => s.currentLevel);
  const attemptsByLevel = useCampaign((s) => s.attemptsByLevel);

  const completedCount = completed.length;
  const progressPct = Math.round((completedCount / TOTAL_CAMPAIGN_LEVELS) * 100);

  const handlePlay = (level: CampaignLevel) => {
    if (level.id > currentLevel) return; // bloqueado
    setCampaignLevelId(level.id);
    navigate('campaign-play');
  };

  return (
    <div className="space-y-5 animate-slide-up pb-4">
      {/* Cabeçalho */}
      <GameCard className="p-5" glow="gold">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gold/15 flex items-center justify-center">
            <Flag className="w-7 h-7 text-gold" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl tracking-wide">CAMPANHA</h2>
            <p className="text-xs text-muted-foreground">
              {completedCount} / {TOTAL_CAMPAIGN_LEVELS} níveis completos
            </p>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden mt-2">
              <motion.div
                className="h-full bg-gradient-to-r from-p1 to-gold rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        </div>
      </GameCard>

      {/* Lista de níveis */}
      <div className="space-y-2.5">
        {CAMPAIGN_LEVELS.map((level, i) => {
          const isCompleted = completed.includes(level.id);
          const isUnlocked = level.id <= currentLevel;
          const isCurrent = level.id === currentLevel && !isCompleted;
          const attempts = attemptsByLevel[level.id] ?? 0;

          return (
            <motion.div
              key={level.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GameCard
                className={cn(
                  'p-4 transition-all',
                  !isUnlocked && 'opacity-50',
                  isCurrent && 'ring-1 ring-gold/50',
                  isCompleted && 'border-p1/30',
                )}
              >
                <button
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => handlePlay(level)}
                  className="w-full text-left disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    {/* Ícone de estado */}
                    <div className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl',
                      isCompleted ? 'bg-p1/15' :
                      isCurrent ? 'bg-gold/15' :
                      isUnlocked ? 'bg-surface-2' :
                      'bg-surface-2/50',
                    )}>
                      {isCompleted ? (
                        <Check className="w-6 h-6 text-p1" strokeWidth={3} />
                      ) : isUnlocked ? (
                        <span className="font-display text-lg text-foreground">{level.id}</span>
                      ) : (
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className={cn(
                          'font-display text-base leading-tight',
                          isCompleted && 'text-p1',
                          isCurrent && 'text-gold',
                        )}>
                          {level.title}
                        </h3>
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/15 text-gold font-semibold uppercase animate-pulse-glow">
                            Atual
                          </span>
                        )}
                        {isCompleted && (
                          <Star className="w-3.5 h-3.5 text-gold fill-gold" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight mb-2">
                        {level.description}
                      </p>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Target className="w-3 h-3" />
                          {diffLabel(level.difficulty)}
                        </span>
                        <span className="flex items-center gap-1 text-gold">
                          <Trophy className="w-3 h-3" />
                          {level.reward} KZ
                        </span>
                        {level.humanSide === 'P2' && (
                          <span className="flex items-center gap-1 text-p2">
                            <Crown className="w-3 h-3" />
                            Vermelho
                          </span>
                        )}
                        {level.objective.type === 'win_fast' && (
                          <span className="flex items-center gap-1 text-orange">
                            <Zap className="w-3 h-3" />
                            ≤{level.objective.maxMoves} jog
                          </span>
                        )}
                        {level.objective.type === 'survive' && (
                          <span className="flex items-center gap-1 text-orange">
                            <Clock className="w-3 h-3" />
                            Sobreviver {level.objective.minMoves} jog
                          </span>
                        )}
                        {attempts > 0 && (
                          <span className="text-muted-foreground/60 ml-auto">
                            {attempts} tentativa{attempts > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Seta */}
                    {isUnlocked && (
                      <ChevronRight className={cn(
                        'w-5 h-5 shrink-0 mt-1',
                        isCompleted ? 'text-p1' : 'text-muted-foreground',
                      )} />
                    )}
                  </div>
                </button>
              </GameCard>
            </motion.div>
          );
        })}
      </div>

      {/* Dica geral */}
      <GameCard className="p-4 bg-gold/5 border-gold/30">
        <div className="flex gap-3">
          <Trophy className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold mb-1">Completa todos os níveis</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Cada nível tem um objetivo único. Completa-os todos para te tornares um mestre do Tira o Cocó do Meio!
            </p>
          </div>
        </div>
      </GameCard>
    </div>
  );
}

function diffLabel(d: string): string {
  return d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : d === 'hard' ? 'Difícil' : 'Perfeito';
}
