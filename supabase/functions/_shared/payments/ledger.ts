// Helpers de ledger e idempotência para as Edge Functions (Deno).
// Todas as escritas no saldo passam por aqui — que por sua vez só chama as
// RPCs `ledger_credit`/`ledger_debit` (SECURITY DEFINER, service_role).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface LedgerEntry {
  id: number;
  account_id: string;
  entry_type: 'debit' | 'credit';
  amount_minor: number;
  balance_after: number;
  reference_type: string;
  reference_id: string;
  idempotency_key: string;
  description: string | null;
  created_at: string;
}

export interface CreditParams {
  accountId: string;
  amountMinor: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  description?: string | null;
}

export type CreditResult =
  | { ok: true; entry: LedgerEntry }
  | { ok: false; reason: 'duplicate' };

/**
 * Credita uma conta. Devolve `{ ok:false, reason:'duplicate' }` quando a
 * `idempotency_key` já existe (a unique constraint é a nossa rede de segurança).
 */
export async function creditLedger(
  admin: SupabaseClient,
  params: CreditParams,
): Promise<CreditResult> {
  const { data, error } = await admin.rpc('ledger_credit', {
    p_account_id: params.accountId,
    p_amount_minor: params.amountMinor,
    p_reference_type: params.referenceType,
    p_reference_id: params.referenceId,
    p_idempotency_key: params.idempotencyKey,
    p_description: params.description ?? null,
  });

  if (error) {
    if (error.code === '23505' || /duplicate key/i.test(error.message)) {
      return { ok: false, reason: 'duplicate' };
    }
    throw error;
  }
  return { ok: true, entry: data as LedgerEntry };
}

/** True se o evento do provider já foi processado. */
export async function wasWebhookProcessed(
  admin: SupabaseClient,
  provider: string,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('processed_webhooks')
    .select('id')
    .eq('provider', provider)
    .eq('provider_event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/**
 * Marca o evento como processado. Devolve `false` se já existia (corrida entre
 * dois webhooks iguais) — o chamador deve então tratar como "já processado".
 */
export async function markWebhookProcessed(
  admin: SupabaseClient,
  params: {
    provider: string;
    eventId: string;
    eventType: string;
    paymentIntentId?: string | null;
  },
): Promise<boolean> {
  const { error } = await admin.from('processed_webhooks').insert({
    provider: params.provider,
    provider_event_id: params.eventId,
    event_type: params.eventType,
    payment_intent_id: params.paymentIntentId ?? null,
  });
  if (error) {
    if (error.code === '23505' || /duplicate key/i.test(error.message)) return false;
    throw error;
  }
  return true;
}
