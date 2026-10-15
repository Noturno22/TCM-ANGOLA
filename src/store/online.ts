/**
 * Store online (Fase 1) — sala ativa, presença e chat em tempo real.
 *
 * Quando o backend não está configurado ou não há sessão, `enabled` fica
 * `false` e a UI mantém os dados simulados existentes.
 */
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth } from '@/store/auth';
import {
  fetchRecentMessages,
  fetchRooms,
  sendChatMessage,
  subscribeRoomMessages,
  subscribeRoomPresence,
  unsubscribeChannel,
  type ChatMessage,
  type OnlinePlayer,
  type RoomSummary,
} from '@/lib/online/rooms';

interface OnlineStore {
  /** Backend configurado (Supabase). */
  enabled: boolean;
  rooms: RoomSummary[];
  /** Sala com presença/chat subscritos. */
  activeRoomId: string | null;
  players: OnlinePlayer[];
  messages: ChatMessage[];
  loadingRoom: boolean;

  loadRooms: () => Promise<void>;
  enterRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  sendMessage: (body: string) => Promise<boolean>;
}

/** Canais Realtime fora do estado (não serializáveis). */
let messagesChannel: RealtimeChannel | null = null;
let presenceChannel: RealtimeChannel | null = null;

/** Constrói o jogador "eu" a partir da sessão autenticada + perfil local. */
function selfPlayer(): OnlinePlayer | null {
  const user = useAuth.getState().user;
  if (!user) return null;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const name =
    (meta?.full_name as string) ||
    (meta?.name as string) ||
    user.email?.split('@')[0] ||
    user.phone ||
    'Tu';
  return { userId: user.id, name, level: 1, elo: 1000 };
}

export const useOnline = create<OnlineStore>((set, get) => ({
  enabled: isSupabaseConfigured,
  rooms: [],
  activeRoomId: null,
  players: [],
  messages: [],
  loadingRoom: false,

  loadRooms: async () => {
    const rooms = await fetchRooms();
    if (rooms && rooms.length > 0) set({ rooms });
  },

  enterRoom: async (roomId) => {
    if (!isSupabaseConfigured) return;
    if (get().activeRoomId === roomId) return;
    get().leaveRoom();

    set({ activeRoomId: roomId, messages: [], players: [], loadingRoom: true });

    const recent = await fetchRecentMessages(roomId);
    // Ignora se entretanto mudámos de sala.
    if (get().activeRoomId !== roomId) return;
    set({ messages: recent ?? [], loadingRoom: false });

    subscribeRoomMessagesSafely(roomId, (msg) => {
      set((s) =>
        s.messages.some((m) => m.id === msg.id)
          ? s
          : { messages: [...s.messages, msg].slice(-100) },
      );
    });

    const self = selfPlayer();
    if (self) {
      subscribeRoomPresenceSafely(roomId, self, (players) => {
        if (get().activeRoomId === roomId) set({ players });
      });
    }
  },

  leaveRoom: () => {
    unsubscribeChannel(messagesChannel);
    unsubscribeChannel(presenceChannel);
    messagesChannel = null;
    presenceChannel = null;
    set({ activeRoomId: null, players: [], messages: [], loadingRoom: false });
  },

  sendMessage: async (body) => {
    const roomId = get().activeRoomId;
    const text = body.trim();
    if (!roomId || text.length === 0) return false;
    const msg = await sendChatMessage(roomId, text);
    if (!msg) return false;
    set((s) =>
      s.messages.some((m) => m.id === msg.id) ? s : { messages: [...s.messages, msg].slice(-100) },
    );
    return true;
  },
}));

function subscribeRoomMessagesSafely(
  roomId: string,
  onInsert: (msg: ChatMessage) => void,
): void {
  unsubscribeChannel(messagesChannel);
  messagesChannel = subscribeRoomMessages(roomId, onInsert);
}

function subscribeRoomPresenceSafely(
  roomId: string,
  self: OnlinePlayer,
  onChange: (players: OnlinePlayer[]) => void,
): void {
  unsubscribeChannel(presenceChannel);
  presenceChannel = subscribeRoomPresence(roomId, self, onChange);
}
