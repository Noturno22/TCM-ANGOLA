'use client';

/**
 * Depósitos / levantamentos manuais (lado cliente).
 *
 * Portado do TMT: o utilizador escolhe um método (Binance / Rodotpay /
 * Express), vê os dados de pagamento, paga e envia um COMPROVATIVO. O pedido
 * fica pendente até um admin aprovar. Os levantamentos são pedidos do mesmo
 * modo (`withdrawal_requests`).
 *
 * Independente de `src/lib/payments/client.ts` (esse é o caminho por PSP/KYC).
 * Aqui o fluxo é 100% manual, com prova de pagamento.
 */
import { createClient } from '@/lib/supabase/client';

export type ManualCurrency = 'usd' | 'aoa';
export type PaymentMethodId = 'binance' | 'rodotpay' | 'express';

export interface ReceiptFile {
  file: File;
  mimeType: string;
  fileName: string;
}

export interface PaymentMethodInfo {
  id: PaymentMethodId;
  label: string;
  color: string;
  /** Suporta depósito em USD. */
  usd: boolean;
  /** Suporta depósito em AOA. */
  aoa: boolean;
  /** Valor a copiar (id/telefone de recebimento). */
  copyValue: string;
  /** Instrução legível do que fazer. */
  details: string;
}

/** Contas de recebimento reais (confirmadas pelo SAMA). */
export const BINANCE_ID = '547723572';
export const RODOTPAY_UID = '1927969477';
export const EXPRESS_PHONE = '+244926717730';

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  {
    id: 'binance',
    label: 'Binance Pay',
    color: '#F0B90B',
    usd: true,
    aoa: false,
    copyValue: BINANCE_ID,
    details: `Binance ID: ${BINANCE_ID}`,
  },
  {
    id: 'rodotpay',
    label: 'Rodotpay',
    color: '#6366F1',
    usd: true,
    aoa: true,
    copyValue: RODOTPAY_UID,
    details: `Identificador Rodotpay: ${RODOTPAY_UID}`,
  },
  {
    id: 'express',
    label: 'Express',
    color: '#00C853',
    usd: false,
    aoa: true,
    copyValue: EXPRESS_PHONE,
    details: `Telefone Express: ${EXPRESS_PHONE}`,
  },
];

export function methodsForCurrency(currency: ManualCurrency): PaymentMethodInfo[] {
  return PAYMENT_METHODS.filter((m) => (currency === 'usd' ? m.usd : m.aoa));
}

/** Limites por moeda (unidades maiores). */
export const MIN_DEPOSIT: Record<ManualCurrency, number> = { usd: 5, aoa: 5000 };
export const MAX_DEPOSIT: Record<ManualCurrency, number> = { usd: 1_000_000, aoa: 100_000_000 };
export const MIN_WITHDRAWAL: Record<ManualCurrency, number> = { usd: 5, aoa: 5000 };
export const MAX_WITHDRAWAL: Record<ManualCurrency, number> = { usd: 1_000_000, aoa: 100_000_000 };

export function currencySymbol(currency: ManualCurrency): string {
  return currency === 'usd' ? '$' : 'Kz';
}

export function currencyCode(currency: ManualCurrency): string {
  return currency === 'usd' ? 'USD' : 'AOA';
}

/** Formata um montante em unidades maiores (pt-PT). */
export function formatMoney(amount: number, currency: ManualCurrency = 'usd'): string {
  const value = Number(amount) || 0;
  const formatted = value.toLocaleString(currency === 'usd' ? 'en-US' : 'pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'usd' ? `$${formatted}` : `${formatted} Kz`;
}

/**
 * Envia um comprovativo para o bucket `payment-proofs` na pasta do próprio
 * utilizador. Devolve o URL público.
 */
export async function uploadReceipt(
  userId: string,
  receipt: ReceiptFile,
): Promise<{ url: string | null; error?: string }> {
  try {
    const supabase = createClient();
    if (!supabase) return { url: null, error: 'Backend não configurado.' };

    const ext = (receipt.fileName.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/proof-${Date.now()}.${ext}`;
    const mimeType = receipt.mimeType || 'image/jpeg';

    const { error } = await supabase.storage
      .from('payment-proofs')
      .upload(path, receipt.file, { contentType: mimeType, upsert: false });
    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('payment-proofs').getPublicUrl(path);
    if (!data?.publicUrl) return { url: null, error: 'Não foi possível gerar o URL do comprovativo.' };
    return { url: data.publicUrl };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'Erro desconhecido.' };
  }
}

/** Converte um `File` do browser para o `ReceiptFile` esperado pelo upload. */
export function fileToReceipt(file: File): ReceiptFile {
  return {
    file,
    mimeType: file.type || 'image/jpeg',
    fileName: file.name || `proof-${Date.now()}.jpg`,
  };
}

export interface SaveReceiptParams {
  userId: string;
  userEmail: string;
  proofUrl: string;
  method: PaymentMethodId;
  amount: number;
  currency: ManualCurrency;
  plan?: string;
}

/** Erro devolvido quando já existe um depósito pendente (índice único parcial). */
export const PENDING_DEPOSIT_ERROR = 'deposito_pendente';

/**
 * Regista o comprovativo no servidor (insert direto sob RLS). Devolve o id.
 * Lança `PENDING_DEPOSIT_ERROR` se já houver um depósito pendente.
 */
export async function saveReceipt(params: SaveReceiptParams): Promise<string> {
  const supabase = createClient();
  if (!supabase) throw new Error('Backend não configurado.');
  const { data, error } = await supabase
    .from('payment_receipts')
    .insert({
      user_id: params.userId,
      user_email: params.userEmail,
      proof_url: params.proofUrl,
      plan: params.plan ?? 'wallet',
      method: params.method,
      amount: params.amount,
      currency: params.currency,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error(PENDING_DEPOSIT_ERROR);
    throw new Error(error.message);
  }
  return (data as { id: string }).id;
}

export interface SubmitWithdrawalParams {
  userId: string;
  method: PaymentMethodId;
  amount: number;
  currency: ManualCurrency;
  details: string;
}

/** Regista um pedido de levantamento (insert direto sob RLS). Devolve o id. */
export async function submitWithdrawal(params: SubmitWithdrawalParams): Promise<string> {
  const supabase = createClient();
  if (!supabase) throw new Error('Backend não configurado.');
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .insert({
      user_id: params.userId,
      method: params.method,
      amount: params.amount,
      currency: params.currency,
      details: params.details,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Existe um comprovativo pendente do utilizador? */
export async function hasPendingDeposit(userId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { count, error } = await supabase
    .from('payment_receipts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');
  return !error && (count ?? 0) > 0;
}

/** Um comprovativo com este URL já está registado? (evita falso negativo) */
export async function receiptRegistered(userId: string, proofUrl: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { count, error } = await supabase
    .from('payment_receipts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('proof_url', proofUrl);
  return !error && (count ?? 0) > 0;
}
