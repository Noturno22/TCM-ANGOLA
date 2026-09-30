'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Trophy, Target, Clock, BarChart3, Zap } from 'lucide-react';
import { useApp } from '@/store/app';
import { useProfile, xpProgress, type MatchRecord } from '@/store/profile';
import { GameCard, GameButton, SectionTitle } from '@/components/game/ui';
import { cn } from '@/lib/utils';

export function StatsScreen() {
  const profile = useProfile();

  // Derivar dados para gráficos a partir do histórico de partidas
  const stats = useMemo(() => computeStats(profile.matches), [profile.matches]);
  const xp = xpProgress(profile.xp, profile.level);

  // Se não há partidas, mostrar empty state
  if (profile.matches.length === 0) {
    return (
      <div className="space-y-5 animate-slide-up pb-4">
        <GameCard className="p-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <h2 className="font-display text-xl mb-2">Sem dados ainda</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Joga algumas partidas para veres as tuas estatísticas e gráficos de progresso.
          </p>
          <GameButton variant="p1" onClick={() => useApp.getState().navigate('offline-select')}>
            Jogar agora
          </GameButton>
        </GameCard>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up pb-4">
      {/* Resumo geral */}
      <GameCard className="p-4" glow="gold">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gold/15 flex items-center justify-center">
            <Trophy className="w-7 h-7 text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Resumo total</p>
            <p className="font-display text-2xl">{profile.totalMatches} partidas</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Taxa vitória</p>
            <p className="font-display text-2xl text-p1">{stats.winRate}%</p>
          </div>
        </div>
      </GameCard>

      {/* Gráfico de XP ao longo do tempo */}
      <GameCard className="p-4">
        <SectionTitle title="Progresso de XP" />
        <XpChart data={stats.xpCurve} totalXp={profile.xp} />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
          <span>Início</span>
          <span className="text-gold">{profile.xp.toLocaleString('pt-PT')} XP total</span>
          <span>Agora</span>
        </div>
      </GameCard>

      {/* Donut de resultados */}
      <GameCard className="p-4">
        <SectionTitle title="Resultados" />
        <div className="flex items-center gap-6">
          <ResultsDonut
            wins={profile.wins}
            losses={profile.losses}
            draws={profile.draws}
          />
          <div className="flex-1 space-y-2">
            <ResultRow label="Vitórias" value={profile.wins} total={profile.totalMatches} color="text-p1" bg="bg-p1" />
            <ResultRow label="Derrotas" value={profile.losses} total={profile.totalMatches} color="text-p2" bg="bg-p2" />
            <ResultRow label="Empates" value={profile.draws} total={profile.totalMatches} color="text-muted-foreground" bg="bg-muted-foreground" />
          </div>
        </div>
      </GameCard>

      {/* Por dificuldade */}
      <GameCard className="p-4">
        <SectionTitle title="Por dificuldade da IA" />
        <div className="space-y-3">
          {stats.byDifficulty.map((d) => (
            <DifficultyBar key={d.difficulty} {...d} />
          ))}
        </div>
      </GameCard>

      {/* Tempo de jogo */}
      <div className="grid grid-cols-2 gap-3">
        <GameCard className="p-4 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
          <div className="font-display text-2xl text-foreground">
            {formatDuration(stats.totalDuration)}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase">Tempo total</div>
        </GameCard>
        <GameCard className="p-4 text-center">
          <Zap className="w-5 h-5 mx-auto mb-1 text-gold" />
          <div className="font-display text-2xl text-gold">
            {stats.avgMoves > 0 ? Math.round(stats.avgMoves) : 0}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase">Jogadas/partida</div>
        </GameCard>
      </div>

      {/* Recorde */}
      <GameCard className="p-4">
        <SectionTitle title="Recordes" />
        <div className="space-y-2">
          <RecoreRow
            icon={<TrendingUp className="w-4 h-4" />}
            label="Melhor sequência"
            value={`${profile.bestStreak} vitórias`}
          />
          <RecoreRow
            icon={<Clock className="w-4 h-4" />}
            label="Partida mais rápida"
            value={stats.fastestMatch ? `${stats.fastestMatch}s` : '—'}
          />
          <RecoreRow
            icon={<Target className="w-4 h-4" />}
            label="Menos jogadas para vencer"
            value={stats.fewestMovesWin ? `${stats.fewestMovesWin} jogadas` : '—'}
          />
          <RecoreRow
            icon={<Trophy className="w-4 h-4" />}
            label="Conquistas desbloqueadas"
            value={`${profile.achievements.filter((a) => a.unlockedAt).length} / ${profile.achievements.length}`}
          />
        </div>
      </GameCard>
    </div>
  );
}

// ============ Gráfico de XP (linha/área SVG) ============
function XpChart({ data, totalXp }: { data: number[]; totalXp: number }) {
  if (data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
        Joga mais {2 - data.length} partida(s) para veres o gráfico.
      </div>
    );
  }
  const W = 300;
  const H = 100;
  const pad = 10;
  const max = data[data.length - 1] || 1;
  const min = data[0];
  const range = Math.max(1, max - min);
  const step = (W - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * step;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return [x, y];
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1][0]},${H - pad} L ${points[0][0]},${H - pad} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" role="img" aria-label="Gráfico de progresso de XP">
      <defs>
        <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--p1)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--p1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Linhas de grade */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={pad}
          y1={pad + f * (H - pad * 2)}
          x2={W - pad}
          y2={pad + f * (H - pad * 2)}
          stroke="var(--border)"
          strokeWidth="0.5"
          strokeDasharray="2 2"
        />
      ))}
      {/* Área */}
      <motion.path
        d={areaPath}
        fill="url(#xpGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      {/* Linha */}
      <motion.path
        d={linePath}
        fill="none"
        stroke="var(--p1)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {/* Pontos */}
      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={i === points.length - 1 ? 4 : 2}
          fill={i === points.length - 1 ? 'var(--gold)' : 'var(--p1)'}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 + i * 0.05 }}
        />
      ))}
    </svg>
  );
}

