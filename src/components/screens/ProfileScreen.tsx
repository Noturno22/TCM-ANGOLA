'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  History,
  Award,
  Users,
  ChevronRight,
  Crown,
  TrendingUp,
  Play,
  Calendar,
  Clock,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useProfile, xpProgress } from '@/store/profile';
import {
  GameCard,
  GameButton,
  LevelAvatar,
  XpBar,
  FilterChip,
  ResultBadge,
  SectionTitle,
} from '@/components/game/ui';
import { cn } from '@/lib/utils';

type Tab = 'history' | 'achievements' | 'friends';

export function ProfileScreen() {
  const navigate = useApp((s) => s.navigate);
  const setReplayMatchId = useApp((s) => s.setReplayMatchId);
  const profile = useProfile();
  const [tab, setTab] = useState<Tab>('history');

  const xp = xpProgress(profile.xp, profile.level);
  const winRate =
    profile.totalMatches > 0
      ? Math.round((profile.wins / profile.totalMatches) * 100)
      : 0;

  const unlockedAchievements = profile.achievements.filter((a) => a.unlockedAt);

  const handleReplay = (matchId: string) => {
    setReplayMatchId(matchId);
    navigate('replay');
  };

  return (
    <div className="space-y-5 animate-slide-up pb-4">
      {/* Cabeçalho do perfil */}
      <GameCard className="p-5" glow="gold">
        <div className="flex flex-col items-center text-center gap-3">
          <LevelAvatar emoji="🦁" level={profile.level} size="lg" isTop={profile.elo > 1500} online />
          <div>
            <h2 className="font-display text-2xl tracking-wide">Jogador</h2>
            <p className="text-xs text-muted-foreground">
              Nível {profile.level} • Elo {profile.elo}
            </p>
          </div>
          <div className="w-full max-w-xs">
            <XpBar xp={profile.xp} level={profile.level} />
          </div>
        </div>
      </GameCard>

      {/* Estatísticas */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard icon={<Trophy className="w-4 h-4" />} value={profile.wins} label="Vitórias" color="text-p1" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} value={profile.losses} label="Derrotas" color="text-p2" />
        <StatCard icon={<Award className="w-4 h-4" />} value={profile.draws} label="Empates" color="text-muted-foreground" />
        <StatCard icon={<Crown className="w-4 h-4" />} value={`${winRate}%`} label="Vitória" color="text-gold" />
      </div>

      {/* Sequência */}
      <GameCard className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sequência atual</p>
            <p className="font-display text-2xl text-p1">{profile.currentStreak}</p>
          </div>
          <div className="w-px h-10 bg-border/40" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Melhor sequência</p>
            <p className="font-display text-2xl text-gold">{profile.bestStreak}</p>
          </div>
          <div className="w-px h-10 bg-border/40" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Partidas</p>
            <p className="font-display text-2xl text-foreground">{profile.totalMatches}</p>
          </div>
        </div>
      </GameCard>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-custom pb-1">
        <FilterChip active={tab === 'history'} onClick={() => setTab('history')}>
          <History className="w-3 h-3 inline mr-1" />
          Histórico
        </FilterChip>
        <FilterChip active={tab === 'achievements'} onClick={() => setTab('achievements')}>
          <Award className="w-3 h-3 inline mr-1" />
          Conquistas ({unlockedAchievements.length})
        </FilterChip>
        <FilterChip active={tab === 'friends'} onClick={() => setTab('friends')}>
          <Users className="w-3 h-3 inline mr-1" />
          Amigos
        </FilterChip>
      </div>

      {/* Conteúdo da tab */}
      {tab === 'history' && (
        <div className="space-y-2">
          {profile.matches.length === 0 ? (
            <GameCard className="p-8 text-center">
              <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mb-4">
                Ainda não jogaste nenhuma partida.
              </p>
              <GameButton variant="p1" onClick={() => navigate('offline-select')}>
                Jogar agora
              </GameButton>
            </GameCard>
          ) : (
            <>
              {profile.matches.slice(0, 20).map((m) => (
                <GameCard key={m.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <ResultBadge result={m.result} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        vs {m.opponent}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(m.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {m.durationSec}s
                        </span>
                        <span>{m.moveCount} jogadas</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReplay(m.id)}
                      className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-gold/20 hover:text-gold flex items-center justify-center transition-colors"
                      aria-label="Ver replay"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </GameCard>
              ))}
              {profile.matches.length > 20 && (
                <p className="text-center text-[11px] text-muted-foreground py-2">
                  Mostrando as 20 partidas mais recentes de {profile.matches.length}.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'achievements' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {profile.achievements.map((a) => (
              <GameCard
                key={a.id}
                className={cn(
                  'p-3',
                  !a.unlockedAt && 'opacity-50 grayscale',
                )}
                glow={a.unlockedAt ? 'gold' : null}
              >
                <div className="flex items-start gap-2">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0',
                    a.unlockedAt ? 'bg-gold/15' : 'bg-surface-2',
                  )}>
                    {a.icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold leading-tight">{a.title}</h4>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {a.description}
                    </p>
                    {a.unlockedAt && (
                      <p className="text-[9px] text-gold mt-1">
                        {formatDate(a.unlockedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </GameCard>
            ))}
          </div>
          <GameButton
            variant="outline"
            className="w-full"
            onClick={() => navigate('achievements')}
          >
            Ver todas as conquistas
            <ChevronRight className="w-4 h-4 ml-1" />
          </GameButton>
        </div>
      )}

      {tab === 'friends' && (
        <GameCard className="p-8 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-1">Sem amigos ainda</p>
          <p className="text-[11px] text-muted-foreground mb-4">
            O modo online com amigos chega em breve. Por enquanto, desafia a IA!
          </p>
          <GameButton variant="p1" onClick={() => navigate('offline-select')}>
            Jogar contra a IA
          </GameButton>
        </GameCard>
      )}

      {/* Botão de reset (discreto) */}
      {profile.totalMatches > 0 && (
        <button
          type="button"
          onClick={() => {
            if (confirm('Reiniciar todo o progresso? Esta ação não pode ser desfeita.')) {
              useProfile.getState().resetProfile();
            }
          }}
          className="w-full text-center text-[10px] text-muted-foreground/50 hover:text-p2 py-2"
        >
          Reiniciar progresso
        </button>
      )}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <GameCard className="p-3 text-center">
      <div className={cn('flex justify-center mb-1', color)}>{icon}</div>
      <div className={cn('font-display text-xl leading-none', color)}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
    </GameCard>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}
