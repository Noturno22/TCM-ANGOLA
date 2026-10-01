'use client';

import { Home, Users, Trophy, User, Award } from 'lucide-react';
import { useApp, type Screen } from '@/store/app';
import { useI18n } from '@/lib/i18n/hook';
import { cn } from '@/lib/utils';

interface Tab {
  id: Screen;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const REAL_TABS: Tab[] = [
  { id: 'home', labelKey: 'nav.home', icon: Home },
  { id: 'rooms', labelKey: 'nav.rooms', icon: Users },
  { id: 'rankings', labelKey: 'nav.rankings', icon: Trophy },
  { id: 'achievements', labelKey: 'nav.prizes', icon: Award },
  { id: 'profile', labelKey: 'nav.profile', icon: User },
];

export function TabBar({ active }: { active: string }) {
  const navigate = useApp((s) => s.navigate);
  const { t } = useI18n();

  return (
    <nav
      className="sticky bottom-0 z-30 w-full max-w-2xl mx-auto bg-background/95 backdrop-blur-sm border-t border-border"
      aria-label="Navegação principal"
    >
      <div className="grid grid-cols-5 px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {REAL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.labelKey}
              type="button"
              onClick={() => navigate(tab.id)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors',
                'min-h-[44px]',
                isActive ? 'text-p1' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={t(tab.labelKey)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className={cn(
                'text-[10px] transition-all',
                isActive ? 'font-semibold' : 'font-medium',
              )}>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
