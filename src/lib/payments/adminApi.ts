'use client';

/**
 * Cliente do painel de administração — depósitos/levantamentos manuais.
 *
 * Fala com a Edge Function `admin-manage` (gateada por `ADMIN_EMAILS` no
 * servidor). Todas as ações exigem sessão autenticada de um admin.
 *
 * IMPORTANTE: o servidor é sempre a autoridade (valida o email em
 * `ADMIN_EMAILS`); o cliente só decide se mostra ou esconde a UI.
 */
import { createClient } from '@/lib/supabase/client';

export interface PaymentReceipt {
  id: string;
  user_id: string;
  user_email: string | null;
  proof_url: string;
  plan: string | null;
  method: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  duplicate_of: string | null;
  referral_code: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface WithdrawalRequestRow {
  id: string;
  user_id: string;
  method: string;
  amount: number;
  currency: string;
  details: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminNotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface RevenueStats {
  thisMonthRevenue: Record<string, number>;
  lastMonthRevenue: Record<string, number>;
  thisMonthCount: number;
  pendingWithdrawalsAmount: Record<string, number>;
  pendingReceiptsCount: number;
}

const NOT_CONFIGURED = 'Backend não configurado.';
const NOT_ADMIN = 'Não tens acesso de administrador.';

/** Extrai a mensagem do corpo JSON quando a Edge Function responde com erro. */
async function messageFromError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* corpo não-JSON */
    }
  }
  const msg = (error as { message?: string }).message;
  return msg || 'Erro desconhecido.';
}

async function callAdminFn<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const supabase = createClient();
  if (!supabase) throw new Error(NOT_CONFIGURED);

  const { data, error } = await supabase.functions.invoke('admin-manage', {
    body: { action, ...payload },
  });

  if (error) throw new Error(await messageFromError(error));
  if (data && typeof data === 'object' && 'error' in data) {
    const message = String((data as { error: unknown }).error);
    throw new Error(message === 'Acesso negado.' ? NOT_ADMIN : message);
  }
  return data as T;
}

// ── Comprovativos (depósitos) ───────────────────────────────────────────────

export async function listReceipts(
  status?: 'pending' | 'approved' | 'rejected',
  limit = 50,
  offset = 0,
): Promise<PaymentReceipt[]> {
  const { receipts } = await callAdminFn<{ receipts: PaymentReceipt[] }>('list_receipts', {
    status,
    limit,
    offset,
  });
  return receipts ?? [];
}

export async function approveReceipt(id: string): Promise<void> {
  await callAdminFn('approve_receipt', { id });
}

export async function rejectReceipt(id: string): Promise<void> {
  await callAdminFn('reject_receipt', { id });
}

export async function deleteReceipt(id: string): Promise<void> {
  await callAdminFn('delete_receipt', { id });
}

// ── Levantamentos ───────────────────────────────────────────────────────────

export async function listWithdrawals(
  status?: 'pending' | 'approved' | 'rejected' | 'paid',
  limit = 50,
  offset = 0,
): Promise<WithdrawalRequestRow[]> {
  const { withdrawals } = await callAdminFn<{ withdrawals: WithdrawalRequestRow[] }>(
    'list_withdrawals',
    { status, limit, offset },
  );
  return withdrawals ?? [];
}

export async function approveWithdrawal(id: string): Promise<void> {
  await callAdminFn('approve_withdrawal', { id });
}

export async function rejectWithdrawal(id: string, notes?: string): Promise<void> {
  await callAdminFn('reject_withdrawal', { id, notes });
}

export async function markWithdrawalPaid(id: string): Promise<void> {
  await callAdminFn('mark_withdrawal_paid', { id });
}

// ── Notificações / estatísticas ─────────────────────────────────────────────

export async function listNotifications(limit = 50): Promise<AdminNotificationRow[]> {
  const { data } = await callAdminFn<{ data?: AdminNotificationRow[] }>('list_notifications', {
    limit,
  });
  return Array.isArray(data) ? data : [];
}

export async function markNotificationRead(id: string): Promise<void> {
  await callAdminFn('mark_notification_read', { id });
}

export async function markAllNotificationsRead(): Promise<void> {
  await callAdminFn('mark_all_notifications_read');
}

export async function unreadCount(): Promise<number> {
  const { count } = await callAdminFn<{ count: number }>('unread_count');
  return count ?? 0;
}

export async function revenueStats(): Promise<RevenueStats> {
  return callAdminFn<RevenueStats>('revenue_stats');
}
