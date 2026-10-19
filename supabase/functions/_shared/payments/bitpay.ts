// Adaptador BitPay (Angola) — depósitos automáticos (Deno).
//
// Documentação oficial: https://developers.bitpay.ao (guia:
// https://developers.bitpay.ao/llms-full.txt)
//   * Sandbox ABERTO: `https://api-sandbox.bitpay.ao/v1` (chave `sk_test_…`,
//     criada em segundos em https://dashboard.bitpay.ao). Produção
//     (`https://api.bitpay.ao/v1`, chave `sk_live_…`) só depois da
//     certificação EMIS — hoje o gateway ainda não move dinheiro real.
//   * Cobranças: `POST /payment_intents` com `Idempotency-Key` obrigatório
//       - `multicaixa_express` → push para a app do cliente (9 dígitos);
//       - `multicaixa_reference` → entidade + referência gerados por eles
//         (`reference.entity` / `reference.number`, validade 72 h).
//   * `amount` é um INTEIRO em kwanzas (25000 = 25.000 Kz); `merchant_reference`
//     devolve em todos os webhooks — usamos a `idempotency_key`, por isso o
//     webhook localiza a intenção pela 1.ª consulta de `findIntent`.
//   * Webhooks assinados (`BitPay-Signature: t=…,v1=HMAC(whsec, "t.corpo")`).
//     Mesmo com assinatura, a fonte da verdade é a RECONSULTA
//     `GET /payment_intents/{id}` com a nossa chave — é o estado daqui que
//     é usado. Com `BITPAY_WEBHOOK_SECRET` a assinatura é additionally
//     validada (falha fechada); sem ela, só a reconsulta conta.
//   * Endpoint de webhook registado automaticamente na 1.ª cobrança
//     (`POST /webhook_endpoints`, eventos `*`) — sem passos no painel.
//
// Sem chave (`BITPAY_SK`) todos os métodos falham com `bitpay_not_configured`
// — nunca fingem sucesso.

import type {
  CreateCheckoutParams,
  CreateCheckoutResult,
  Currency,
  NormalizedEvent,
  PSPProvider,
} from './types.ts';

// ------------------------------ configuração -----------------------------

interface Environment {
  baseUrl: string;
}

/** Sandbox (nenhum pagamento é real). */
const SANDBOX: Environment = { baseUrl: 'https://api-sandbox.bitpay.ao/v1' };

/** Produção (só depois da certificação EMIS). */
const PRODUCTION: Environment = { baseUrl: 'https://api.bitpay.ao/v1' };

export interface BitPayConfig extends Environment {
  secretKey: string;
  /** `whsec_…` do endpoint de webhook (opcional; valida a assinatura). */
  webhookSecret: string | null;
}

/**
 * Lê a configuração das secrets. Devolve `null` quando não há chave — nesse
 * caso o provider responde `bitpay_not_configured`.
 */
export function config(
  env: (key: string) => string | undefined = Deno.env.get,
): BitPayConfig | null {
  const secretKey = env('BITPAY_SK');
  if (!secretKey) return null;

  const base = env('BITPAY_ENV') === 'production' ? PRODUCTION : SANDBOX;
  return {
    baseUrl: env('BITPAY_BASE_URL') || base.baseUrl,
    secretKey,
    webhookSecret: env('BITPAY_WEBHOOK_SECRET') || null,
  };
}

function getConfig(): BitPayConfig {
  const cfg = config();
  if (!cfg) throw new Error('bitpay_not_configured');
  return cfg;
}

// ---------------------------- utilitários --------------------------------

class BitPayHttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`bitpay_http_${status}${body ? `: ${body.slice(0, 300)}` : ''}`);
    this.status = status;
    this.body = body;
  }
}

async function requestJson(
  cfg: BitPayConfig,
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.secretKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new BitPayHttpError(res.status, await res.text().catch(() => ''));
  return (await res.json()) as Record<string, unknown>;
}

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

