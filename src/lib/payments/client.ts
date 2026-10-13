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
  KycDocumentType,
  KycRecordRow,
  LedgerEntryRow,
  PaymentIntentRow,
  PaymentProviderId,
  PayoutDestination,
  PayoutRow,
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

/** Registos de KYC do próprio utilizador (mais recentes primeiro). */
export async function fetchKycRecords(): Promise<KycRecordRow[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kyc_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as KycRecordRow[] | null) ?? [];
}

export type KycDocumentKind = 'front' | 'back' | 'selfie' | 'address';

/**
 * Envia um documento de KYC para o bucket privado, na pasta do próprio
 * utilizador (`kyc-documents/<userId>/...`). Devolve o caminho guardado.
 */
export async function uploadKycDocument(
  userId: string,
  file: File,
  kind: KycDocumentKind,
): Promise<string> {
  const supabase = createClient();
  if (!supabase) throw new Error(NOT_CONFIGURED);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${kind}-${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from('kyc-documents')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export interface SubmitKycParams {
  documentType: KycDocumentType;
  documentNumber: string;
  documentFrontPath: string;
  documentBackPath?: string | null;
  selfiePath?: string | null;
  addressProofPath?: string | null;
}

/** Submete os metadados de KYC (os documentos já estão no Storage). */
export async function submitKyc(params: SubmitKycParams): Promise<KycRecordRow> {
  const supabase = createClient();
  if (!supabase) throw new Error(NOT_CONFIGURED);
  const { data, error } = await supabase.functions.invoke('submit-kyc', { body: params });
  if (error) throw new Error(error.message || 'Falha ao submeter o KYC.');
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as KycRecordRow;
}

/** Levantamentos do utilizador (mais recentes primeiro). */
export async function fetchPayouts(accountId: string, limit = 20): Promise<PayoutRow[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as PayoutRow[] | null) ?? [];
}

export interface RequestPayoutParams {
  amountMinor: number;
  currency?: Currency;
  provider: PaymentProviderId;
  destination: PayoutDestination;
  idempotencyKey: string;
}

/**
 * Pede um levantamento. O servidor exige KYC aprovado e (por omissão) recusa
 * enquanto `PAYOUTS_ENABLED` não estiver ligado — nesse caso devolve
 * `payouts_disabled`.
 */
export async function requestPayout(params: RequestPayoutParams): Promise<PayoutRow> {
  const supabase = createClient();
  if (!supabase) throw new Error(NOT_CONFIGURED);
  const { data, error } = await supabase.functions.invoke('request-payout', {
    body: {
      amountMinor: params.amountMinor,
      currency: params.currency ?? 'AOA',
      provider: params.provider,
      destination: params.destination,
      idempotencyKey: params.idempotencyKey,
    },
  });
  if (error) throw new Error(error.message || 'Falha ao pedir o levantamento.');
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as PayoutRow;
}
