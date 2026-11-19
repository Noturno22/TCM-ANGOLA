/**
 * Notificações — port 1:1 de `NotificationsScreen` (web).
 */
import { router } from 'expo-router';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Crown,
  Gift,
  Info,
  Swords,
  Trash2,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { GameButton, GameCard } from '@/components/game/ui';
import { TiraScreen } from '@/components/tira';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { AppNotification, NotificationKind } from '@/lib/online/notifications';
import { useAuth } from '@/store/auth';
import { useNotifications } from '@/store/notifications';
import { useOnlineTournaments } from '@/store/onlineTournaments';
import { colors, radii, spacing, typography } from '@/theme';

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
  tournament_invite: UserPlus,
};

const TONES: Record<string, { bg: string; fg: string }> = {
  match_win: { bg: 'rgba(16, 178, 90, 0.12)', fg: colors.p1 },
  friend_accepted: { bg: 'rgba(16, 178, 90, 0.12)', fg: colors.p1 },
  tournament_advance: { bg: 'rgba(16, 178, 90, 0.12)', fg: colors.p1 },
  tournament_champion: { bg: 'rgba(242, 176, 30, 0.12)', fg: colors.gold },
  tournament_invite: { bg: 'rgba(242, 176, 30, 0.12)', fg: colors.gold },
  welcome: { bg: 'rgba(242, 176, 30, 0.12)', fg: colors.gold },
  friend_request: { bg: 'rgba(242, 176, 30, 0.12)', fg: colors.gold },
  match_loss: { bg: 'rgba(215, 20, 27, 0.12)', fg: colors.p2 },
  tournament_eliminated: { bg: 'rgba(215, 20, 27, 0.12)', fg: colors.p2 },
};

function iconFor(kind: NotificationKind): LucideIcon {
  return ICONS[kind] ?? Bell;
}

function toneFor(kind: NotificationKind) {
  return TONES[kind] ?? { bg: colors.surfaceAlt, fg: colors.textMuted };
}

function destinationFor(n: AppNotification): string {
  if (n.kind.startsWith('friend_')) return '/friends';
  if (n.kind.startsWith('tournament_')) return '/tournament';
  if (n.kind.startsWith('match_')) return '/profile';
  return '/';
}

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

export default function NotificationsScreen() {
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

  useEffect(() => {
    if (!canUse) return;
    return () => {
      void markAllRead();
    };
  }, [canUse, markAllRead]);

  const handleOpen = (n: AppNotification) => {
    if (!n.read) void markRead(n.id);
    if (n.kind === 'tournament_invite') {
      const tournamentId =
        typeof n.data.tournament_id === 'string' ? n.data.tournament_id : null;
      if (tournamentId && useOnlineTournaments.getState().enabled) {
        router.push('/tournament');
        void useOnlineTournaments.getState().open(tournamentId);
        return;
      }
    }
    router.push(destinationFor(n) as never);
  };

  return (
    <TiraScreen style={{ gap: spacing[5], paddingBottom: 24 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: spacing[3],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: typography.fontFamily.display,
              fontSize: 33.75,
              letterSpacing: 0.844,
              color: colors.text,
            }}
          >
            NOTIFICAÇÕES
          </Text>
          <Text
            style={{
              fontSize: 15.75,
              color: colors.textMuted,
              marginTop: 4,
              fontFamily: typography.fontFamily.body,
            }}
          >
            Resultados, pedidos de amizade e torneios.
          </Text>
        </View>
        {canUse && unread > 0 ? (
          <GameButton
            variant="ghost"
            style={{ height: 48, paddingHorizontal: spacing[3] }}
            textStyle={{ fontSize: 13.5 }}
            onPress={() => void markAllRead()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CheckCheck size={16} color={colors.text} />
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text,
                  fontFamily: typography.fontFamily.body,
                }}
              >
                Ler todas
              </Text>
            </View>
          </GameButton>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          paddingHorizontal: spacing[3],
          paddingVertical: 10,
          borderRadius: radii.xl,
          borderWidth: 1,
          backgroundColor: canUse ? 'rgba(16, 178, 90, 0.10)' : 'rgba(232, 131, 12, 0.10)',
          borderColor: canUse ? 'rgba(16, 178, 90, 0.30)' : 'rgba(232, 131, 12, 0.30)',
        }}
      >
        {canUse ? (
          <Wifi size={16} color={colors.p1} />
        ) : (
          <Info size={16} color={colors.orange} />
        )}
        <Text
          style={{
            flex: 1,
            fontSize: 13.5,
            lineHeight: 18,
            color: canUse ? colors.p1 : colors.orange,
            fontFamily: typography.fontFamily.body,
          }}
        >
          {canUse ? 'A sincronizar. As notificações novas aparecem aqui em tempo real.' : 'Inicia sessão para usar notificações. Precisas de uma conta para as receber.'}
        </Text>
      </View>

      {canUse && unread > 0 ? (
        <Text
          style={{
            fontSize: 11,
            fontWeight: typography.fontWeight.semibold,
            color: colors.gold,
            paddingHorizontal: spacing[1],
            fontFamily: typography.fontFamily.body,
          }}
        >
          {unread} por ler
        </Text>
      ) : null}

      {items.length === 0 ? (
        <GameCard style={{ padding: spacing[8], alignItems: 'center' }}>
          {canUse ? (
            <Bell size={32} color={colors.textMuted} style={{ marginBottom: spacing[2] }} />
          ) : (
            <BellRing size={32} color={colors.textMuted} style={{ marginBottom: spacing[2] }} />
          )}
          <Text
            style={{
              fontSize: 15.75,
              color: colors.textMuted,
              textAlign: 'center',
              fontFamily: typography.fontFamily.body,
            }}
          >
            {canUse
              ? loaded
                ? 'Ainda não tens notificações.'
                : 'A carregar notificações…'
              : 'Inicia sessão para ver as tuas notificações.'}
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.textMuted} style={{ marginTop: spacing[3] }} />
          ) : null}
        </GameCard>
      ) : (
        <View style={{ gap: spacing[2] }}>
          {items.map((n) => {
            const Icon = iconFor(n.kind);
            const tone = toneFor(n.kind);
            return (
              <GameCard
                key={n.id}
                glow={!n.read ? 'gold' : null}
                style={{
                  padding: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleOpen(n)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1, minWidth: 0 }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radii.xl,
                      backgroundColor: tone.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} color={tone.fg} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 15.75,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.text,
                          fontFamily: typography.fontFamily.body,
                          flexShrink: 1,
                        }}
                      >
                        {n.title}
                      </Text>
                      {!n.read ? (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: radii.pill,
                            backgroundColor: colors.gold,
                          }}
                        />
                      ) : null}
                    </View>
                    {n.body ? (
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 13.5,
                          color: colors.textMuted,
                          fontFamily: typography.fontFamily.body,
                        }}
                      >
                        {n.body}
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        marginTop: 2,
                        fontFamily: typography.fontFamily.body,
                      }}
                    >
                      {relativeTime(n.createdAt)}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Apagar notificação"
                  onPress={() => void remove(n.id)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radii.lg,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={16} color={colors.textMuted} />
                </Pressable>
              </GameCard>
            );
          })}
        </View>
      )}
    </TiraScreen>
  );
}
