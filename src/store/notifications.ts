/**
 * Store de notificações (Fase 3) — lista, não-lidas e ações.
 *
 * Sem backend configurado ou sem sessão, `enabled` fica `false` e a UI
 * mantém um estado vazio em vez de rebentar. As notificações chegam em tempo
 * real e as de alto sinal geram um toast (ver `isToastWorthy`).
 */
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  deleteNotification,
  fetchNotifications,
  isToastWorthy,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  unreadCount,
  unsubscribeNotificationsChannel,
  type AppNotification,
} from '@/lib/online/notifications';

interface NotificationsStore {
  /** Backend configurado (Supabase). */
  enabled: boolean;
  loaded: boolean;
  loading: boolean;
  items: AppNotification[];
  unread: number;

  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
  reset: () => void;
}

let channel: RealtimeChannel | null = null;

function withUnread(items: AppNotification[]) {
  return { items, unread: unreadCount(items) };
}

export const useNotifications = create<NotificationsStore>((set, get) => ({
  enabled: isSupabaseConfigured,
  loaded: false,
  loading: false,
  items: [],
  unread: 0,

  load: async () => {
    if (!isSupabaseConfigured) return;
    set({ loading: true });
    const items = await fetchNotifications();
    if (items) {
      set({ ...withUnread(items), loaded: true, loading: false });
    } else {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    const target = get().items.find((n) => n.id === id);
    if (!target || target.read) return;
    set((s) => withUnread(s.items.map((n) => (n.id === id ? { ...n, read: true } : n))));
    if (!(await markNotificationRead(id))) void get().load();
  },

  markAllRead: async () => {
    if (get().unread === 0) return;
    set((s) => withUnread(s.items.map((n) => ({ ...n, read: true }))));
    if (!(await markAllNotificationsRead())) void get().load();
  },

  remove: async (id) => {
    set((s) => withUnread(s.items.filter((n) => n.id !== id)));
    if (!(await deleteNotification(id))) void get().load();
  },

  subscribe: () => {
    if (!isSupabaseConfigured || channel) return;
    channel = subscribeToNotifications({
      onInsert: (n) => {
        set((s) => withUnread([n, ...s.items.filter((x) => x.id !== n.id)]));
        if (isToastWorthy(n.kind)) {
          toast(n.title, { description: n.body ?? undefined });
        }
      },
      onChange: () => {
        void get().load();
      },
    });
  },

  unsubscribe: () => {
    unsubscribeNotificationsChannel(channel);
    channel = null;
  },

  reset: () => {
    get().unsubscribe();
    set({ loaded: false, loading: false, items: [], unread: 0 });
  },
}));
