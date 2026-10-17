'use client';

/**
 * Histórico de movimentos de dinheiro real (depósitos / levantamentos).
 *
 * Espelha `public.wallet_movements` (mesmo modelo do TMT). O servidor é a
 * fonte da verdade; o estado local existe para UI otimista e é reconciliado
 * quando os triggers de sincronização propagam a decisão do admin.
 */
import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { ManualCurrency, PaymentMethodId } from '@/lib/payments/manual';

export type MovementType = 'deposit' | 'withdrawal';
export type MovementStatus = 'pendente' | 'concluido' | 'recusado';

export interface WalletMovement {
  id: string;
  type: MovementType;
  method: PaymentMethodId;
  amount: number;
  currency: ManualCurrency;
  plan?: string;
  status: MovementStatus;
  receiptId?: string;
  requestId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type NewMovement = Omit<WalletMovement, 'id' | 'createdAt'>;

interface MovementsState {
  movements: WalletMovement[];
  loading: boolean;
  load: (userId: string) => Promise<void>;
  refresh: (userId: string) => Promise<void>;
  addMovement: (userId: string, m: NewMovement) => Promise<string>;
  deleteMovement: (userId: string, id: string) => Promise<void>;
  reset: () => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fromRow(r: Record<string, unknown>): WalletMovement {
  return {
    id: r.id as string,
    type: r.type as MovementType,
    method: r.method as PaymentMethodId,
    amount: Number(r.amount),
    currency: (r.currency as ManualCurrency) ?? 'aoa',
    plan: (r.plan as string) ?? undefined,
    status: r.status as MovementStatus,
    receiptId: (r.receipt_id as string) ?? undefined,
    requestId: (r.request_id as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at as string) ?? undefined,
  };
}

function toRow(m: WalletMovement, userId: string) {
  return {
    id: m.id,
    user_id: userId,
    type: m.type,
    method: m.method,
    amount: m.amount,
    currency: m.currency,
    plan: m.plan ?? null,
    status: m.status,
    receipt_id: m.receiptId ?? null,
    request_id: m.requestId ?? null,
    notes: m.notes ?? null,
    created_at: m.createdAt,
    updated_at: m.updatedAt ?? m.createdAt,
  };
}

function sortDesc(list: WalletMovement[]): WalletMovement[] {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export const useWalletMovements = create<MovementsState>((set, get) => ({
  movements: [],
  loading: false,

  load: async (userId) => {
    const supabase = createClient();
    if (!supabase) return;
    set({ loading: true });
    const { data, error } = await supabase
      .from('wallet_movements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const server = (data as Record<string, unknown>[]).map(fromRow);
      const serverIds = new Set(server.map((m) => m.id));
      const localOnly = get().movements.filter((m) => !serverIds.has(m.id));
      set({ movements: sortDesc([...server, ...localOnly]), loading: false });
    } else {
      set({ loading: false });
    }
  },

  refresh: async (userId) => {
    await get().load(userId);
  },

  addMovement: async (userId, m) => {
    const record: WalletMovement = { ...m, id: newId(), createdAt: new Date().toISOString() };
    set((s) => ({ movements: sortDesc([record, ...s.movements]) }));

    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('wallet_movements').insert(toRow(record, userId));
      if (error) console.warn('[wallet_movements] insert falhou:', error.message);
    }
    return record.id;
  },

  deleteMovement: async (userId, id) => {
    const target = get().movements.find((m) => m.id === id);
    set((s) => ({ movements: s.movements.filter((m) => m.id !== id) }));

    const supabase = createClient();
    if (!supabase || !target) return;
    try {
      // Apaga a linha autoritativa PENDENTE no servidor antes do histórico,
      // senão fica um pedido "fantasma" (bloqueia novos depósitos).
      if (target.type === 'deposit') {
        let q = supabase
          .from('payment_receipts')
          .delete()
          .eq('user_id', userId)
          .eq('status', 'pending');
        q = target.receiptId
          ? q.eq('id', target.receiptId)
          : q.eq('method', target.method).eq('amount', target.amount).eq('currency', target.currency);
        await q;
      } else {
        let q = supabase
          .from('withdrawal_requests')
          .delete()
          .eq('user_id', userId)
          .eq('status', 'pending');
        q = target.requestId
          ? q.eq('id', target.requestId)
          : q.eq('method', target.method).eq('amount', target.amount).eq('currency', target.currency);
        await q;
      }
      await supabase.from('wallet_movements').delete().eq('id', id);
    } catch (err) {
      console.warn('[wallet_movements] delete falhou:', err);
    }
  },

  reset: () => set({ movements: [], loading: false }),
}));
