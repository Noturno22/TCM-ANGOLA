// Adaptador AppyPay (Angola) — depósitos automáticos (Deno).
//
// Documentação oficial: https://suporte-appypay.freshdesk.com
//   * Autenticação: OAuth2 Client Credentials (Azure AD) com `resource` do
//     merchant. Sandbox e produção têm endpoints e resources distintos.
//   * Cobranças: `POST /v2.0/charges`
//       - `gpo` → Multicaixa Express (push para o telemóvel do cliente);
//       - `ref` → referência a pagar no ATM/Internet Banking.
//   * Webhooks: NÃO têm assinatura. A validação recomendada pela AppyPay é
//     rever-consulta `GET /v2.0/charges/{id}` e só aí confiar no estado —
//     é o que `verifyAndParse` faz (fonte da verdade = a reconsulta).
//   * `merchantTransactionId` é limitado a 15 caracteres alfanuméricos, por
//     isso deriva-se deterministicamente da `idempotency_key` (nunca o uuid).
//     O valor fica também em `payment_intents.metadata.merchant_txn` no
//     insert (antes de contactar a AppyPay) para o webhook localizar a
//     intenção mesmo antes de `provider_ref` estar escrito.
//
// Sem credenciais (`APPYPAY_CLIENT_ID` / `APPYPAY_CLIENT_SECRET`) todos os
// métodos falham com `appypay_not_configured` — nunca fingem sucesso.

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
  tokenUrl: string;
  resource: string;
}

/** Ambiente de testes (portal https://app-tst.appypay.co.ao). */
const SANDBOX: Environment = {
  baseUrl: 'https://gwy-api-tst.appypay.co.ao/v2.0',
  tokenUrl: 'https://login.microsoftonline.com/appypaydev.onmicrosoft.com/oauth2/token',
  resource: '2aed7612-de64-46b5-9e59-1f48f8902d14',
};

/** Produção (portal https://app.appypay.co.ao). */
const PRODUCTION: Environment = {
  baseUrl: 'https://gwy-api.appypay.co.ao/v2.0',
  tokenUrl: 'https://login.microsoftonline.com/appypay.co.ao/oauth2/token',
  resource: 'bee57785-7a19-4f1c-9c8d-aa03f2f0e333',
};

export interface AppyPayConfig extends Environment {
  clientId: string;
  clientSecret: string;
  /** Aplicação (API Key) do método GPO — `GPO_xxx` no portal. */
  gpoMethod: string | null;
  /** Aplicação (API Key) do método REF — `REF_xxx` no portal. */
  refMethod: string | null;
}

/**
 * Lê a configuração das secrets. Devolve `null` quando não há credenciais —
 * nesse caso o provider responde `appypay_not_configured`.
 */
