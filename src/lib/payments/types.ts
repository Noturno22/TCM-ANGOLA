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
export type PaymentProviderId = 'mock' | 'wipay' | 'appypay' | 'paypay' | 'stripe';

export type IntentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

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

/** Unidades menores por unidade (AOA: 1 kwanza = 100 cêntimos). */
export const AOA_MINOR_PER_UNIT = 100;

/** Depósito mínimo (100,00 AOA). */
export const MIN_DEPOSIT_MINOR = 10_000;

/** Depósito máximo por transação (1.000.000,00 AOA) — trava anti-erro/anti-fraude. */
export const MAX_DEPOSIT_MINOR = 100_000_000;

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
