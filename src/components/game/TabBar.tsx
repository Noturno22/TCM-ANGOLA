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
  const activeIndex = REAL_TABS.findIndex((t) => t.id === active);

  return (
    <nav
      className="sticky bottom-0 z-30 w-full max-w-2xl mx-auto bg-background/95 backdrop-blur-md border-t border-border/40"
      aria-label="Navegação principal"
    >
      {/* Padrão angolano subtil no topo da tab bar */}
      <div className="h-0.5 angolan-border opacity-60" />
      <div className="relative grid grid-cols-5 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {REAL_TABS.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => navigate(tab.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors',
                'min-h-[44px]',
                isActive ? 'text-gold' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Indicador de fundo ativo */}
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 rounded-lg bg-gold/10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {/* Ponto ativo no topo */}
              {isActive && (
                <motion.span
                  layoutId="tab-dot"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <motion.div
                animate={isActive ? { scale: 1.1, y: -1 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="relative z-10"
              >
                <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_var(--gold)]')} />
              </motion.div>
              <span className={cn('relative z-10 text-[10px] font-medium transition-all', isActive && 'font-semibold')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