/** `923 456 789` / `244923456789` → `923456789` (formato BitPay). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) return digits;
  if (digits.length === 12 && digits.startsWith('2449')) return digits.slice(3);
  throw new Error('phone_invalid');
}

function maskPhone(phone: string): string {
  return phone.length >= 6 ? `${phone.slice(0, 3)}*****${phone.slice(-2)}` : phone;
}

/** URL de retorno do nosso app com os dados de apresentação em query. */
function returnUrlFor(
  params: CreateCheckoutParams,
  extra: Record<string, string | null | undefined>,
): string {
  const url = new URL(params.returnUrl);
  url.searchParams.set('psp', 'bitpay');
  url.searchParams.set('intent', params.referenceId);
  for (const [key, value] of Object.entries(extra)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

const GPO_EXPIRY_MIN = 15;
const REF_EXPIRY_MS = 72 * 60 * 60 * 1000;

// ------------------------- registo do webhook ----------------------------

const ensuredWebhooks = new Set<string>();

/**
 * Garante que existe um endpoint de webhook apontado para a nossa função
 * (eventos `*`). Lista primeiro — só cria quando a listagem é legível e não
 * existe nenhum endpoint para esse URL, para não duplicar entregas.
 */
async function ensureWebhookEndpoint(cfg: BitPayConfig, webhookUrl: string): Promise<void> {
  if (!webhookUrl || ensuredWebhooks.has(webhookUrl)) return;
  try {
    const list = await requestJson(cfg, '/webhook_endpoints');
    // A listagem pode vir como array direto ou embrulhada (`data`, ...);
    // aceitamos as formas conhecidas e ignoramos o resto.
    const endpoints = [list, list.data, list.webhook_endpoints, list.endpoints].find(
      (item): item is Record<string, unknown>[] => Array.isArray(item),
    );
    if (!endpoints) return; // forma inesperada: não criar para evitar duplicados
    const exists = endpoints.some(
      (e) => typeof e?.url === 'string' && e.url === webhookUrl && e.disabled !== true,
    );
    if (exists) {
      ensuredWebhooks.add(webhookUrl);
      return;
    }
    await requestJson(cfg, '/webhook_endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: webhookUrl, events: ['*'] }),
    });
    ensuredWebhooks.add(webhookUrl);
  } catch (error) {
    // O webhook é conveniente mas não bloqueante (o cliente também faz
    // polling do estado); falha silenciosa com log para diagnóstico.
    console.error('bitpay webhook ensure failed', error);
  }
}

// ------------------------------ createCheckout ---------------------------

interface BitPayReference {
  entity?: string;
  number?: string;
  expires_at?: string;
}

async function createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
  const cfg = getConfig();
  const amountKz = Math.round(params.amountMinor / 100);
  if (amountKz < 100) throw new Error('bitpay_amount_out_of_range');
  const preferred = params.method ?? (params.customerPhone ? 'gpo' : 'ref');
  const method = preferred.toLowerCase();

  await ensureWebhookEndpoint(cfg, params.webhookUrl);

  const body: Record<string, unknown> = {
    amount: amountKz,
    currency: 'AOA',
    merchant_reference: params.idempotencyKey,
  };

  if (method === 'gpo') {
    body.payment_method = 'multicaixa_express';
    body.customer = { mobile: normalizePhone(params.customerPhone ?? '') };
  } else if (method === 'ref') {
    body.payment_method = 'multicaixa_reference';
  } else {
    throw new Error('bitpay_method_unknown');
  }

  const data = await requestJson(cfg, '/payment_intents', {
    method: 'POST',
    headers: { 'Idempotency-Key': params.idempotencyKey },
    body: JSON.stringify(body),
  });

  const providerRef = typeof data.id === 'string' ? data.id : '';
  if (!providerRef) throw new Error('bitpay_missing_payment_id');
  const ref = (data.reference ?? null) as BitPayReference | null;

  if (method === 'gpo') {
    return {
      providerRef,
      checkoutUrl: returnUrlFor(params, {
        method: 'gpo',
        phone_masked: maskPhone(body.customer ? (body.customer as { mobile: string }).mobile : ''),
      }),
      expiresAt: new Date(Date.now() + GPO_EXPIRY_MIN * 60_000).toISOString(),
      status: 'pending',
    };
  }

  const entity = ref?.entity != null ? String(ref.entity) : '';
  const reference = ref?.number != null ? String(ref.number) : '';
  if (!entity || !reference) throw new Error('bitpay_missing_reference');
  const expiresAt = ref?.expires_at
    ? new Date(ref.expires_at).toISOString()
    : new Date(Date.now() + REF_EXPIRY_MS).toISOString();
  return {
    providerRef,
    checkoutUrl: returnUrlFor(params, { method: 'ref', entity, reference }),
    expiresAt,
    status: 'pending',
  };
}

