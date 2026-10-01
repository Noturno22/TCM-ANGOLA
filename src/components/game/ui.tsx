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
  p1: 'bg-gradient-to-br from-p1 to-emerald-700 text-background hover:from-p1-bright hover:to-emerald-600 shadow-lg shadow-p1/25 hover:shadow-p1/40 hover:-translate-y-0.5',
  p2: 'bg-gradient-to-br from-p2 to-red-900 text-white hover:from-p2-bright hover:to-red-800 shadow-lg shadow-p2/25 hover:shadow-p2/40 hover:-translate-y-0.5',
  gold: 'bg-gradient-to-br from-gold to-amber-700 text-background hover:from-gold-bright hover:to-amber-600 shadow-lg shadow-gold/25 hover:shadow-gold/40 hover:-translate-y-0.5',
  orange: 'bg-gradient-to-br from-orange to-amber-800 text-white hover:from-orange-bright hover:to-amber-700 shadow-lg shadow-orange/25 hover:shadow-orange/40 hover:-translate-y-0.5',
  outline: 'border border-border/60 bg-surface/40 backdrop-blur-sm text-foreground hover:bg-surface-2/60 hover:border-border',
  ghost: 'bg-transparent text-foreground hover:bg-surface/60',
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
        'h-11 px-5 rounded-xl font-semibold text-sm transition-all duration-200',
        'active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0',
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

// ============ Card com estilo do jogo — glassmorphism premium ============
export function GameCard({
  className,
  children,
  glow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { glow?: 'p1' | 'p2' | 'gold' | null }) {
  return (
    <Card
      className={cn(
        'relative rounded-2xl bg-card/70 backdrop-blur-xl border-border/50 overflow-hidden',
        'transition-all duration-300',
        glow === 'p1' && 'shadow-xl shadow-p1/10 border-p1/20',
        glow === 'p2' && 'shadow-xl shadow-p2/10 border-p2/20',
        glow === 'gold' && 'shadow-xl shadow-gold/10 border-gold/20',
        !glow && 'elevation-2 hover:elevation-3',
        className,
      )}
      {...props}
    >
      {/* Brilho subtil no topo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {children}
    </Card>
  );
}

// ============ Pill de saldo (dourado premium com brilho) ============
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
      className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-gold/15 to-gold/5 border border-gold/40 px-3 py-1.5 hover:from-gold/25 hover:to-gold/10 hover:border-gold/60 transition-all duration-300 hover:shadow-md hover:shadow-gold/20"
      aria-label={`Saldo: ${coins} Kwanza. Abrir carteira.`}
    >
      <Coins className="w-4 h-4 text-gold group-hover:scale-110 transition-transform" />
      <span className="font-display text-base text-gold leading-none tracking-wide">
        {coins.toLocaleString('pt-PT')}
      </span>
      <span className="text-[10px] text-gold/70 uppercase tracking-wider font-semibold">KZ</span>
      <span className="ml-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-gold to-amber-600 text-background flex items-center justify-center text-sm font-bold leading-none shadow-sm group-hover:scale-110 transition-transform">
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
  const pieceSize = {
    sm: 'rounded-[3px]',
    md: 'rounded-[4px]',
    lg: 'rounded-[6px]',
  };
  return (
    <div className={cn('relative', dims[size])}>
      {/* Brilho externo */}
      <div className="absolute inset-0 rounded-xl blur-md bg-gold/20" />
      <div className={cn('relative absolute inset-0 rounded-xl gold-frame bg-gradient-to-br from-surface-2 to-background p-1.5', pieceSize[size])}>
        <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-[2px]">
          {/* P1 (verde) no topo — com gradiente esférico */}
          <div className={cn('bg-gradient-to-br from-p1-bright via-p1 to-emerald-800', pieceSize[size])} style={{ boxShadow: 'inset 0 -2px 3px oklch(0.35 0.1 152), inset 0 2px 3px oklch(0.85 0.15 155)' }} />
          <div className={cn('bg-gradient-to-br from-p1-bright via-p1 to-emerald-800', pieceSize[size])} style={{ boxShadow: 'inset 0 -2px 3px oklch(0.35 0.1 152), inset 0 2px 3px oklch(0.85 0.15 155)' }} />
          <div className={cn('bg-gradient-to-br from-p1-bright via-p1 to-emerald-800', pieceSize[size])} style={{ boxShadow: 'inset 0 -2px 3px oklch(0.35 0.1 152), inset 0 2px 3px oklch(0.85 0.15 155)' }} />
          {/* Vazio + alvo + vazio */}
          <div className={cn('bg-surface-2/60', pieceSize[size])} />
          <div className={cn('bg-surface-2/60 flex items-center justify-center', pieceSize[size])}>
            <div className="w-2/3 h-2/3 rounded-full border border-gold/80 flex items-center justify-center">
              <div className="w-1/3 h-1/3 rounded-full bg-gold/80" />
            </div>
          </div>
          <div className={cn('bg-surface-2/60', pieceSize[size])} />
          {/* P2 (vermelho) na base — com gradiente esférico */}
          <div className={cn('bg-gradient-to-br from-p2-bright via-p2 to-red-950', pieceSize[size])} style={{ boxShadow: 'inset 0 -2px 3px oklch(0.3 0.1 25), inset 0 2px 3px oklch(0.8 0.15 25)' }} />
          <div className={cn('bg-gradient-to-br from-p2-bright via-p2 to-red-950', pieceSize[size])} style={{ boxShadow: 'inset 0 -2px 3px oklch(0.3 0.1 25), inset 0 2px 3px oklch(0.8 0.15 25)' }} />
          <div className={cn('bg-gradient-to-br from-p2-bright via-p2 to-red-950', pieceSize[size])} style={{ boxShadow: 'inset 0 -2px 3px oklch(0.3 0.1 25), inset 0 2px 3px oklch(0.8 0.15 25)' }} />
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
