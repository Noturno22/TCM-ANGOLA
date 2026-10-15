/**
 * Online — Fase 3: notificações (Supabase).
 *
 * As notificações vivem em `public.notifications` e são criadas pelo servidor
 * (triggers). O cliente só LÊ as suas e usa as RPCs `mark_notification_read`,
 * `mark_all_notifications_read` e `delete_notification`. Como nas fases
 * anteriores, tudo degrada de forma graciosa: sem backend/sessão as funções
 * devolvem `null`/`[]`/`false`.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { unsubscribeChannel } from '@/lib/online/match';

export type NotificationKind =
  | 'welcome'
  | 'friend_request'
  | 'friend_accepted'
  | 'match_win'
  | 'match_loss'
  | 'match_draw'
  | 'tournament_started'
  | 'tournament_advance'
  | 'tournament_eliminated'
  | 'tournament_champion'
  | string;

/** Notificação já pronta para apresentar. */
export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

/** Converte a linha de `notifications` num `AppNotification`. Pura (testável). */
export function mapNotificationRow(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    kind: (row.kind as NotificationKind) ?? 'unknown',
    title: (row.title as string) ?? '',
    body: (row.body as string | null) ?? null,
    data: (row.data as Record<string, unknown>) ?? {},
    read: (row.read as boolean) ?? false,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

/** Número de notificações por ler. Pura (testável). */
export function unreadCount(items: readonly AppNotification[]): number {
  return items.reduce((n, it) => (it.read ? n : n + 1), 0);
}

/**
 * Alguns tipos merecem um toast imediato (feedback de alto sinal); os
 * resultados de partida aparecem no ecrã e não precisam de toast intrusivo.
 * Pura (testável).
 */
export function isToastWorthy(kind: NotificationKind): boolean {
  return (
    kind === 'friend_request' ||
    kind === 'friend_accepted' ||
    kind === 'tournament_started' ||
    kind === 'tournament_champion'
  );
}

function client(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient();
}

const NOTIFICATION_COLUMNS = 'id, user_id, kind, title, body, data, read, created_at';

/** Notificações do próprio (mais recentes primeiro). `null` em erro. */
export async function fetchNotifications(limit = 50): Promise<AppNotification[] | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return null;
  return data.map((r) => mapNotificationRow(r as Record<string, unknown>));
}

/** Marca uma notificação como lida. */
export async function markNotificationRead(id: string): Promise<boolean> {
  const sb = client();
  if (!sb) return false;
  const { error } = await sb.rpc('mark_notification_read', { p_id: id });
  return !error;
}

/** Marca todas as notificações como lidas. */
export async function markAllNotificationsRead(): Promise<boolean> {
  const sb = client();
  if (!sb) return false;
  const { error } = await sb.rpc('mark_all_notifications_read');
  return !error;
}

/** Apaga uma notificação do utilizador. */
export async function deleteNotification(id: string): Promise<boolean> {
  const sb = client();
  if (!sb) return false;
  const { error } = await sb.rpc('delete_notification', { p_id: id });
  return !error;
}

/**
 * Subscreve alterações a `notifications` (RLS limita às linhas do próprio).
 * `onInsert` recebe as novas notificações; `onChange` é chamado a cada
 * alteração (para recarregar a lista).
 */
export function subscribeToNotifications({
  onInsert,
  onChange,
}: {
  onInsert?: (n: AppNotification) => void;
  onChange?: () => void;
}): RealtimeChannel | null {
  const sb = client();
  if (!sb) return null;
  return sb
    .channel('my-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (payload) => onInsert?.(mapNotificationRow(payload.new as Record<string, unknown>)),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      () => onChange?.(),
    )
    .subscribe();
}

/** Remove um canal com segurança. */
export function unsubscribeNotificationsChannel(channel: RealtimeChannel | null): void {
  unsubscribeChannel(channel);
}
