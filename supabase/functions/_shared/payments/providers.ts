// Registo de providers PSP (Deno).
//
// `mock` está implementado de ponta a ponta (sandbox / testes).
// `appypay` está implementado para depósitos automáticos (GPO/REF) e só
// funciona com credenciais — sem elas responde `appypay_not_configured`.
// `wipay` / `stripe` são stubs explícitos: falham com erro claro até haver
// credenciais e endpoints reais ligados — nunca fingem sucesso, para não
// creditarmos saldo sem dinheiro real.

import type {
  CreateCheckoutParams,
  CreateCheckoutResult,
  CreatePayoutParams,
  CreatePayoutResult,
  Currency,
  NormalizedEvent,
  PSPProvider,
  PaymentProviderId,
} from './types.ts';
import { appypayProvider } from './appypay.ts';

// --------------------------- utilitários HMAC ---------------------------

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ------------------------------- mock -----------------------------------

const DEFAULT_EXPIRY_MIN = 15;

/**
 * Provider de sandbox: NÃO move dinheiro. Cria um checkout falso e aceita
 * webhooks assinados com HMAC-SHA256 do segredo `MOCK_WEBHOOK_SECRET`.
 */
const mockProvider: PSPProvider = {
  id: 'mock',
  label: 'Sandbox (teste)',
  supportsCurrency: (c: Currency) => c === 'AOA',
  supportsPayouts: true,

  createCheckout: (params: CreateCheckoutParams): Promise<CreateCheckoutResult> => {
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_MIN * 60_000).toISOString();
    const providerRef = `mock_${params.referenceId}`;
    const url = new URL(params.returnUrl);
    url.searchParams.set('mock_intent', params.idempotencyKey);
    url.searchParams.set('mock_result', 'paid');
    return Promise.resolve({
      providerRef,
      checkoutUrl: url.toString(),
      expiresAt,
      status: 'pending',
    });
  },

  // Sandbox: aceita o levantamento e devolve "processing" (não move dinheiro).
  createPayout: (params: CreatePayoutParams): Promise<CreatePayoutResult> => {
    return Promise.resolve({
      providerRef: `mock_payout_${params.referenceId}`,
      status: 'processing',
      estimatedAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    });
  },

  verifyAndParse: async (rawBody: string, headers: Headers): Promise<NormalizedEvent> => {
    const secret = Deno.env.get('MOCK_WEBHOOK_SECRET');
    if (!secret) throw new Error('mock_webhook_secret_missing');
    const header = headers.get('x-mock-signature') ?? '';
    const provided = header.replace(/^sha256=/, '');
    const expected = await hmacSha256Hex(secret, rawBody);
    if (!timingSafeEqual(provided, expected)) throw new Error('invalid_signature');

    const payload = JSON.parse(rawBody) as {
      type?: string;
      event_id?: string;
      reference?: string;
      provider_ref?: string;
      amount_minor?: number;
      currency?: string;
      paid_at?: string;
    };
    const allowed = [
      'payment.paid',
      'payment.failed',
      'payment.expired',
      'refund.completed',
      'payout.paid',
      'payout.failed',
    ];
    if (!payload.type || !allowed.includes(payload.type)) throw new Error('unsupported_event');
    if (!payload.event_id || !payload.reference) throw new Error('malformed_event');

    return {
      type: payload.type as NormalizedEvent['type'],
      eventId: payload.event_id,
      reference: payload.reference,
      providerRef: payload.provider_ref ?? `mock_${payload.reference}`,
      amountMinor: Number(payload.amount_minor ?? 0),
      currency: (payload.currency as Currency) ?? 'AOA',
      paidAt: payload.paid_at ?? null,
      raw: payload,
    };
  },
};

// --------------------- stubs para providers reais -----------------------

function notConfigured(id: string): PSPProvider {
  const fail = () => Promise.reject(new Error(`${id}_not_configured`));
  return {
    id: id as PaymentProviderId,
    label: id,
    supportsCurrency: (c: Currency) => c === 'AOA',
    supportsPayouts: false,
    createCheckout: fail,
    verifyAndParse: fail,
  };
}

/** WiPay é o provider-alvo para Angola; ligar endpoints+credenciais aqui. */
const wipayProvider: PSPProvider = notConfigured('wipay');
const stripeProvider: PSPProvider = notConfigured('stripe');

const REGISTRY: Record<string, PSPProvider> = {
  mock: mockProvider,
  wipay: wipayProvider,
  // Implementado em `appypay.ts`; sem APPYPAY_CLIENT_ID/SECRET responde
  // `appypay_not_configured` (nunca fingindo sucesso).
  appypay: appypayProvider,
  stripe: stripeProvider,
};

export function isKnownProvider(id: string): id is PaymentProviderId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, id);
}

export function getProvider(id: string): PSPProvider | null {
  return REGISTRY[id] ?? null;
}

/**
 * Provider por omissão para depósitos. Em produção aponta para o real quando
 * configurado; caso contrário `mock`. Override com `PAYMENTS_DEFAULT_PROVIDER`.
 */
export function defaultProviderId(): PaymentProviderId {
  const env = Deno.env.get('PAYMENTS_DEFAULT_PROVIDER');
  if (env && isKnownProvider(env)) return env;
  return 'mock';
}
