/**
 * Store de amizades (Fase 3) — lista, pedidos pendentes e ações.
 *
 * Sem backend configurado ou sem sessão, `enabled` fica `false` e a UI
 * mantém um estado vazio em vez de rebentar.
 */
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  fetchFriendsOverview,
  removeFriend,
  respondFriendRequest,
  sendFriendRequestByUsername,
  subscribeToFriendships,
  unsubscribeFriendsChannel,
  type Friend,
  type FriendRequest,
  type FriendRequestResult,
} from '@/lib/online/friends';

interface FriendsStore {
  /** Backend configurado (Supabase). */
  enabled: boolean;
  loaded: boolean;
  loading: boolean;
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];

  load: () => Promise<void>;
  /** Envia um pedido de amizade a partir do username. */
  requestByUsername: (username: string) => Promise<FriendRequestResult>;
  accept: (friendshipId: string) => Promise<void>;
  decline: (friendshipId: string) => Promise<void>;
  remove: (userId: string) => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
}

let channel: RealtimeChannel | null = null;

export const useFriends = create<FriendsStore>((set, get) => ({
  enabled: isSupabaseConfigured,
  loaded: false,
  loading: false,
  friends: [],
  incoming: [],
  outgoing: [],

  load: async () => {
    if (!isSupabaseConfigured) return;
    set({ loading: true });
    const overview = await fetchFriendsOverview();
    if (overview) {
      set({
        friends: overview.friends,
        incoming: overview.incoming,
        outgoing: overview.outgoing,
        loaded: true,
        loading: false,
      });
    } else {
      set({ loading: false });
    }
  },

  requestByUsername: async (username) => {
    const result = await sendFriendRequestByUsername(username);
    if (result.ok) await get().load();
    return result;
  },

  accept: async (friendshipId) => {
    if (await respondFriendRequest(friendshipId, true)) await get().load();
  },

  decline: async (friendshipId) => {
    if (await respondFriendRequest(friendshipId, false)) await get().load();
  },

  remove: async (userId) => {
    if (await removeFriend(userId)) await get().load();
  },

  subscribe: () => {
    if (!isSupabaseConfigured || channel) return;
    channel = subscribeToFriendships(() => {
      void get().load();
    });
  },

  unsubscribe: () => {
    unsubscribeFriendsChannel(channel);
    channel = null;
  },
}));