export function config(
  env: (key: string) => string | undefined = Deno.env.get,
): AppyPayConfig | null {
  const clientId = env('APPYPAY_CLIENT_ID');
  const clientSecret = env('APPYPAY_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const base = env('APPYPAY_ENV') === 'production' ? PRODUCTION : SANDBOX;
  return {
    baseUrl: env('APPYPAY_BASE_URL') || base.baseUrl,
    tokenUrl: env('APPYPAY_TOKEN_URL') || base.tokenUrl,
    resource: env('APPYPAY_RESOURCE_ID') || base.resource,
    clientId,
    clientSecret,
    gpoMethod: env('APPYPAY_PAYMENT_METHOD_GPO') || null,
    refMethod: env('APPYPAY_PAYMENT_METHOD_REF') || null,
  };
}

function getConfig(): AppyPayConfig {
  const cfg = config();
  if (!cfg) throw new Error('appypay_not_configured');
  return cfg;
}

// ------------------------------- token -----------------------------------

let tokenCache: { token: string; expiresAt: number } | null = null;

/** Access token OAuth2 (cache local, renova ~60 s antes de expirar). */
async function getAccessToken(cfg: AppyPayConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    resource: cfg.resource,
  });
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`appypay_token_failed_${res.status}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number | string };
  if (!data.access_token) throw new Error('appypay_token_missing');

  const ttlSeconds = Math.max(60, Number(data.expires_in ?? 3599) - 60);
  tokenCache = { token: data.access_token, expiresAt: Date.now() + ttlSeconds * 1000 };
  return tokenCache.token;
}

// ---------------------------- utilitários --------------------------------

class AppyPayHttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`appypay_http_${status}${body ? `: ${body.slice(0, 300)}` : ''}`);
    this.status = status;
    this.body = body;
  }
}

async function postJson(
  cfg: AppyPayConfig,
  token: string,
  path: string,
  payload: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new AppyPayHttpError(res.status, await res.text().catch(() => ''));
  return (await res.json()) as Record<string, unknown>;
}

function fnv1a(str: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Referência de merchant (≤15 alfanuméricos) derivada da `idempotency_key`.
 * Determinística: o mesmo intent gera sempre o mesmo valor, por isso o
 * webhook consegue localizar a linha antes mesmo de `provider_ref` existir.
 */
export function merchantTxnFor(idempotencyKey: string): string {
  const a = fnv1a(idempotencyKey, 0x811c9dc5).toString(36).toUpperCase();
  const b = fnv1a(`${idempotencyKey}|appypay`, 0x9e3779b1).toString(36).toUpperCase();
  return `T${a}${b}`.slice(0, 15).padEnd(15, '0');
}

/** `923 456 789` → `244923456789` (formato que a AppyPay aceita). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) return `244${digits}`;
  if (digits.length === 12 && digits.startsWith('244')) return digits;
  throw new Error('phone_invalid');
}

function maskPhone(phone: string): string {
  return phone.length >= 6 ? `${phone.slice(0, 3)}*****${phone.slice(-2)}` : phone;
}

function newReferenceNumber(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let n = 0;
  for (const b of bytes) n = n * 256 + b;
  return `2${String(n % 100_000_000).padStart(8, '0')}`;
}

/** `2026-10-19T12:34:56` (formato esperado nos `paymentInfo`). */
function localDateTime(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 19);
}

const GPO_EXPIRY_MIN = 15;
const REF_EXPIRY_MS = 72 * 60 * 60 * 1000;

/** URL de retorno do nosso app com os dados de apresentação em query. */
function returnUrlFor(
  params: CreateCheckoutParams,
  extra: Record<string, string | null | undefined>,
): string {
  const url = new URL(params.returnUrl);
  url.searchParams.set('psp', 'appypay');
  url.searchParams.set('intent', params.referenceId);
  for (const [key, value] of Object.entries(extra)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

// ------------------------------ createCheckout ---------------------------

async function createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
  const cfg = getConfig();
  const token = await getAccessToken(cfg);
  const merchantTxn = merchantTxnFor(params.idempotencyKey);
  const amount = Math.round(params.amountMinor) / 100;
  const description = `Deposito TCM ${merchantTxn}`;
  const preferred = params.method ?? (cfg.gpoMethod ? 'gpo' : 'ref');
  const method = preferred.toLowerCase();

  if (method === 'gpo') {
    if (!cfg.gpoMethod) throw new Error('appypay_gpo_not_configured');
    const phoneNumber = normalizePhone(params.customerPhone ?? '');
    const data = await postJson(cfg, token, '/charges', {
      amount,
      currency: 'AOA',
      merchantTransactionId: merchantTxn,
      description,
      paymentMethod: cfg.gpoMethod,
      paymentInfo: { phoneNumber },
    });
    const expiresAt = new Date(Date.now() + GPO_EXPIRY_MIN * 60_000).toISOString();
    return {
      providerRef: merchantTxn,
      checkoutUrl: returnUrlFor(params, {
        method: 'gpo',
        phone_masked: maskPhone(phoneNumber),
        charge_id: typeof data.id === 'string' ? data.id : '',
      }),
      expiresAt,
      status: 'pending',
    };
  }

  if (method === 'ref') {
    if (!cfg.refMethod) throw new Error('appypay_ref_not_configured');
    const referenceNumber = newReferenceNumber();
    const dueDate = localDateTime(REF_EXPIRY_MS);
    const base = {
      amount,
      currency: 'AOA',
      merchantTransactionId: merchantTxn,
      description,
      paymentMethod: cfg.refMethod,
      isAsync: true,
    };
    // A documentação pede `paymentInfo` completo; se o ambiente gerar a
    // referência do lado da AppyPay, recuamos progressivamente (só em 4xx —
    // um 4xx nunca cria a cobrança, por isso não há risco de duplicado).
    const candidates = [
      { ...base, paymentInfo: { referenceNumber, dueDate } },
      { ...base, paymentInfo: { dueDate } },
      base,
    ];
    let data: Record<string, unknown> | null = null;
    let lastError: unknown = null;
    for (const candidate of candidates) {
      try {
        data = await postJson(cfg, token, '/charges', candidate);
        break;
      } catch (error) {
        lastError = error;
        if (!(error instanceof AppyPayHttpError) || error.status >= 500) throw error;
      }
    }
    if (!data) throw lastError ?? new Error('appypay_ref_failed');

    const ref = (data.responseStatus as { reference?: Record<string, unknown> } | undefined)
      ?.reference;
    const entity = ref?.entity != null ? String(ref.entity) : '';
    const reference = ref?.referenceNumber != null ? String(ref.referenceNumber) : referenceNumber;
    return {
      providerRef: merchantTxn,
      checkoutUrl: returnUrlFor(params, {
        method: 'ref',
        entity,
        reference,
        charge_id: typeof data.id === 'string' ? data.id : '',
      }),
      expiresAt: new Date(Date.now() + REF_EXPIRY_MS).toISOString(),
      status: 'pending',
    };
  }

  throw new Error('appypay_method_unknown');
}

// ----------------------------- verifyAndParse ----------------------------

interface ChargeResponse {
  id?: string;
  merchantTransactionId?: string;
  amount?: number;
  responseStatus?: {
    successful?: boolean;
    status?: string;
    code?: number | string;
    message?: string;
  };
}

function mapStatus(status: string, successful: boolean): NormalizedEvent['type'] {
  if (successful || /^(success|paid|completed)$/i.test(status)) return 'payment.paid';
  if (/pending/i.test(status)) return 'payment.pending';
  if (/expir/i.test(status)) return 'payment.expired';
  return 'payment.failed';
}

/**
 * Webhook sem assinatura: valida por rever-consulta `GET /charges/{id}` (a
 * AppyPay recomenda explicitamente este fluxo). Só o estado devolvido pela
 * API é usado — o payload serve apenas para obter o id da cobrança.
 */
async function verifyAndParse(rawBody: string): Promise<NormalizedEvent> {
  const cfg = getConfig();
  const token = await getAccessToken(cfg);

  let payload: { id?: unknown; merchantTransactionId?: unknown; amount?: unknown };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    throw new Error('malformed_event');
  }
  const chargeId = typeof payload.id === 'string' ? payload.id : '';
  if (!chargeId) throw new Error('missing_charge_id');

  const res = await fetch(`${cfg.baseUrl}/charges/${encodeURIComponent(chargeId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`charge_lookup_failed_${res.status}`);
  const charge = (await res.json()) as ChargeResponse;

  const merchantTxn = String(charge.merchantTransactionId ?? payload.merchantTransactionId ?? '');
  if (!merchantTxn) throw new Error('missing_merchant_txn');

  const status = String(charge.responseStatus?.status ?? '');
  const successful = charge.responseStatus?.successful === true;
  const amountMinor = Math.round(Number(charge.amount ?? payload.amount ?? 0) * 100);
  const type = mapStatus(status, successful);

  return {
    type,
    // Idempotência por (cobrança, estado): um "Pending" e um "Success"
    // posteriores são eventos distintos e nenhum é engolido pelo outro.
    eventId: `appypay_${chargeId}_${status || 'unknown'}`,
    reference: merchantTxn,
    providerRef: merchantTxn,
    amountMinor,
    currency: 'AOA' as Currency,
    paidAt: type === 'payment.paid' ? new Date().toISOString() : null,
    raw: charge,
  };
}

// ------------------------------- provider --------------------------------

export const appypayProvider: PSPProvider = {
  id: 'appypay',
  label: 'AppyPay',
  supportsCurrency: (currency: Currency) => currency === 'AOA',
  // Sem endpoints de payout implementados: os levantamentos continuam manuais.
  supportsPayouts: false,
  createCheckout,
  verifyAndParse: (rawBody: string) => verifyAndParse(rawBody),
};
