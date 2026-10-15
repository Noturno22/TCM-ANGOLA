/**
 * Online — Fase 1: salas, ocupação e chat (Supabase).
 *
 * Todas as funções degradam de forma graciosa: se o backend não estiver
 * configurado, não houver sessão autenticada ou ocorrer um erro, devolvem
 * `null` para que a UI use os dados simulados existentes.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export type RoomRegion = 'national' | 'international';

export interface RoomSummary {
  id: string;
  name: string;
  region: RoomRegion;
  capacity: number;
  /** Aposta em KZ virtual (0 = gratuita). */
  stake: number;
  isFeatured: boolean;
  sortOrder: number;
}

export interface ChatMessage {
  id: number;
  roomId: string;
  userId: string | null;
  author: string;
  body: string;
  kind: 'user' | 'announcement';
  createdAt: string;
}

export interface OnlinePlayer {
  userId: string;
  name: string;
  /** Nível e Elo vêm do perfil público (podem faltar). */
  level: number;
  elo: number;
}

/** Devolve o cliente Supabase ou `null` quando não está configurado. */
function client(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient();
}

/**
 * Converte uma linha de `rooms` num `RoomSummary`. Função pura (testável).
 * Assume `national` quando a coluna `region` não vem (migração 0005).
 */
export function mapRoomRow(row: Record<string, unknown>): RoomSummary {
  return {
    id: row.id as string,
    name: row.name as string,
    region: row.region === 'international' ? 'international' : 'national',
    capacity: (row.capacity as number) ?? 0,
    stake: (row.stake as number) ?? 0,
    isFeatured: Boolean(row.is_featured),
    sortOrder: (row.sort_order as number) ?? 0,
  };
}

/** Lista o catálogo de salas. `null` em caso de erro/indisponível. */
export async function fetchRooms(): Promise<RoomSummary[] | null> {
  const sb = client();
  if (!sb) return null;

  const withRegion = await sb
    .from('rooms')
    .select('id, name, region, capacity, stake, is_featured, sort_order')
    .order('sort_order', { ascending: true });
  if (!withRegion.error && withRegion.data) {
    return withRegion.data.map((r) => mapRoomRow(r as Record<string, unknown>));
  }

  // Compatibilidade com a migração 0005 (sem coluna `region`).
  const legacy = await sb
    .from('rooms')
    .select('id, name, capacity, stake, is_featured, sort_order')
    .order('sort_order', { ascending: true });
  if (legacy.error || !legacy.data) return null;
  return legacy.data.map((r) => mapRoomRow(r as Record<string, unknown>));
}

/** Últimas mensagens de uma sala, ordenadas da mais antiga para a mais nova. */
export async function fetchRecentMessages(
  roomId: string,
  limit = 40,
): Promise<ChatMessage[] | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb
    .from('messages')
    .select('id, room_id, user_id, body, kind, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error || !data) return null;

  const rows = [...data].reverse();
  const names = await fetchUsernames(rows.map((r) => r.user_id as string));
  return rows.map((r) => toMessage(r, names));
}

/** Envia uma mensagem na sala. `null` em caso de erro. */
export async function sendChatMessage(
  roomId: string,
  body: string,
): Promise<ChatMessage | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb.rpc('send_message', { p_room_id: roomId, p_body: body });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  const names = await fetchUsernames([row.user_id as string]);
  return toMessage(row, names);
}

/** Mapa userId → username via `profiles`. Devolve {} em caso de erro. */
export async function fetchUsernames(
  userIds: readonly (string | null)[],
): Promise<Record<string, string>> {
  const sb = client();
  if (!sb) return {};
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return {};
  const { data, error } = await sb.from('profiles').select('id, username').in('id', ids);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const p of data) {
    if (p.username) map[p.id as string] = p.username as string;
  }
  return map;
}

/** Perfis públicos (nível/elo) para a lista de jogadores online. */
export async function fetchProfiles(
  userIds: readonly string[],
): Promise<Record<string, { username: string | null; level: number; elo: number }>> {
  const sb = client();
  if (!sb) return {};
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return {};
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, level, elo')
    .in('id', ids);
  if (error || !data) return {};
  const map: Record<string, { username: string | null; level: number; elo: number }> = {};
  for (const p of data) {
    map[p.id as string] = {
      username: (p.username as string | null) ?? null,
      level: (p.level as number) ?? 1,
      elo: (p.elo as number) ?? 1000,
    };
  }
  return map;
}

/** Subscreve as novas mensagens de uma sala. Devolve o canal ou `null`. */
export function subscribeRoomMessages(
  roomId: string,
  onInsert: (msg: ChatMessage) => void,
): RealtimeChannel | null {
  const sb = client();
  if (!sb) return null;
  const channel = sb
    .channel(`room-messages:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      async (payload) => {
        const row = payload.new as Record<string, unknown>;
        const names = await fetchUsernames([row.user_id as string]);
        onInsert(toMessage(row, names));
      },
    )
    .subscribe();
  return channel;
}

/** Presença numa sala (jogadores online). Devolve o canal ou `null`. */
export function subscribeRoomPresence(
  roomId: string,
  self: OnlinePlayer,
  onChange: (players: OnlinePlayer[]) => void,
): RealtimeChannel | null {
  const sb = client();
  if (!sb) return null;
  const channel = sb.channel(`room-presence:${roomId}`, {
    config: { presence: { key: self.userId } },
  });

  const emit = async () => {
    const state = channel.presenceState() as Record<
      string,
      Array<{ userId: string; name: string; level: number; elo: number }>
    >;
    const players = Object.values(state)
      .flat()
      .map((p) => ({ userId: p.userId, name: p.name, level: p.level, elo: p.elo }));
    onChange(players);
  };

  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(self);
      }
    });

  return channel;
}

/** Remove um canal (unsubscribe) com segurança. */
export function unsubscribeChannel(channel: RealtimeChannel | null): void {
  if (channel) void channel.unsubscribe();
}

interface MessageRow {
  id: number;
  room_id: string;
  user_id: string | null;
  body: string;
  kind: string;
  created_at: string;
}

function toMessage(row: Record<string, unknown>, names: Record<string, string>): ChatMessage {
  return mapMessageRow(row, names);
}

/**
 * Converte uma linha de `messages` num `ChatMessage` apresentável.
 * Função pura (exportada para testes): resolve o autor a partir do mapa
 * de usernames, com fallback para anúncio/anónimo/prefixo do id.
 */
export function mapMessageRow(
  row: Record<string, unknown>,
  names: Record<string, string> = {},
): ChatMessage {
  const r = row as unknown as MessageRow;
  const userId = r.user_id ?? null;
  const author =
    r.kind === 'announcement'
      ? 'Anúncio'
      : (userId && names[userId]) || (userId ? `Jogador ${userId.slice(0, 4)}` : 'Anónimo');
  return {
    id: r.id,
    roomId: r.room_id,
    userId,
    author,
    body: r.body,
    kind: r.kind === 'announcement' ? 'announcement' : 'user',
    createdAt: r.created_at,
  };
}
