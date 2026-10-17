'use client';

import { useEffect } from 'react';
import {
  Bell,
  BellRing,
  UserPlus,
  UserCheck,
  Trophy,
  Check,
  X,
  Crown,
  Gift,
  TrendingUp,
  Swords,
  Trash2,
  CheckCheck,
  Loader2,
  Info,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { useApp, type Screen } from '@/store/app';
import { useNotifications } from '@/store/notifications';
import { useAuth } from '@/store/auth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { GameButton, GameCard } from '@/components/game/ui';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationKind } from '@/lib/online/notifications';

const ICONS: Record<string, LucideIcon> = {
  welcome: Gift,
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  match_win: Trophy,
  match_loss: Swords,
  match_draw: Check,
  tournament_started: Trophy,
  tournament_advance: TrendingUp,
  tournament_eliminated: X,
  tournament_champion: Crown,
};

const TONES: Record<string, string> = {
  match_win: 'bg-p1/12 text-p1',
  friend_accepted: 'bg-p1/12 text-p1',
  tournament_advance: 'bg-p1/12 text-p1',
  tournament_champion: 'bg-gold/12 text-gold',
  welcome: 'bg-gold/12 text-gold',
  friend_request: 'bg-gold/12 text-gold',
  match_loss: 'bg-p2/12 text-p2',
  tournament_eliminated: 'bg-p2/12 text-p2',
};

function iconFor(kind: NotificationKind): LucideIcon {
  return ICONS[kind] ?? Bell;
}

function toneFor(kind: NotificationKind): string {
  return TONES[kind] ?? 'bg-surface-2 text-muted-foreground';
}

/** Destino ao clicar numa notificação. */
function destinationFor(n: AppNotification): Screen {
  if (n.kind.startsWith('friend_')) return 'friends';
  if (n.kind.startsWith('tournament_')) return 'tournament';
  if (n.kind.startsWith('match_')) return 'profile';
  return 'home';
}

/** Tempo relativo curto em PT (ex.: "há 5 min"). */
function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(then).toLocaleDateString('pt-PT');
}

export function NotificationsScreen() {
  const navigate = useApp((s) => s.navigate);
  const isAuthed = useAuth((s) => Boolean(s.user));

  const loaded = useNotifications((s) => s.loaded);
  const loading = useNotifications((s) => s.loading);
  const items = useNotifications((s) => s.items);
  const unread = useNotifications((s) => s.unread);
  const load = useNotifications((s) => s.load);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const remove = useNotifications((s) => s.remove);

  const canUse = isSupabaseConfigured && isAuthed;

  useEffect(() => {
    if (!canUse) return;
    void load();
  }, [canUse, load]);

  const handleOpen = (n: AppNotification) => {
    if (!n.read) void markRead(n.id);
    navigate(destinationFor(n));
  };

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-wide">NOTIFICAÇÕES</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resultados, pedidos de amizade e torneios.
          </p>
        </div>
        {canUse && unread > 0 && (
          <GameButton
            variant="ghost"
            className="h-9 px-3 text-xs shrink-0"
            onClick={() => void markAllRead()}
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            Ler todas
          </GameButton>
        )}
      </div>

      {/* Estado online / offline */}
      <div
        className={cn(
          'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-xs leading-relaxed',
          canUse ? 'bg-p1/10 border-p1/30 text-p1' : 'bg-orange/10 border-orange/30 text-orange',
        )}
      >
        {canUse ? (
          <Wifi className="w-4 h-4 shrink-0 mt-0.5" />
        ) : (
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
        )}
        <p>
          {canUse ? (
            <>
              <strong>A sincronizar.</strong> As notificações novas aparecem aqui em tempo real.
            </>
          ) : (
            <>
              <strong>Inicia sessão para usar notificações.</strong> Precisas de uma conta para as
              receber.
            </>
          )}
        </p>
      </div>

      {canUse && unread > 0 && (
        <p className="text-[11px] text-gold font-semibold px-1">
          {unread} {unread === 1 ? 'por ler' : 'por ler'}
        </p>
      )}

      {items.length === 0 ? (
        <GameCard className="p-8 text-center">
          {canUse ? <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" /> : <BellRing className="w-8 h-8 text-muted-foreground mx-auto mb-2" />}
          <p className="text-sm text-muted-foreground">
            {canUse
              ? loaded
                ? 'Ainda não tens notificações.'
                : 'A carregar notificações…'
              : 'Inicia sessão para ver as tuas notificações.'}
          </p>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto mt-3" />}
        </GameCard>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = iconFor(n.kind);
            const tone = toneFor(n.kind);
            return (
              <GameCard
                key={n.id}
                className={cn('p-3 flex items-center gap-3', !n.read && 'border-gold/40')}
              >
                <button
                  type="button"
                  onClick={() => handleOpen(n)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tone)}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{n.title}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-gold shrink-0" />}
                    </span>
                    {n.body && (
                      <span className="block text-xs text-muted-foreground truncate">{n.body}</span>
                    )}
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      {relativeTime(n.createdAt)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(n.id)}
                  className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-muted-foreground shrink-0"
                  aria-label="Apagar notificação"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </GameCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
