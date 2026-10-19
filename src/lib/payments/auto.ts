'use client';

/**
 * Depósitos automáticos (AppyPay) — helpers do lado cliente.
 *
 * O checkout da AppyPay não é uma página externa: a função devolve um URL do
 * próprio app com os dados de apresentação (entidade/referência ou telefone
 * mascarado) em query. Aqui fazemos o arranque da intenção, a leitura desses
 * dados e o polling do estado até o webhook do PSP creditar o saldo.
 *
 * O saldo NUNCA é escrito aqui — só `psp-webhook` credita, via `ledger_credit`.
 */
import { createDeposit, fetchAccount, fetchIntents } from './client';
import { newIdempotencyKey, type AutoDepositMethod, type PaymentIntentRow } from './types';

export type { AutoDepositMethod };

/** Dados de apresentação extraídos do `checkout_url` devolvido pela função. */
export interface AutoCheckoutInfo {
  intentId: string;
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
  if (parsed.searchParams.get('psp') !== 'appypay') return null;
  const intentId = parsed.searchParams.get('intent');
  const method = parsed.searchParams.get('method');
  if (!intentId || (method !== 'gpo' && method !== 'ref')) return null;
  return {
    intentId,
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
  phone?: string;
}): Promise<{ intent: PaymentIntentRow; info: AutoCheckoutInfo }> {
  const intent = await createDeposit({
    amountMinor: params.amountMinor,
    currency: 'AOA',
    provider: 'appypay',
    idempotencyKey: newIdempotencyKey(),
    method: params.method,
    customerPhone: params.method === 'gpo' ? params.phone : undefined,
  });
  const info = parseCheckoutUrl(intent.checkout_url);
  if (!info) throw new Error('checkout_invalido');
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
    if (intent.provider !== 'appypay' || intent.status !== 'pending') continue;
    if (new Date(intent.expires_at).getTime() <= Date.now()) continue;
    const info = parseCheckoutUrl(intent.checkout_url);
    if (info) return { intent, info };
  }
  return null;
}

const AUTO_ERROR_MESSAGES: Record<string, string> = {
  appypay_not_configured: 'Depósito automático indisponível: faltam credenciais AppyPay.',
  appypay_gpo_not_configured: 'Multicaixa Express não está ativo na AppyPay.',
  appypay_ref_not_configured: 'Pagamento por referência não está ativo na AppyPay.',
  appypay_token_failed_401: 'Credenciais AppyPay recusadas. Contacta o suporte.',
  appypay_token_failed_403: 'Credenciais AppyPay recusadas. Contacta o suporte.',
  phone_required: 'Indica o telemóvel do Multicaixa Express.',
  phone_invalid: 'Telemóvel inválido — usa o formato 9XX XXX XXX.',
  checkout_failed: 'A AppyPay recusou o pedido. Tenta novamente.',
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
