// Tipos partilhados das Edge Functions de pagamentos (Deno).
// Cópia deliberada de `src/lib/payments/types.ts` — o bundle das funções não
// pode importar de `src/`.

export type Currency = 'AOA' | 'USD';
export type PaymentProviderId = 'mock' | 'wipay' | 'appypay' | 'paypay' | 'stripe';
export type IntentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export interface CreateCheckoutParams {
  amountMinor: number;
  currency: Currency;
  /** id do payment_intent (uuid) — devolvido ao PSP como referência de merchant. */
  referenceId: string;
  /** idempotency_key do payment_intent; usado para reconciliar webhooks. */
  idempotencyKey: string;
  returnUrl: string;
  webhookUrl: string;
}

export interface CreateCheckoutResult {
  providerRef: string;
  checkoutUrl: string;
  expiresAt: string;
  status: IntentStatus;
}

export type NormalizedEventType =
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.expired'
  | 'refund.completed';

export interface NormalizedEvent {
  type: NormalizedEventType;
  /** id do evento no PSP (chave de idempotência dos webhooks). */
  eventId: string;
  /** idempotency_key do payment_intent a que o evento se refere. */
  reference: string;
  providerRef: string;
  amountMinor: number;
  currency: Currency;
  paidAt: string | null;
  raw: unknown;
}

export interface PSPProvider {
  id: PaymentProviderId;
  label: string;
  supportsCurrency(currency: Currency): boolean;
  createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult>;
  /** Verifica a assinatura do webhook e traduz o payload para `NormalizedEvent`. */
  verifyAndParse(rawBody: string, headers: Headers): Promise<NormalizedEvent>;
}

export const MIN_DEPOSIT_MINOR = 10_000;
export const MAX_DEPOSIT_MINOR = 100_000_000;
