/**
 * Tipos de pagamentos (lado cliente).
 *
 * Espelham o schema de `supabase/migrations/0002_payments.sql`. Os montantes
 * circulam SEMPRE como inteiros em unidades menores (AOA centavos; 1 AOA = 100)
 * para evitar erros de vírgula flutuante.
 *
 * NOTA: as Edge Functions (Deno) têm uma cópia própria destes tipos em
 * `supabase/functions/_shared/payments/types.ts` — não podem importar de `src/`.
 */

export type Currency = 'AOA' | 'USD';

/** Providers conhecidos. `mock` é só para sandbox; nunca move dinheiro real. */
export type PaymentProviderId = 'mock' | 'wipay' | 'appypay' | 'bitpay' | 'paypay' | 'stripe';

export type IntentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

/** Métodos de cobrança automáticos (AppyPay): Express (push) ou referência. */
export type AutoDepositMethod = 'gpo' | 'ref';

export type AccountStatus = 'active' | 'frozen' | 'closed';

export type LedgerEntryType = 'debit' | 'credit';

export interface AccountRow {
  id: string;
  user_id: string;
  currency: Currency;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntryRow {
  id: number;
  account_id: string;
  entry_type: LedgerEntryType;
  amount_minor: number;
  balance_after: number;
  reference_type: string;
  reference_id: string;
  idempotency_key: string;
  description: string | null;
  created_at: string;
}

export interface PaymentIntentRow {
  id: string;
  account_id: string;
  provider: PaymentProviderId;
  provider_ref: string | null;
  amount_minor: number;
  currency: Currency;
  fx_rate_minor: number | null;
  status: IntentStatus;
  checkout_url: string | null;
  metadata: Record<string, unknown>;
  idempotency_key: string;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------- KYC ------------------------------------

export type KycStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'requires_review';

export type KycDocumentType = 'BI' | 'passport' | 'driver_license';

export interface KycRecordRow {
  id: string;
  user_id: string;
  status: KycStatus;
  document_type: KycDocumentType;
  document_number: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string | null;
  address_proof_url: string | null;
  liveness_check: boolean;
  rejection_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------- payouts ----------------------------------

export type PayoutStatus =
  | 'requested'
  | 'kyc_pending'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export type PayoutDestinationType = 'bank_transfer' | 'mobile_money' | 'express';

export interface PayoutDestination {
  type: PayoutDestinationType;
  value: string;
  holderName?: string;
}

export interface PayoutRow {
  id: string;
  account_id: string;
  provider: PaymentProviderId;
  provider_ref: string | null;
  amount_minor: number;
  currency: Currency;
  fx_rate_minor: number | null;
  status: PayoutStatus;
  destination: PayoutDestination;
  idempotency_key: string;
  failure_reason: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Unidades menores por unidade (AOA: 1 kwanza = 100 cêntimos). */
export const AOA_MINOR_PER_UNIT = 100;

/** Depósito mínimo (100,00 AOA). */
export const MIN_DEPOSIT_MINOR = 10_000;

/** Depósito máximo por transação (1.000.000,00 AOA) — trava anti-erro/anti-fraude. */
export const MAX_DEPOSIT_MINOR = 100_000_000;

/** Levantamento mínimo (100,00 AOA). */
export const MIN_PAYOUT_MINOR = 10_000;

/** Levantamento máximo por transação (5.000.000,00 AOA). */
export const MAX_PAYOUT_MINOR = 500_000_000;

/** Converte unidades menores para AOA (decimal). */
export function aoaFromMinor(minor: number): number {
  return minor / AOA_MINOR_PER_UNIT;
}

/** Converte AOA (decimal) para unidades menores. */
export function minorFromAoa(aoa: number): number {
  return Math.round(aoa * AOA_MINOR_PER_UNIT);
}

/** Formata unidades menores como "1 234,56" (pt-PT), sem símbolo. */
export function formatMinor(minor: number): string {
  return aoaFromMinor(minor).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Gera uma chave de idempotência única para uma nova tentativa de depósito. */
export function newIdempotencyKey(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `dep_${uuid}`;
}

/** Gera uma chave de idempotência única para um novo pedido de levantamento. */
export function newPayoutIdempotencyKey(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `pay_${uuid}`;
}
