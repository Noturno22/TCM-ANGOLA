// Edge Function: create-deposit-intent
//
// Cria uma intenção de depósito para o utilizador autenticado e devolve o URL
// de checkout do PSP. O saldo NÃO é creditado aqui — só o webhook do PSP
// (`psp-webhook`) pode creditar, via RPC `ledger_credit`.
//
// Deploy: supabase functions deploy create-deposit-intent --project-ref <REF>
// (verificação de JWT ATIVA — o cliente envia a sessão).

import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Currency, PaymentProviderId } from '../_shared/payments/types.ts';
import {
  MAX_DEPOSIT_MINOR,
  MIN_DEPOSIT_MINOR,
} from '../_shared/payments/types.ts';
import { getProvider, isKnownProvider } from '../_shared/payments/providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface DepositBody {
  amountMinor?: number;
  currency?: string;
  provider?: string;
  idempotencyKey?: string;
  returnUrl?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const defaultReturnUrl =
    Deno.env.get('PAYMENTS_RETURN_URL') ?? Deno.env.get('APP_URL') ?? 'http://localhost:3000';

  // ---- Autenticação: o pedido traz o JWT do utilizador ----
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthenticated' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: 'unauthenticated' }, 401);

  // ---- Validação do corpo ----
  let body: DepositBody;
  try {
    body = (await req.json()) as DepositBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const amountMinor = Math.trunc(Number(body.amountMinor));
  const currency = (body.currency ?? 'AOA') as Currency;
  const providerId = (body.provider ?? '') as PaymentProviderId;
  const idempotencyKey = (body.idempotencyKey ?? '').trim();
  const returnUrl = (body.returnUrl ?? defaultReturnUrl).trim();

  if (!Number.isFinite(amountMinor) || amountMinor < MIN_DEPOSIT_MINOR) {
    return json({ error: 'amount_below_minimum', minimumMinor: MIN_DEPOSIT_MINOR }, 400);
  }
  if (amountMinor > MAX_DEPOSIT_MINOR) {
    return json({ error: 'amount_above_maximum', maximumMinor: MAX_DEPOSIT_MINOR }, 400);
  }
  if (currency !== 'AOA') return json({ error: 'currency_not_supported' }, 400);
  if (!isKnownProvider(providerId)) return json({ error: 'unknown_provider' }, 400);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    return json({ error: 'invalid_idempotency_key' }, 400);
  }

  const provider = getProvider(providerId)!;
  if (!provider.supportsCurrency(currency)) {
    return json({ error: 'provider_currency_unsupported' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Conta (carteira) AOA do utilizador ----
  let account = (
    await admin
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .maybeSingle()
  ).data;

  if (!account) {
    const created = await admin
      .from('accounts')
      .insert({ user_id: user.id, currency })
      .select('*')
      .single();
    if (created.error || !created.data) {
      return json({ error: 'account_create_failed', detail: created.error?.message }, 500);
    }
    account = created.data;
  }

  // ---- Idempotência: devolve a intenção já existente ----
  const existing = (
    await admin.from('payment_intents').select('*').eq('idempotency_key', idempotencyKey).maybeSingle()
  ).data;
  if (existing) {
    if (existing.account_id !== account.id) return json({ error: 'idempotency_key_conflict' }, 409);
    return json(existing, 200);
  }

  // ---- Cria a intenção ANTES do checkout (referência de merchant = intent.id) ----
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const inserted = await admin
    .from('payment_intents')
    .insert({
      account_id: account.id,
      provider: providerId,
      amount_minor: amountMinor,
      currency,
      status: 'created',
      idempotency_key: idempotencyKey,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (inserted.error || !inserted.data) {
    // Corrida entre dois pedidos iguais: devolve o que já existe.
    if (inserted.error?.code === '23505') {
      const { data: raced } = await admin
        .from('payment_intents')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (raced) return json(raced, 200);
    }
    return json({ error: 'intent_create_failed', detail: inserted.error?.message }, 500);
  }

  const intent = inserted.data;

  // ---- Checkout no PSP ----
  const webhookUrl = `${supabaseUrl}/functions/v1/psp-webhook?provider=${providerId}`;
  try {
    const checkout = await provider.createCheckout({
      amountMinor,
      currency,
      referenceId: intent.id,
      idempotencyKey,
      returnUrl,
      webhookUrl,
    });

    const updated = await admin
      .from('payment_intents')
      .update({
        provider_ref: checkout.providerRef,
        checkout_url: checkout.checkoutUrl,
        status: checkout.status,
        expires_at: checkout.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intent.id)
      .select('*')
      .single();

    if (updated.error || !updated.data) {
      return json({ error: 'intent_update_failed', detail: updated.error?.message }, 500);
    }
    return json(updated.data, 201);
  } catch (error) {
    await admin
      .from('payment_intents')
      .update({
        status: 'failed',
        metadata: { error: String((error as Error).message) },
        updated_at: new Date().toISOString(),
      })
      .eq('id', intent.id);
    return json({ error: 'checkout_failed', detail: String((error as Error).message) }, 502);
  }
});
