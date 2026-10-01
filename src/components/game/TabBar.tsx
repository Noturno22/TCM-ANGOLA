'use client';

import { Home, Users, Trophy, User, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp, type Screen } from '@/store/app';
import { cn } from '@/lib/utils';

interface Tab {
  id: Screen;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const REAL_TABS: Tab[] = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'rooms', label: 'Salas', icon: Users },
  { id: 'rankings', label: 'Rankings', icon: Trophy },
  { id: 'achievements', label: 'Prémios', icon: Award },
  { id: 'profile', label: 'Perfil', icon: User },
];

export function TabBar({ active }: { active: string }) {
  const navigate = useApp((s) => s.navigate);

  return (
    <nav
      className="sticky bottom-0 z-30 w-full max-w-2xl mx-auto"
      aria-label="Navegação principal"
    >
      {/* Glassmorphism premium */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/85 to-background/70 backdrop-blur-xl" />
      {/* Linha de gradiente no topo */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

      <div className="relative grid grid-cols-5 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {REAL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => navigate(tab.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all duration-300',
                'min-h-[48px]',
                isActive ? 'text-gold' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Indicador de fundo ativo — pílula arredondada */}
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-x-2 inset-y-1 rounded-xl bg-gradient-to-b from-gold/15 to-gold/5 border border-gold/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {/* Ponto ativo no topo */}
              {isActive && (
                <motion.span
                  layoutId="tab-dot"
                  className="absolute -top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <motion.div
                animate={isActive ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="relative z-10"
              >
                <Icon className={cn('w-5 h-5 transition-all', isActive && 'drop-shadow-[0_0_8px_var(--gold)]')} />
              </motion.div>
              <span className={cn(
                'relative z-10 text-[10px] transition-all duration-200',
                isActive ? 'font-semibold tracking-wide' : 'font-medium',
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