// ----------------------------- verifyAndParse ----------------------------

interface PaymentIntentResponse {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  merchant_reference?: string;
  updated_at?: string;
  created_at?: string;
}

function mapStatus(status: string): NormalizedEvent['type'] {
  if (/^(SUCCEEDED|REFUNDED|PARTIALLY_REFUNDED)$/.test(status)) return 'payment.paid';
  if (/^(PENDING|PROCESSING|UNKNOWN)$/.test(status)) return 'payment.pending';
  if (status === 'EXPIRED') return 'payment.expired';
  if (/^(FAILED|CANCELLED)$/.test(status)) return 'payment.failed';
  return 'payment.pending';
}

/** Valida `BitPay-Signature: t=<unix>,v1=<hex>` quando há `whsec_…`. */
async function verifySignature(
  cfg: BitPayConfig,
  rawBody: string,
  headers: Headers,
): Promise<void> {
  if (!cfg.webhookSecret) return;
  const header = headers.get('bitpay-signature') ?? '';
  const match = /(?:^|,)\s*t=(\d+)\s*,\s*v1=([0-9a-f]{64})\s*(?:,|$)/.exec(header);
  if (!match) throw new Error('invalid_signature');
  const [, ts, provided] = match;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 600) throw new Error('signature_expired');
  const expected = await hmacSha256Hex(cfg.webhookSecret, `${ts}.${rawBody}`);
  if (!timingSafeEqual(expected, provided)) throw new Error('invalid_signature');
}

/**
 * Webhook: valida a assinatura (se configurada) e depois RECONSULTA
 * `GET /payment_intents/{id}` — o estado da API é a única fonte de verdade.
 */
async function verifyAndParse(
  rawBody: string,
  headers: Headers,
): Promise<NormalizedEvent> {
  const cfg = getConfig();
  await verifySignature(cfg, rawBody, headers);

  let payload: {
    id?: unknown;
    type?: unknown;
    data?: { id?: unknown; merchant_reference?: unknown };
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    throw new Error('malformed_event');
  }
  const paymentId = typeof payload.data?.id === 'string' ? payload.data.id : '';
  if (!paymentId) throw new Error('missing_payment_id');

  const payment = (await requestJson(
    cfg,
    `/payment_intents/${encodeURIComponent(paymentId)}`,
  )) as PaymentIntentResponse;

  const reference = String(payment.merchant_reference ?? payload.data?.merchant_reference ?? '');
  if (!reference) throw new Error('missing_merchant_reference');

  const status = String(payment.status ?? '');
  const type = mapStatus(status);
  const amountMinor = Math.round(Number(payment.amount ?? 0)) * 100;

  return {
    type,
    // Idempotência pelo id do evento (fallback: pagamento + estado).
    eventId:
      typeof payload.id === 'string' && payload.id ? payload.id : `${paymentId}_${status}`,
    reference,
    providerRef: String(payment.id ?? paymentId),
    amountMinor,
    currency: 'AOA' as Currency,
    paidAt: type === 'payment.paid' ? (payment.updated_at ?? new Date().toISOString()) : null,
    raw: payment,
  };
}

// ------------------------------- provider --------------------------------

export const bitpayProvider: PSPProvider = {
  id: 'bitpay',
  label: 'BitPay',
  supportsCurrency: (currency: Currency) => currency === 'AOA',
  // Sem endpoints de payout implementados: os levantamentos continuam manuais.
  supportsPayouts: false,
  createCheckout,
  verifyAndParse,
};