// ============ Donut de resultados ============
function ResultsDonut({ wins, losses, draws }: { wins: number; losses: number; draws: number }) {
  const total = wins + losses + draws;
  const R = 50;
  const C = 2 * Math.PI * R;
  const winPct = total > 0 ? (wins / total) * C : 0;
  const lossPct = total > 0 ? (losses / total) * C : 0;
  const drawPct = total > 0 ? (draws / total) * C : 0;

  return (
    <svg viewBox="0 0 130 130" className="w-32 h-32" role="img" aria-label={`Resultados: ${wins} vitórias, ${losses} derrotas, ${draws} empates`}>
      <circle cx="65" cy="65" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
      <motion.circle
        cx="65"
        cy="65"
        r={R}
        fill="none"
        stroke="var(--p1)"
        strokeWidth="14"
        strokeDasharray={`${winPct} ${C - winPct}`}
        strokeDashoffset={C * 0.25}
        transform="rotate(-90 65 65)"
        initial={{ strokeDasharray: `0 ${C}` }}
        animate={{ strokeDasharray: `${winPct} ${C - winPct}` }}
        transition={{ duration: 0.6 }}
      />
      <motion.circle
        cx="65"
        cy="65"
        r={R}
        fill="none"
        stroke="var(--p2)"
        strokeWidth="14"
        strokeDasharray={`${lossPct} ${C - lossPct}`}
        strokeDashoffset={C * 0.25 - winPct}
        transform="rotate(-90 65 65)"
        initial={{ strokeDasharray: `0 ${C}` }}
        animate={{ strokeDasharray: `${lossPct} ${C - lossPct}` }}
        transition={{ duration: 0.6, delay: 0.2 }}
      />
      <motion.circle
        cx="65"
        cy="65"
        r={R}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth="14"
        strokeDasharray={`${drawPct} ${C - drawPct}`}
        strokeDashoffset={C * 0.25 - winPct - lossPct}
        transform="rotate(-90 65 65)"
        initial={{ strokeDasharray: `0 ${C}` }}
        animate={{ strokeDasharray: `${drawPct} ${C - drawPct}` }}
        transition={{ duration: 0.6, delay: 0.4 }}
      />
      <text x="65" y="60" textAnchor="middle" className="font-display fill-foreground" fontSize="22">
        {total}
      </text>
      <text x="65" y="78" textAnchor="middle" className="fill-muted-foreground" fontSize="9">
        partidas
      </text>
    </svg>
  );
}

