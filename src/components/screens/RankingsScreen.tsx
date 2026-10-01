'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Medal, Trophy, Flame, Users, Globe2 } from 'lucide-react';
import { useProfile, getSimulatedRankings } from '@/store/profile';
import { FilterChip, GameCard, LevelAvatar, SectionTitle } from '@/components/game/ui';
import { cn } from '@/lib/utils';

type Tab = 'weekly' | 'global' | 'friends';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'weekly', label: 'Semanal', icon: <Flame className="w-3.5 h-3.5" /> },
  { id: 'global', label: 'Global', icon: <Globe2 className="w-3.5 h-3.5" /> },
  { id: 'friends', label: 'Amigos', icon: <Users className="w-3.5 h-3.5" /> },
];

export function RankingsScreen() {
  const [tab, setTab] = useState<Tab>('weekly');
  const profile = useProfile();

  /** Lista combinada: rankings simulados + jogador atual. */
  const ranking = useMemo(() => {
    const simulated = getSimulatedRankings();
    const me = {
      name: 'Tu',
      elo: profile.elo,
      level: profile.level,
      wins: profile.wins,
      avatar: '🦁',
      isMe: true,
    };
    // Filtrar amigos (simulado: 4 primeiros + tu)
    if (tab === 'friends') {
      return [
        { ...simulated[1], isMe: false },
        { ...simulated[3], isMe: false },
        me,
        { ...simulated[5], isMe: false },
        { ...simulated[7], isMe: false },
      ].sort((a, b) => b.elo - a.elo);
    }
    // Semanal / Global: todos + tu
    const all = [...simulated.map((s) => ({ ...s, isMe: false })), me];
    return all.sort((a, b) => b.elo - a.elo);
  }, [tab, profile.elo, profile.level, profile.wins]);

  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3, 10);
  const myPosition = ranking.findIndex((r) => r.isMe) + 1;

  // Ordem do pódio: 2º, 1º, 3º (visual clássico)
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-3xl tracking-wide">RANKINGS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A tua posição:{' '}
          <span className="text-gold font-semibold">#{myPosition || '—'}</span> · Elo{' '}
          <span className="text-foreground font-semibold">{profile.elo}</span>
        </p>
      </div>

      {/* Tabs / filtros */}
      <div className="flex gap-2 overflow-x-auto scrollbar-custom -mx-1 px-1 pb-1">
        {TABS.map((t) => (
          <FilterChip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            <span className="inline-flex items-center gap-1.5">
              {t.icon}
              {t.label}
            </span>
          </FilterChip>
        ))}
      </div>

      {/* Pódio Top 3 */}
      <div className="grid grid-cols-3 gap-2 items-end">
        {podiumOrder.map((entry, idx) => {
          if (!entry) return <div key={idx} />;
          // Determinar a posição real (1º, 2º, 3º)
          const realPos = ranking.findIndex((r) => r === entry) + 1;
          const isFirst = realPos === 1;
          const isSecond = realPos === 2;
          const isThird = realPos === 3;
          return (
            <motion.div
              key={`${entry.name}-${realPos}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, type: 'spring', stiffness: 200, damping: 20 }}
              className={cn(
                'rounded-2xl border p-3 flex flex-col items-center text-center',
                isFirst
                  ? 'border-gold/60 bg-gradient-to-b from-gold/15 to-transparent order-2 h-44'
                  : isSecond
                    ? 'border-muted-foreground/40 bg-surface/60 order-1 h-36'
                    : 'border-orange/40 bg-surface/60 order-3 h-32',
                entry.isMe && 'ring-2 ring-p1',
              )}
            >
              {/* Coroa / medalha */}
              <div className="mb-1">
                {isFirst && <Crown className="w-5 h-5 text-gold fill-gold" />}
                {isSecond && <Medal className="w-4 h-4 text-muted-foreground" />}
                {isThird && <Medal className="w-4 h-4 text-orange" />}
              </div>
              {/* Número da posição */}
              <div
                className={cn(
                  'font-display text-2xl leading-none mb-1',
                  isFirst ? 'text-gold' : isSecond ? 'text-muted-foreground' : 'text-orange',
                )}
              >
                {realPos}º
              </div>
              {/* Avatar */}
              <LevelAvatar
                emoji={entry.avatar}
                level={entry.level}
                size={isFirst ? 'lg' : 'md'}
                isTop={isFirst}
              />
              {/* Nome */}
              <p
                className={cn(
                  'font-semibold text-xs mt-1.5 truncate w-full',
                  entry.isMe && 'text-p1',
                )}
              >
                {entry.name}
              </p>
              <p className="text-[10px] text-gold font-medium">{entry.elo} Elo</p>
            </motion.div>
          );
        })}
      </div>

      {/* Lista 4º-10º */}
      <div>
        <SectionTitle title="Classificação" />
        <div className="space-y-1.5">
          {rest.map((entry) => {
            const pos = ranking.findIndex((r) => r === entry) + 1;
            return (
              <motion.div
                key={`${entry.name}-${pos}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * pos }}
              >
                <GameCard
                  className={cn(
                    'p-2.5 flex items-center gap-3',
                    entry.isMe && 'border-p1/60 bg-p1/5 ring-1 ring-p1/30',
                  )}
                >
                  <div className="w-7 text-center font-display text-lg text-muted-foreground">
                    {pos}
                  </div>
                  <LevelAvatar emoji={entry.avatar} level={entry.level} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'font-semibold text-sm truncate',
                        entry.isMe && 'text-p1',
                      )}
                    >
                      {entry.name}
                      {entry.isMe && <span className="text-[10px] ml-1.5 text-p1/70">(tu)</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Nível {entry.level} · {entry.wins} vitórias
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-base text-gold leading-none">{entry.elo}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Elo</p>
                  </div>
                </GameCard>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Cartão de estatísticas próprias */}
      <GameCard className="p-4" glow="gold">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">A tua posição atual</p>
            <p className="font-display text-xl">
              #{myPosition || '—'} <span className="text-muted-foreground text-sm font-sans">· {profile.elo} Elo</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <MiniStat label="Vitórias" value={profile.wins} color="text-p1" />
          <MiniStat label="Nível" value={profile.level} color="text-gold" />
          <MiniStat label="Série" value={profile.currentStreak} color="text-orange" />
        </div>
      </GameCard>

      <p className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
        Rankings simulados para o modo offline. O modo online com rankings reais chega em breve.
      </p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-surface/60 border border-border/40 py-2">
      <div className={cn('font-display text-xl', color)}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
