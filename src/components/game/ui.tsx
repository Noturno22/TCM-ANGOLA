'use client';

import * as React from 'react';
import { Button as ShadButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Crown, Coins, User, Bot } from 'lucide-react';
import { playSound } from '@/lib/sound';

// ============ Botões ============
// `gold` é o acento de marca. `p1`/`p2` são semânticos das peças do jogo.
type GameVariant = 'primary' | 'p1' | 'p2' | 'gold' | 'orange' | 'outline' | 'ghost';

const variantClasses: Record<GameVariant, string> = {
  primary: 'bg-gold text-primary-foreground hover:brightness-105 shadow-md-clean',
  gold: 'bg-gold text-primary-foreground hover:brightness-105 shadow-md-clean',
  p1: 'bg-p1 text-white hover:brightness-105 shadow-md-clean',
  p2: 'bg-p2 text-white hover:brightness-105 shadow-md-clean',
  orange: 'bg-orange text-primary-foreground hover:brightness-105 shadow-md-clean',
  outline: 'border-2 border-gold/60 bg-surface text-foreground hover:bg-gold/10 hover:border-gold',
  ghost: 'bg-surface-2 text-foreground hover:bg-gold/15 hover:text-gold border border-border',
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
        'h-12 px-6 rounded-xl font-semibold text-base-sm transition-all',
        'active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
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

// ============ Card ============
export function GameCard({
  className,
  children,
  glow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { glow?: 'p1' | 'p2' | 'gold' | null }) {
  return (
    <Card
      className={cn(
        'relative rounded-2xl bg-card border border-border overflow-hidden',
        glow === 'p1' && 'border-p1/35',
        glow === 'p2' && 'border-p2/35',
        glow === 'gold' && 'border-gold/35',
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

// ============ Pill de saldo ============
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
      className="flex items-center gap-2 rounded-full bg-surface-2 border border-border pl-3 pr-1.5 py-2 hover:bg-surface transition-colors min-h-[44px]"
      aria-label={`Saldo: ${coins} Kwanza. Abrir carteira.`}
    >
      <Coins className="w-4 h-4 text-gold" />
      <span className="text-sm font-semibold text-foreground tabular-nums">
        {coins.toLocaleString('pt-PT')}
      </span>
      <span className="text-[12px] text-muted-foreground font-medium">KZ</span>
      <span className="ml-0.5 w-6 h-6 rounded-full bg-gold text-primary-foreground flex items-center justify-center text-base font-bold leading-none">
        +
      </span>
    </button>
  );
}

// ============ Avatar com badge de nível (SVG, sem emoji) ============
export function LevelAvatar({
  name,
  kind = 'human',
  level,
  size = 'md',
  isTop = false,
  online,
}: {
  name?: string;
  kind?: 'human' | 'ai';
  /** @deprecated usar `name`. Mantido só para compatibilidade de tipos. */
  emoji?: string;
  level: number;
  size?: 'sm' | 'md' | 'lg';
  isTop?: boolean;
  online?: boolean;
}) {
  const dims = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  const icon = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };
  const text = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };
  const badge = {
    sm: 'w-4 h-4 text-[11px]',
    md: 'w-5 h-5 text-[12px]',
    lg: 'w-6 h-6 text-sm',
  };
  const initial = name?.trim().charAt(0).toUpperCase();

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          'rounded-full bg-surface-2 border border-gold/40 flex items-center justify-center text-gold',
          dims[size],
        )}
      >
        {isTop && (
          <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 text-gold fill-gold" />
        )}
        {kind === 'ai' ? (
          <Bot className={icon[size]} />
        ) : initial ? (
          <span className={cn('font-display leading-none', text[size])}>{initial}</span>
        ) : (
          <User className={icon[size]} />
        )}
      </div>
      <div
        className={cn(
          'absolute -bottom-1 -right-1 rounded-full bg-gold text-primary-foreground font-bold flex items-center justify-center border-2 border-card',
          badge[size],
        )}
      >
        {level}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            'absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card',
            online ? 'bg-p1' : 'bg-muted-foreground',
          )}
        />
      )}
    </div>
  );
}

// ============ Barra de XP ============
export function XpBar({ xp, level }: { xp: number; level: number }) {
  const needed = 500 + level * 250;
  let cumulative = 0;
  for (let l = 1; l < level; l++) cumulative += 500 + l * 250;
  const current = xp - cumulative;
  const pct = Math.min(100, (current / needed) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-[12px] text-muted-foreground mb-1.5 font-medium">
        <span>Nível {level}</span>
        <span className="tabular-nums">
          {current.toLocaleString('pt-PT')} / {needed.toLocaleString('pt-PT')} XP
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full bg-gold rounded-full transition-all duration-500"
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
        'px-4 py-2.5 rounded-full text-[14px] font-medium transition-all whitespace-nowrap border min-h-[44px]',
        active
          ? 'bg-gold text-primary-foreground border-gold'
          : 'bg-surface-2 text-muted-foreground border-transparent hover:text-foreground hover:bg-surface',
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
    DRAW: { label: 'Empate', cls: 'bg-surface-2 text-muted-foreground border-border' },
  };
  const c = cfg[result];
  return (
    <span className={cn('px-2 py-0.5 rounded-md text-[12px] font-semibold border', c.cls)}>
      {c.label}
    </span>
  );
}

// ============ Logo do jogo ============
export function GameLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
  };
  return (
    <div className={cn('relative rounded-xl overflow-hidden border border-gold/50 shadow-md-clean', dims[size])}>
      <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-px bg-border">
        {/* P1 (verde) no topo */}
        <div className="bg-p1" />
        <div className="bg-p1" />
        <div className="bg-p1" />
        {/* Centro */}
        <div className="bg-surface-2" />
        <div className="bg-surface-2 flex items-center justify-center">
          <div className="w-1/2 h-1/2 rounded-full border-2 border-gold flex items-center justify-center">
            <div className="w-1/3 h-1/3 rounded-full bg-gold" />
          </div>
        </div>
        <div className="bg-surface-2" />
        {/* P2 (vermelho) na base */}
        <div className="bg-p2" />
        <div className="bg-p2" />
        <div className="bg-p2" />
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
      <h3 className="text-[16px] font-semibold tracking-tight text-foreground">{title}</h3>
      {action}
    </div>
  );
}
