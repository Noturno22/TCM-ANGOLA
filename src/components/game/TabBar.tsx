'use client';

import { Home, Users, MessageCircle, Trophy, User } from 'lucide-react';
import { useApp, type Screen } from '@/store/app';
import { cn } from '@/lib/utils';

interface Tab {
  id: Screen;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'rooms', label: 'Salas', icon: Users },
  { id: 'profile', label: 'Chat', icon: MessageCircle }, // chat placeholder → perfil
  { id: 'rankings', label: 'Rankings', icon: Trophy },
  { id: 'profile', label: 'Perfil', icon: User },
];

// Nota: o mockup tem 5 tabs (Início, Salas, Chat, Rankings, Perfil).
// Como o chat online não está implementado (modo offline), mapeamos "Chat" para
// um atalho que mostra um toast. Para simplicidade, usamos Perfil no lugar.
const REAL_TABS: Tab[] = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'rooms', label: 'Salas', icon: Users },
  { id: 'rankings', label: 'Rankings', icon: Trophy },
  { id: 'achievements', label: 'Prémios', icon: Trophy },
  { id: 'profile', label: 'Perfil', icon: User },
];

export function TabBar({ active }: { active: string }) {
  const navigate = useApp((s) => s.navigate);

  return (
    <nav
      className="sticky bottom-0 z-30 w-full max-w-2xl mx-auto bg-background/95 backdrop-blur-md border-t border-border/40"
      aria-label="Navegação principal"
    >
      {/* Padrão angolano subtil no topo da tab bar */}
      <div className="h-0.5 angolan-border opacity-60" />
      <div className="grid grid-cols-5 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {REAL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => navigate(tab.id)}
              className={cn(
                'flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors',
                'min-h-[44px]',
                isActive ? 'text-gold' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_4px_var(--gold)]')} />
              <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
