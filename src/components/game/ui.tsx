'use client';

import * as React from 'react';
import { Button as ShadButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Crown, Coins } from 'lucide-react';
import { playSound } from '@/lib/sound';

// ============ Botões com variante de cor do jogo ============
type GameVariant = 'p1' | 'p2' | 'gold' | 'orange' | 'outline' | 'ghost';

const variantClasses: Record<GameVariant, string> = {
  p1: 'bg-p1 text-background hover:brightness-110 shadow-lg shadow-p1/20',
  p2: 'bg-p2 text-white hover:brightness-110 shadow-lg shadow-p2/20',
  gold: 'bg-gold text-background hover:brightness-105 shadow-lg shadow-gold/20',
  orange: 'bg-orange text-white hover:brightness-110 shadow-lg shadow-orange/20',
  outline: 'border border-border bg-transparent text-foreground hover:bg-accent',
  ghost: 'bg-transparent text-foreground hover:bg-accent',
};

type GameButtonProps = React.ComponentProps<'button'> & {
  variant?: GameVariant;
};

export function GameButton({
  variant = 'outline',
  className,
  children,
  onClick,
  ...props
}: GameButtonProps) {
  return (
    <ShadButton
      variant="default"
      className={cn(
        'h-11 px-5 rounded-xl font-semibold text-sm transition-all',
        'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        className,
      )}
      onClick={(e) => {
        if (!props.disabled) playSound('click');
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </ShadButton>
  );
}

// ============ Card com estilo do jogo ============
export function GameCard({
  className,
  children,
  glow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { glow?: 'p1' | 'p2' | 'gold' | null }) {
  return (
    <Card
      className={cn(
        'relative rounded-2xl bg-card/80 backdrop-blur-sm border-border/60 overflow-hidden',
        glow === 'p1' && 'shadow-lg shadow-p1/10',
        glow === 'p2' && 'shadow-lg shadow-p2/10',
        glow === 'gold' && 'shadow-lg shadow-gold/10',
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

// ============ Pill de saldo (dourado com "+") ============
export function BalancePill({
  coins,
  onClick,
}: {
  coins: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-gold/15 border border-gold/40 px-3 py-1.5 hover:bg-gold/25 transition-colors"
      aria-label={`Saldo: ${coins} Kwanza. Abrir carteira.`}
    >
      <Coins className="w-4 h-4 text-gold" />
      <span className="font-display text-base text-gold leading-none">
        {coins.toLocaleString('pt-PT')}
      </span>
      <span className="text-[10px] text-gold/70 uppercase tracking-wider">KZ</span>
      <span className="ml-1 w-5 h-5 rounded-full bg-gold text-background flex items-center justify-center text-sm font-bold leading-none">
        +
      </span>
    </button>
  );
}

// ============ Avatar com badge de nível ============
export function LevelAvatar({
  emoji,
  level,
  size = 'md',
  isTop = false,
  online,
}: {
  emoji: string;
  level: number;
  size?: 'sm' | 'md' | 'lg';
  isTop?: boolean;
  online?: boolean;
}) {
  const dims = {
    sm: 'w-9 h-9 text-lg',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  };
  const badge = {
    sm: 'w-4 h-4 text-[8px]',
    md: 'w-5 h-5 text-[10px]',
    lg: 'w-7 h-7 text-xs',
  };
  return (
    <div className="relative inline-block">
      <div
        className={cn(
          'rounded-full bg-gradient-to-br from-surface-2 to-surface border-2 border-gold/60 flex items-center justify-center',
          dims[size],
        )}
      >
        {isTop && (
          <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 text-gold fill-gold" />
        )}
        <span>{emoji}</span>
      </div>
      <div
        className={cn(
          'absolute -bottom-1 -right-1 rounded-full bg-gold text-background font-bold flex items-center justify-center border border-background',
          badge[size],
        )}
      >
        {level}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            'absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background',
            online ? 'bg-p1' : 'bg-muted-foreground',
          )}
        />
      )}
    </div>
  );
}

// ============ Barra de XP ============
export function XpBar({ xp, level }: { xp: number; level: number }) {
  // XP necessário por nível: 500 + level*250
  const needed = 500 + level * 250;
  let cumulative = 0;
  for (let l = 1; l < level; l++) cumulative += 500 + l * 250;
  const current = xp - cumulative;
  const pct = Math.min(100, (current / needed) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
        <span>Nível {level}</span>
        <span>
          {current.toLocaleString('pt-PT')} / {needed.toLocaleString('pt-PT')} XP
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-p1 to-gold rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ============ Chip de filtro ============
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
        active
          ? 'bg-gold text-background'
          : 'bg-surface-2 text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ============ Badge de resultado ============
export function ResultBadge({ result }: { result: 'P1' | 'P2' | 'DRAW' }) {
  const cfg = {
    P1: { label: 'Vitória', cls: 'bg-p1/15 text-p1 border-p1/30' },
    P2: { label: 'Derrota', cls: 'bg-p2/15 text-p2 border-p2/30' },
    DRAW: { label: 'Empate', cls: 'bg-muted text-muted-foreground border-border' },
  };
  const c = cfg[result];
  return (
    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold uppercase border', c.cls)}>
      {c.label}
    </span>
  );
}

// ============ Logo do jogo ============
export function GameLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-24 h-24',
  };
  return (
    <div className={cn('relative', dims[size])}>
      <div className="absolute inset-0 rounded-xl gold-frame bg-gradient-to-br from-surface to-background p-1.5">
        <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5">
          {/* P1 (verde) no topo */}
          <div className="rounded-sm bg-gradient-to-br from-p1 to-emerald-700" />
          <div className="rounded-sm bg-gradient-to-br from-p1 to-emerald-700" />
          <div className="rounded-sm bg-gradient-to-br from-p1 to-emerald-700" />
          {/* Vazio + alvo + vazio */}
          <div className="rounded-sm bg-surface-2" />
          <div className="rounded-sm bg-surface-2 flex items-center justify-center">
            <div className="w-1/2 h-1/2 rounded-full border border-gold" />
          </div>
          <div className="rounded-sm bg-surface-2" />
          {/* P2 (vermelho) na base */}
          <div className="rounded-sm bg-gradient-to-br from-p2 to-red-900" />
          <div className="rounded-sm bg-gradient-to-br from-p2 to-red-900" />
          <div className="rounded-sm bg-gradient-to-br from-p2 to-red-900" />
        </div>
      </div>
    </div>
  );
}

// ============ Secção com título ============
export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display text-lg tracking-wide text-foreground">{title}</h3>
      {action}
    </div>
  );
}
