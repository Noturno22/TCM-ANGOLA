/**
 * Online — Fase 3: amizades (Supabase).
 *
 * Pedidos de amizade vivem em `public.friendships`. O cliente nunca escreve
 * diretamente: usa as RPCs `send_friend_request`, `respond_friend_request` e
 * `remove_friend`. Tal como nas fases anteriores, tudo degrada de forma
 * graciosa: sem backend/sessão as funções devolvem `null`/`[]`/`{ ok:false }`.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export type FriendshipStatus = 'pending' | 'accepted';
export type FriendDirection = 'incoming' | 'outgoing';

/** Linha de `friendships` já orientada em relação a "mim". */
export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  /** O outro lado (nunca sou eu). */
  otherId: string;
  /** `incoming` = recebi o pedido; `outgoing` = enviei-o. */
  direction: FriendDirection;
  createdAt: string;
  updatedAt: string;
}

/** Dados públicos de um jogador relevantes para amizades. */
export interface FriendInfo {
  userId: string;
  username: string | null;
  avatar: string;
  level: number;
  elo: number;
}

/** Amizade aceite, pronta para apresentar. */
export interface Friend extends FriendInfo {
  friendshipId: string;
  since: string;
}

/** Pedido de amizade pendente (recebido ou enviado). */
export interface FriendRequest extends FriendInfo {
  friendshipId: string;
  direction: FriendDirection;
  createdAt: string;
}

export type FriendRequestResult =
  | { ok: true; status: 'requested' | 'accepted' | 'already_friends' | 'already_requested' }
  | { ok: false; code: FriendErrorCode };

export type FriendErrorCode =
  | 'not_authenticated'
  | 'unknown_user'
  | 'cannot_add_self'
  | 'unknown_request'
  | 'not_a_participant'
  | 'unknown';

const KNOWN_ERROR_CODES: FriendErrorCode[] = [
  'not_authenticated',
  'unknown_user',
  'cannot_add_self',
  'unknown_request',
  'not_a_participant',
];

/** Extrai um código de erro conhecido da mensagem (ou null). */
export function parseFriendErrorCode(
  message: string | null | undefined,
): FriendErrorCode | null {
  if (!message) return null;
  const m = message.toLowerCase();
  for (const code of KNOWN_ERROR_CODES) {
    if (m.includes(code)) return code;
  }
  return null;
}

