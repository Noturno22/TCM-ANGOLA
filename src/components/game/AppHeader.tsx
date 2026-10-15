'use client';

import { ChevronLeft, Bell, Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '@/store/app';
import { useProfile } from '@/store/profile';
import { useNotifications } from '@/store/notifications';
import { BalancePill, GameLogo } from './ui';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/hook';

const SCREEN_TITLES: Record<string, string> = {
  'offline-select': 'mode.title',
  tutorial: 'nav.tutorial',
  'how-to-play': 'settings.how_to_play',
  about: 'settings.about',
  settings: 'settings.account',
  wallet: 'nav.wallet',
  replay: 'nav.replay',
  achievements: 'profile.achievements',
  challenge: 'nav.challenge',
  stats: 'profile.stats',
  share: 'nav.share',
  'import-match': 'nav.import',
  lightning: 'nav.lightning',
  watch: 'nav.watch',
  campaign: 'nav.campaign',
  'campaign-play': 'nav.campaign',
  notifications: 'nav.notifications',
};

export function AppHeader() {
  const screen = useApp((s) => s.screen);
  const back = useApp((s) => s.back);
  const navigate = useApp((s) => s.navigate);
  const coins = useProfile((s) => s.coins);
  const unread = useNotifications((s) => s.unread);
  const { t } = useI18n();

  const titleKey = SCREEN_TITLES[screen] ?? '';
  const title = titleKey ? t(titleKey) : '';

  return (
    <header className="sticky top-0 z-30 w-full max-w-2xl mx-auto bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={back}
            className="rounded-lg h-9 w-9 shrink-0"
            aria-label={t('nav.back')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          {screen === 'home' ? <GameLogo size="sm" /> : null}
          <h1 className="text-lg font-semibold truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <BalancePill coins={coins} onClick={() => navigate('wallet')} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('notifications')}
            className="rounded-lg h-9 w-9 relative"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-p2 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('settings')}
            className="rounded-lg h-9 w-9"
            aria-label={t('settings.account')}
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
