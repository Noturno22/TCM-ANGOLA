'use client';

/**
 * Depósitos automáticos (AppyPay / BitPay) — helpers do lado cliente.
 *
 * O checkout destes PSP não é uma página externa: a função devolve um URL do
 * próprio app com os dados de apresentação (entidade/referência ou telefone
 * mascarado) em query. Aqui fazemos o arranque da intenção, a leitura desses
 * dados e o polling do estado até o webhook do PSP creditar o saldo.
 *
 * O saldo NUNCA é escrito aqui — só `psp-webhook` credita, via `ledger_credit`.
 */
import { createDeposit, fetchAccount, fetchIntents } from './client';
import { newIdempotencyKey, type AutoDepositMethod, type PaymentIntentRow } from './types';

export type { AutoDepositMethod };

/** Providers com depósito automático, por ordem de preferência. */
export const AUTO_PROVIDER_IDS = ['appypay', 'bitpay'] as const;
export type AutoProviderId = (typeof AUTO_PROVIDER_IDS)[number];

/** Subconjunto de `AUTO_PROVIDER_IDS` que está ativo na UI, por preferência. */
export function autoProviderCandidates(enabledIds: string[]): AutoProviderId[] {
  return AUTO_PROVIDER_IDS.filter((id) => enabledIds.includes(id));
}

function isAutoProvider(id: string | null | undefined): id is AutoProviderId {
  return AUTO_PROVIDER_IDS.includes(id as AutoProviderId);
}

/** Dados de apresentação extraídos do `checkout_url` devolvido pela função. */
export interface AutoCheckoutInfo {
  intentId: string;
  /** PSP que gerou o checkout (`appypay` | `bitpay`). */
  psp: AutoProviderId;
  method: AutoDepositMethod;
  /** Entidade (só referências). */
  entity: string | null;
  /** Referência a pagar (só referências). */
  reference: string | null;
  /** Telefone mascarado (só Multicaixa Express). */
  phoneMasked: string | null;
}

/** `923456789` / `244923456789` (válido) ou `null` (formato inválido). */
export function normalizeAutoPhone(raw: string): string | null {
  const digits = String(raw).replace(/\D/g, '');
  if (/^9\d{8}$/.test(digits)) return digits;
  if (/^2449\d{8}$/.test(digits)) return digits;
  return null;
}

/** Lê os parâmetros do `checkout_url` do nosso app; `null` se for inesperado. */
export function parseCheckoutUrl(url: string | null | undefined): AutoCheckoutInfo | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  } catch {
    return null;
  }
  const psp = parsed.searchParams.get('psp');
  if (!isAutoProvider(psp)) return null;
  const intentId = parsed.searchParams.get('intent');
  const method = parsed.searchParams.get('method');
  if (!intentId || (method !== 'gpo' && method !== 'ref')) return null;
  return {
    intentId,
    psp,
    method,
    entity: parsed.searchParams.get('entity'),
    reference: parsed.searchParams.get('reference'),
    phoneMasked: parsed.searchParams.get('phone_masked'),
  };
}

/** Cria a intenção e devolve os dados para o cartão pendente. */
export async function startAutoDeposit(params: {
  amountMinor: number;
  method: AutoDepositMethod;
  provider: AutoProviderId;
  phone?: string;
}): Promise<{ intent: PaymentIntentRow; info: AutoCheckoutInfo }> {
  const intent = await createDeposit({
    amountMinor: params.amountMinor,
    currency: 'AOA',
    provider: params.provider,
    idempotencyKey: newIdempotencyKey(),
    method: params.method,
    customerPhone: params.method === 'gpo' ? params.phone : undefined,
  });
  const info = parseCheckoutUrl(intent.checkout_url);
  if (!info || info.psp !== params.provider) throw new Error('checkout_invalido');
  return { intent, info };
}

/** Estado atual de uma intenção (leitura sob RLS, só do próprio utilizador). */
export async function fetchIntentById(intentId: string): Promise<PaymentIntentRow | null> {
  const account = await fetchAccount('AOA');
  if (!account) return null;
  const intents = await fetchIntents(account.id, 50);
  return intents.find((i) => i.id === intentId) ?? null;
}

/** Retoma uma intenção automática pendente e ainda válida (ao abrir o ecrã). */
export async function findResumableAutoIntent(): Promise<{
  intent: PaymentIntentRow;
  info: AutoCheckoutInfo;
} | null> {
  const account = await fetchAccount('AOA');
  if (!account) return null;
  const intents = await fetchIntents(account.id, 20);
  for (const intent of intents) {
    if (!isAutoProvider(intent.provider) || intent.status !== 'pending') continue;
    if (new Date(intent.expires_at).getTime() <= Date.now()) continue;
    const info = parseCheckoutUrl(intent.checkout_url);
    if (info && info.psp === intent.provider) return { intent, info };
  }
  return null;
}

const AUTO_ERROR_MESSAGES: Record<string, string> = {
  appypay_not_configured: 'Depósito automático indisponível: faltam credenciais AppyPay.',
  appypay_gpo_not_configured: 'Multicaixa Express não está ativo na AppyPay.',
  appypay_ref_not_configured: 'Pagamento por referência não está ativo na AppyPay.',
  appypay_token_failed_401: 'Credenciais AppyPay recusadas. Contacta o suporte.',
  appypay_token_failed_403: 'Credenciais AppyPay recusadas. Contacta o suporte.',
  bitpay_not_configured: 'Depósito automático indisponível: falta a chave da BitPay.',
  bitpay_missing_reference: 'A BitPay não devolveu a referência de pagamento.',
  bitpay_amount_out_of_range: 'Valor fora dos limites aceites pela BitPay.',
  bitpay_http_401: 'Chave BitPay recusada. Contacta o suporte.',
  bitpay_http_429: 'A BitPay limitou os pedidos. Espera um minuto e tenta de novo.',
  phone_required: 'Indica o telemóvel do Multicaixa Express.',
  phone_invalid: 'Telemóvel inválido — usa o formato 9XX XXX XXX.',
  checkout_failed: 'O PSP recusou o pedido. Tenta novamente.',
  currency_not_supported: 'Só é possível depositar em AOA.',
  real_money_disabled: 'Dinheiro real desativado.',
  unauthenticated: 'Sessão expirada. Volta a entrar.',
  invalid_idempotency_key: 'Falha interna ao gerar a referência. Tenta novamente.',
};

/** Traduz o código de erro da Edge Function para uma mensagem em português. */
export function autoErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = raw.split(':')[0].trim();
  return AUTO_ERROR_MESSAGES[code] ?? 'Falha ao iniciar o pagamento.';
}

/**
 * Erro de "provider sem credenciais" — o chamador pode tentar o próximo
 * candidato da lista (ex.: AppyPay por configurar → BitPay).
 */
export function isNotConfiguredError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.split(':')[0].trim().endsWith('_not_configured');
}