/** Orientação genérica de uma amizade em relação ao observador. */
export function mapFriendshipRow(
  row: Record<string, unknown>,
  meId: string,
): Friendship {
  const requesterId = row.requester_id as string;
  const addresseeId = row.addressee_id as string;
  const outgoing = requesterId === meId;
  return {
    id: row.id as string,
    requesterId,
    addresseeId,
    status: (row.status as FriendshipStatus) ?? 'pending',
    otherId: outgoing ? addresseeId : requesterId,
    direction: outgoing ? 'outgoing' : 'incoming',
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

/** Junta uma amizade a um perfil público para apresentação. */
export function toFriend(
  f: Friendship,
  info: FriendInfo | undefined,
  fallbackName: string | null = null,
): Friend {
  return {
    friendshipId: f.id,
    since: f.updatedAt,
    userId: f.otherId,
    username: info?.username ?? fallbackName,
    avatar: info?.avatar ?? '🦁',
    level: info?.level ?? 1,
    elo: info?.elo ?? 1000,
  };
}

/** Junta um pedido pendente a um perfil público para apresentação. */
export function toFriendRequest(
  f: Friendship,
  info: FriendInfo | undefined,
  fallbackName: string | null = null,
): FriendRequest {
  return {
    friendshipId: f.id,
    direction: f.direction,
    createdAt: f.createdAt,
    userId: f.otherId,
    username: info?.username ?? fallbackName,
    avatar: info?.avatar ?? '🦁',
    level: info?.level ?? 1,
    elo: info?.elo ?? 1000,
  };
}

function client(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient();
}

async function currentUserId(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

const FRIENDSHIP_COLUMNS = 'id, requester_id, addressee_id, status, created_at, updated_at';

/** Perfis públicos por id (username/avatar/level/elo). {} em caso de erro. */
export async function fetchFriendProfiles(
  userIds: readonly string[],
): Promise<Record<string, FriendInfo>> {
  const sb = client();
  if (!sb) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, avatar, level, elo')
    .in('id', ids);
  if (error || !data) return {};
  const map: Record<string, FriendInfo> = {};
  for (const p of data) {
    map[p.id as string] = {
      userId: p.id as string,
      username: (p.username as string | null) ?? null,
      avatar: (p.avatar as string) ?? '🦁',
      level: (p.level as number) ?? 1,
      elo: (p.elo as number) ?? 1000,
    };
  }
  return map;
}

/** Todas as minhas amizades/pedidos orientados para mim. `null` em erro. */
export async function fetchMyFriendships(): Promise<Friendship[] | null> {
  const sb = client();
  if (!sb) return null;
  const uid = await currentUserId(sb);
  if (!uid) return null;
  const { data, error } = await sb
    .from('friendships')
    .select(FRIENDSHIP_COLUMNS)
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
    .order('updated_at', { ascending: false });
  if (error || !data) return null;
  return data.map((r) => mapFriendshipRow(r as Record<string, unknown>, uid));
}

export interface FriendsOverview {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

/** Amizades e pedidos pendentes já juntos com os perfis públicos. */
export async function fetchFriendsOverview(): Promise<FriendsOverview | null> {
  const rows = await fetchMyFriendships();
  if (!rows) return null;

  const profiles = await fetchFriendProfiles(rows.map((r) => r.otherId));
  const friends: Friend[] = [];
  const incoming: FriendRequest[] = [];
  const outgoing: FriendRequest[] = [];

  for (const f of rows) {
    const info = profiles[f.otherId];
    if (f.status === 'accepted') {
      friends.push(toFriend(f, info));
    } else if (f.direction === 'incoming') {
      incoming.push(toFriendRequest(f, info));
    } else {
      outgoing.push(toFriendRequest(f, info));
    }
  }

  friends.sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''));
  return { friends, incoming, outgoing };
}

/** Procura um perfil por username exato. `null` se não existir/erro. */
export async function findProfileByUsername(
  username: string,
): Promise<FriendInfo | null> {
  const sb = client();
  if (!sb) return null;
  const name = username.trim();
  if (name.length === 0) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, avatar, level, elo')
    .ilike('username', name)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    userId: data.id as string,
    username: (data.username as string | null) ?? null,
    avatar: (data.avatar as string) ?? '🦁',
    level: (data.level as number) ?? 1,
    elo: (data.elo as number) ?? 1000,
  };
}

/** Envia um pedido de amizade pelo id do utilizador. */
export async function sendFriendRequest(userId: string): Promise<FriendRequestResult> {
  const sb = client();
  if (!sb) return { ok: false, code: 'unknown' };
  const { data, error } = await sb.rpc('send_friend_request', { p_user_id: userId });
  if (error) return { ok: false, code: parseFriendErrorCode(error.message) ?? 'unknown' };
  const status = (data as { status?: string } | null)?.status;
  if (
    status === 'requested' ||
    status === 'accepted' ||
    status === 'already_friends' ||
    status === 'already_requested'
  ) {
    return { ok: true, status };
  }
  return { ok: false, code: 'unknown' };
}

/** Envia um pedido de amizade procurando primeiro o username. */
export async function sendFriendRequestByUsername(
  username: string,
): Promise<FriendRequestResult> {
  const target = await findProfileByUsername(username);
  if (!target) return { ok: false, code: 'unknown_user' };
  return sendFriendRequest(target.userId);
}

/** Aceita (ou recusa) um pedido recebido. */
export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<boolean> {
  const sb = client();
  if (!sb) return false;
  const { error } = await sb.rpc('respond_friend_request', {
    p_id: friendshipId,
    p_accept: accept,
  });
  return !error;
}

/** Remove uma amizade ou cancela um pedido enviado. */
export async function removeFriend(userId: string): Promise<boolean> {
  const sb = client();
  if (!sb) return false;
  const { error } = await sb.rpc('remove_friend', { p_user_id: userId });
  return !error;
}

/** Subscreve mudanças em `friendships` (RLS limita às minhas linhas). */
export function subscribeToFriendships(onChange: () => void): RealtimeChannel | null {
  const sb = client();
  if (!sb) return null;
  return sb
    .channel('my-friendships')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () =>
      onChange(),
    )
    .subscribe();
}

/** Remove um canal com segurança. */
export function unsubscribeFriendsChannel(channel: RealtimeChannel | null): void {
  if (channel) void channel.unsubscribe();
}
