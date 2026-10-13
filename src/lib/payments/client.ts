'use client';

/**
 * Acesso do browser aos dados de pagamentos.
 *
 * * Leitura (saldo, extrato, intenções) → via cliente Supabase + RLS.
 * * Escrita (criar depósito) → via Edge Function `create-deposit-intent`
 *   (nunca se escreve no ledger a partir do cliente).
 */
import { createClient } from '@/lib/supabase/client';
import type {
  AccountRow,
  Currency,
  LedgerEntryRow,
  PaymentIntentRow,
  PaymentProviderId,
} from './types';

const NOT_CONFIGURED = 'Backend de pagamentos não configurado.';

/** Conta (carteira) do utilizador autenticado para a moeda indicada. */
export async function fetchAccount(currency: Currency = 'AOA'): Promise<AccountRow | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('currency', currency)
    .maybeSingle();
  if (error) throw error;
  return (data as AccountRow | null) ?? null;
}

/** Saldo atual em unidades menores (última entrada do ledger). */
export async function fetchBalanceMinor(accountId: string): Promise<number> {
  const supabase = createClient();
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('balance_after')
    .eq('account_id', accountId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.balance_after as number | undefined) ?? 0;
}

/** Extrato (entradas do ledger), mais recentes primeiro. */
export async function fetchLedger(accountId: string, limit = 50): Promise<LedgerEntryRow[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('account_id', accountId)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as LedgerEntryRow[] | null) ?? [];
}

/** Intenções de depósito do utilizador (mais recentes primeiro). */
export async function fetchIntents(accountId: string, limit = 20): Promise<PaymentIntentRow[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as PaymentIntentRow[] | null) ?? [];
}

export interface CreateDepositParams {
  amountMinor: number;
  currency?: Currency;
  provider: PaymentProviderId;
  idempotencyKey: string;
  returnUrl?: string;
}

/**
 * Cria uma intenção de depósito no servidor e devolve o URL de checkout.
 *
 * A Edge Function valida o montante, cria a linha `payment_intents` e pede o
 * checkout ao PSP. O crédito no saldo só acontece depois do webhook do PSP.
 */
export async function createDeposit(params: CreateDepositParams): Promise<PaymentIntentRow> {
  const supabase = createClient();
  if (!supabase) throw new Error(NOT_CONFIGURED);
  const returnUrl =
    params.returnUrl ??
    (typeof window !== 'undefined' ? `${window.location.origin}/?deposit=return` : undefined);

  const { data, error } = await supabase.functions.invoke('create-deposit-intent', {
    body: {
      amountMinor: params.amountMinor,
      currency: params.currency ?? 'AOA',
      provider: params.provider,
      idempotencyKey: params.idempotencyKey,
      returnUrl,
    },
  });

  if (error) throw new Error(error.message || 'Falha ao criar o depósito.');
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as PaymentIntentRow;
}