function ResultRow({ label, value, total, color, bg }: { label: string; value: number; total: number; color: string; bg: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={color}>{label}</span>
        <span className="text-muted-foreground">{value} ({Math.round(pct)}%)</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', bg)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

function DifficultyBar({
  difficulty,
  total,
  wins,
  losses,
  draws,
}: {
  difficulty: string;
  total: number;
  wins: number;
  losses: number;
  draws: number;
}) {
  const winPct = total > 0 ? (wins / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{difficulty}</span>
        <span className="text-muted-foreground">{total} partidas • {Math.round(winPct)}% vitória</span>
      </div>
      <div className="h-3 rounded-full bg-surface-2 overflow-hidden flex">
        {wins > 0 && (
          <motion.div
            className="h-full bg-p1"
            initial={{ width: 0 }}
            animate={{ width: `${(wins / total) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        )}
        {draws > 0 && (
          <motion.div
            className="h-full bg-muted-foreground"
            initial={{ width: 0 }}
            animate={{ width: `${(draws / total) * 100}%` }}
            transition={{ duration: 0.5, delay: 0.1 }}
          />
        )}
        {losses > 0 && (
          <motion.div
            className="h-full bg-p2"
            initial={{ width: 0 }}
            animate={{ width: `${(losses / total) * 100}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        )}
      </div>
    </div>
  );
}

function RecoreRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm flex-1">{label}</span>
      <span className="text-sm font-semibold text-gold">{value}</span>
    </div>
  );
}

// ============ Cálculos ============
interface ComputedStats {
  winRate: number;
  xpCurve: number[];
  totalDuration: number;
  avgMoves: number;
  fastestMatch: number | null;
  fewestMovesWin: number | null;
  byDifficulty: { difficulty: string; total: number; wins: number; losses: number; draws: number }[];
}

function computeStats(matches: MatchRecord[]): ComputedStats {
  const humanMatches = matches.filter((m) => m.playerSide);
  const wins = humanMatches.filter((m) => m.result === m.playerSide).length;
  const winRate = humanMatches.length > 0 ? Math.round((wins / humanMatches.length) * 100) : 0;

  // Curva de XP: somar XP ganho por partida (cronológico inverso → chronological)
  const chronological = [...humanMatches].reverse();
  const xpCurve: number[] = [0];
  let cumXp = 0;
  for (const m of chronological) {
    cumXp += xpForMatch(m);
    xpCurve.push(cumXp);
  }

  const totalDuration = matches.reduce((s, m) => s + m.durationSec, 0);
  const avgMoves = matches.length > 0 ? matches.reduce((s, m) => s + m.moveCount, 0) / matches.length : 0;
  const fastestMatch = matches.length > 0 ? Math.min(...matches.map((m) => m.durationSec)) : null;
  const fewestMovesWin = humanMatches.length > 0
    ? Math.min(...humanMatches.filter((m) => m.result === m.playerSide).map((m) => m.moveCount))
    : null;

  // Por dificuldade
  const diffMap = new Map<string, { total: number; wins: number; losses: number; draws: number }>();
  for (const m of matches) {
    if (m.mode !== 'pve' || !m.difficulty) continue;
    const key = m.difficulty === 'easy' ? 'Fácil' : m.difficulty === 'medium' ? 'Médio' : m.difficulty === 'hard' ? 'Difícil' : 'Perfeito';
    const entry = diffMap.get(key) ?? { total: 0, wins: 0, losses: 0, draws: 0 };
    entry.total++;
    if (m.result === m.playerSide) entry.wins++;
    else if (m.result === 'DRAW') entry.draws++;
    else entry.losses++;
    diffMap.set(key, entry);
  }
  const byDifficulty = [
    { difficulty: 'Fácil', ...(diffMap.get('Fácil') ?? { total: 0, wins: 0, losses: 0, draws: 0 }) },
    { difficulty: 'Médio', ...(diffMap.get('Médio') ?? { total: 0, wins: 0, losses: 0, draws: 0 }) },
    { difficulty: 'Difícil', ...(diffMap.get('Difícil') ?? { total: 0, wins: 0, losses: 0, draws: 0 }) },
    { difficulty: 'Perfeito', ...(diffMap.get('Perfeito') ?? { total: 0, wins: 0, losses: 0, draws: 0 }) },
  ];

  return {
    winRate,
    xpCurve,
    totalDuration,
    avgMoves,
    fastestMatch,
    fewestMovesWin: fewestMovesWin === Infinity ? null : fewestMovesWin,
    byDifficulty,
  };
}

function xpForMatch(m: MatchRecord): number {
  if (m.result === 'DRAW') return 10;
  if (m.result === m.playerSide) return 30; // vitória
  return 5; // derrota
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
