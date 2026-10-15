'use client';

import {
  Smile,
  Brain,
  Gem,
  Crown,
  Clock,
  Zap,
  TimerOff,
  Lock,
  Trophy,
  Flame,
  Target,
  Shield,
  Swords,
  Medal,
  Handshake,
  Flag,
  Building2,
  Waves,
  Mountain,
  TreePalm,
  Globe,
  Snail,
  Footprints,
  Gauge,
} from 'lucide-react';
import type { Difficulty } from '@tira/ai';
import { cn } from '@/lib/utils';

const DIFFICULTY_ICONS: Record<Difficulty, typeof Smile> = {
  easy: Smile,
  medium: Brain,
  hard: Gem,
  perfect: Crown,
};

export function DifficultyIcon({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  const Icon = DIFFICULTY_ICONS[difficulty];
  return <Icon className={className} />;
}

const TIME_ICONS = { normal: Clock, quick: Zap, none: TimerOff } as const;

export function TimeModeIcon({
  mode,
  className,
}: {
  mode: 'normal' | 'quick' | 'none';
  className?: string;
}) {
  const Icon = TIME_ICONS[mode];
  return <Icon className={className} />;
}

export function LockIcon({ className }: { className?: string }) {
  return <Lock className={className} />;
}

export function PlayerDot({ player, className }: { player: 'P1' | 'P2'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block w-2.5 h-2.5 rounded-full',
        player === 'P1' ? 'bg-p1' : 'bg-p2',
        className,
      )}
      aria-hidden
    />
  );
}

const ACHIEVEMENT_ICONS: Record<string, typeof Trophy> = {
  trophy: Trophy,
  flame: Flame,
  target: Target,
  shield: Shield,
  zap: Zap,
  brain: Brain,
  gem: Gem,
  crown: Crown,
  swords: Swords,
  medal: Medal,
  handshake: Handshake,
};

export function AchievementIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ACHIEVEMENT_ICONS[icon] ?? Trophy;
  return <Icon className={className} />;
}

const ROOM_ICONS: Record<string, typeof Globe> = {
  angola: Flag,
  luanda: Building2,
  benguela: Waves,
  huambo: Mountain,
  cabinda: TreePalm,
  global: Globe,
  // Internacionais
  portugal: Flag,
  brasil: Flag,
  mocambique: Flag,
  caboverde: Flag,
  africa: Globe,
  europa: Globe,
  america: Globe,
  mundo: Globe,
};

export function RoomIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ROOM_ICONS[id] ?? Globe;
  return <Icon className={className} />;
}

const SPEED_ICONS: Record<string, typeof Gauge> = {
  slow: Snail,
  normal: Footprints,
  fast: Zap,
};

export function SpeedIcon({ speed, className }: { speed: string; className?: string }) {
  const Icon = SPEED_ICONS[speed] ?? Gauge;
  return <Icon className={className} />;
}
