// Tipos partilhados das Edge Functions de pagamentos (Deno).
// Cópia deliberada de `src/lib/payments/types.ts` — o bundle das funções não
// pode importar de `src/`.

export type Currency = 'AOA' | 'USD';
export type PaymentProviderId = 'mock' | 'wipay' | 'appypay' | 'bitpay' | 'paypay' | 'stripe';
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
  /** Método específico do provider (ex.: `gpo` Multicaixa Express | `ref` na AppyPay). */
  method?: string;
  /** Telemóvel Multicaixa Express (AppyPay GPO), dígitos livres de formatação. */
  customerPhone?: string;
}

export interface CreateCheckoutResult {
  providerRef: string;
  checkoutUrl: string;
  expiresAt: string;
  status: IntentStatus;
}

// ------------------------------ payouts ---------------------------------

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
  /** IBAN (bank_transfer), nº de telefone (mobile_money) ou referência (express). */
  value: string;
  holderName?: string;
}

export interface CreatePayoutParams {
  amountMinor: number;
  currency: Currency;
  /** id do payout (uuid) — devolvido ao PSP como referência de merchant. */
  referenceId: string;
  idempotencyKey: string;
  destination: PayoutDestination;
  webhookUrl: string;
}

export interface CreatePayoutResult {
  providerRef: string;
  status: PayoutStatus;
  estimatedAt: string | null;
}

export type NormalizedEventType =
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.expired'
  /** Estado ainda não resolvido (ex.: AppyPay "Pending") — ignora-se sem efeito. */
  | 'payment.pending'
  | 'refund.completed'
  | 'payout.paid'
  | 'payout.failed';

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
  /** True apenas quando o provider tem levantamentos (payouts) implementados. */
  supportsPayouts: boolean;
  createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult>;
  /** Inicia um levantamento. Ausente quando `supportsPayouts` é false. */
  createPayout?(params: CreatePayoutParams): Promise<CreatePayoutResult>;
  /** Verifica a assinatura do webhook e traduz o payload para `NormalizedEvent`. */
  verifyAndParse(rawBody: string, headers: Headers): Promise<NormalizedEvent>;
}

export const MIN_DEPOSIT_MINOR = 10_000;
export const MAX_DEPOSIT_MINOR = 100_000_000;
export const MIN_PAYOUT_MINOR = 10_000;
export const MAX_PAYOUT_MINOR = 500_000_000;
