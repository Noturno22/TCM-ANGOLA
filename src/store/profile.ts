/**
 * Store de perfil/progressão — persistida em localStorage.
 * Spec §7.5 (progressão), §25 (pontuação), §23 (histórico).
 *
 * Adaptado ao modo offline: XP, nível, Elo (local), estatísticas,
 * conquistas e histórico de partidas.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Difficulty } from '@/lib/ai';
import type { Move } from '@/lib/engine';

export interface MatchRecord {
  id: string;
  date: string; // ISO
  mode: 'pvp' | 'pve' | 'cvc';
  difficulty?: Difficulty;
  result: 'P1' | 'P2' | 'DRAW';
  playerSide?: 'P1' | 'P2'; // em pve, que lado o humano jogou
  opponent: string; // nome do adversário (IA ou "Jogador 2")
  moves: Move[];
  moveCount: number;
  durationSec: number;
  reason?: 'LINE' | 'REPETITION' | 'RESIGN';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  unlockedAt: string | null;
}

export interface ProfileStats {
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
  totalMatches: number;
  xp: number;
  level: number;
  elo: number;
  coins: number; // KZ virtual
}

interface ProfileStore extends ProfileStats {
  matches: MatchRecord[];
  achievements: Achievement[];

  recordMatch: (m: Omit<MatchRecord, 'id' | 'date'>) => MatchRecord;
  addXp: (amount: number) => void;
  addCoins: (amount: number) => void;
  unlockAchievement: (id: string) => void;
  resetProfile: () => void;
}

const XP_PER_LEVEL = (level: number) => 500 + level * 250;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', title: 'Primeira Vitória', description: 'Ganha a tua primeira partida', icon: '🏆', unlockedAt: null },
  { id: 'streak_5', title: 'Série de 5', description: 'Vence 5 partidas seguidas', icon: '🔥', unlockedAt: null },
  { id: 'center_master', title: 'Dominador do Centro', description: 'Ganha com uma linha que passe pelo centro', icon: '🎯', unlockedAt: null },
  { id: 'block_master', title: 'Mestre do Bloqueio', description: 'Ganha após bloquear 3 ameaças numa partida', icon: '🛡️', unlockedAt: null },
  { id: 'comeback', title: 'Virada', description: 'Ganha após o adversário ter ameaça dupla', icon: '⚡', unlockedAt: null },
  { id: 'fast_win', title: 'Vitória Relâmpago', description: 'Ganha em 3 jogadas', icon: '⚡', unlockedAt: null },
  { id: 'beat_medium', title: 'Estrategista', description: 'Vence a IA Média', icon: '🧠', unlockedAt: null },
  { id: 'beat_hard', title: 'Tático', description: 'Vence a IA Difícil', icon: '💎', unlockedAt: null },
  { id: 'beat_perfect', title: 'Lendário', description: 'Vence a IA Perfeita (quase impossível!)', icon: '👑', unlockedAt: null },
  { id: 'played_10', title: 'Veterano', description: 'Joga 10 partidas', icon: '⚔️', unlockedAt: null },
  { id: 'played_50', title: 'Mestre', description: 'Joga 50 partidas', icon: '🎖️', unlockedAt: null },
  { id: 'draw_master', title: 'Diplomata', description: 'Empata 5 partidas', icon: '🤝', unlockedAt: null },
];

const INITIAL_STATS: ProfileStats = {
  wins: 0,
  losses: 0,
  draws: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalMatches: 0,
  xp: 0,
  level: 1,
  elo: 1000,
  coins: 5000, // bónus de boas-vindas (spec §7.2)
};

function levelFromXp(xp: number): number {
  let level = 1;
  let remaining = xp;
  while (remaining >= XP_PER_LEVEL(level)) {
    remaining -= XP_PER_LEVEL(level);
    level++;
  }
  return level;
}

export function xpProgress(xp: number, level: number): { current: number; needed: number; pct: number } {
  let cumulative = 0;
  for (let l = 1; l < level; l++) cumulative += XP_PER_LEVEL(l);
  const current = xp - cumulative;
  const needed = XP_PER_LEVEL(level);
  return { current, needed, pct: Math.min(100, (current / needed) * 100) };
}

export const useProfile = create<ProfileStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATS,
      matches: [],
      achievements: ACHIEVEMENTS.map((a) => ({ ...a })),

      recordMatch: (m) => {
        const record: MatchRecord = {
          ...m,
          id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          date: new Date().toISOString(),
        };
        set((s) => {
          const stats = { ...s };
          stats.totalMatches++;
          stats.matches = [record, ...s.matches].slice(0, 100); // últimas 100
          // XP (spec §7.5)
          let xpGain = 5;
          let eloDelta = 0;
          let coinsDelta = 0;
          const humanWon =
            (m.result === 'P1' && m.playerSide === 'P1') ||
            (m.result === 'P2' && m.playerSide === 'P2');
          const humanPlayed = m.mode !== 'cvc' && m.playerSide;
          if (humanPlayed) {
            if (humanWon) {
              stats.wins++;
              stats.currentStreak++;
              stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
              xpGain = 30;
              eloDelta = 16;
              coinsDelta = 100;
            } else if (m.result === 'DRAW') {
              stats.draws++;
              stats.currentStreak = 0;
              xpGain = 10;
              eloDelta = 0;
              coinsDelta = 20;
            } else {
              stats.losses++;
              stats.currentStreak = 0;
              xpGain = 5;
              eloDelta = -12;
              coinsDelta = 10;
            }
          }
          stats.xp = s.xp + xpGain;
          stats.level = levelFromXp(stats.xp);
          stats.elo = Math.max(100, s.elo + eloDelta);
          stats.coins = Math.max(0, s.coins + coinsDelta);
          return stats;
        });
        // Verificar conquistas
        const s = get();
        if (s.wins === 1) get().unlockAchievement('first_win');
        if (s.currentStreak >= 5) get().unlockAchievement('streak_5');
        if (s.totalMatches >= 10) get().unlockAchievement('played_10');
        if (s.totalMatches >= 50) get().unlockAchievement('played_50');
        if (s.draws >= 5) get().unlockAchievement('draw_master');
        if (humanWonRecord(record) && m.moveCount <= 3) get().unlockAchievement('fast_win');
        if (m.difficulty === 'medium' && humanWonRecord(record)) get().unlockAchievement('beat_medium');
        if (m.difficulty === 'hard' && humanWonRecord(record)) get().unlockAchievement('beat_hard');
        if (m.difficulty === 'perfect' && humanWonRecord(record)) get().unlockAchievement('beat_perfect');
        if (humanWonRecord(record) && record.moves.some((mv) => mv.to === 5)) {
          // approximação: vitória com peça no centro
          get().unlockAchievement('center_master');
        }
        return record;
      },

      addXp: (amount) =>
        set((s) => ({ xp: s.xp + amount, level: levelFromXp(s.xp + amount) })),

      addCoins: (amount) =>
        set((s) => ({ coins: Math.max(0, s.coins + amount) })),

      unlockAchievement: (id) =>
        set((s) => ({
          achievements: s.achievements.map((a) =>
            a.id === id && !a.unlockedAt
              ? { ...a, unlockedAt: new Date().toISOString() }
              : a,
          ),
        })),

      resetProfile: () =>
        set({ ...INITIAL_STATS, matches: [], achievements: ACHIEVEMENTS.map((a) => ({ ...a })) }),
    }),
    {
      name: 'tira-coco-profile',
    },
  ),
);

function humanWonRecord(r: Omit<MatchRecord, 'id' | 'date'>): boolean {
  if (!r.playerSide) return false;
  return r.result === r.playerSide;
}

/** Rankings simulados (para o ecrã de Rankings). */
export function getSimulatedRankings(): {
  name: string;
  elo: number;
  level: number;
  wins: number;
  avatar: string;
}[] {
  return [
    { name: 'KwanzaMaster', elo: 1840, level: 24, wins: 312, avatar: '👑' },
    { name: 'JJ_Manuel', elo: 1720, level: 21, wins: 281, avatar: '🦁' },
    { name: 'Luanda_Pro', elo: 1680, level: 19, wins: 256, avatar: '⚡' },
    { name: 'Muxima', elo: 1590, level: 18, wins: 234, avatar: '🌟' },
    { name: 'Capoeira', elo: 1510, level: 17, wins: 198, avatar: '🦅' },
    { name: 'Benguela_Bull', elo: 1450, level: 16, wins: 176, avatar: '🐂' },
    { name: 'Ngola', elo: 1390, level: 15, wins: 154, avatar: '🛡️' },
    { name: 'Soba', elo: 1320, level: 14, wins: 132, avatar: '🎭' },
    { name: 'Quibala', elo: 1270, level: 13, wins: 118, avatar: '🎯' },
    { name: 'Muxito', elo: 1210, level: 12, wins: 98, avatar: '🔥' },
  ];
}
