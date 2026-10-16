// Edge Function: request-payout
//
// Pedido de levantamento do utilizador autenticado. Desligado por omissão:
// só funciona com `REAL_MONEY_ENABLED=true` E `PAYOUTS_ENABLED=true` (o
// enquadramento legal — BNA, contrato PSP, política KYC/AML — tem de estar
// resolvido antes de ligar).
//
// Garantias:
//   * Exige KYC aprovado (RPC `has_approved_kyc`).
//   * Reserva os fundos (debita o ledger) ANTES de chamar o PSP; se o PSP
//     falhar, reembolsa com uma entrada compensatória (o ledger é append-only).
//
// Deploy: supabase functions deploy request-payout --project-ref <REF>
// (verificação de JWT ATIVA.)

import { createClient } from 'npm:@supabase/supabase-js@2';
import type {
  Currency,
  PayoutDestination,
  PaymentProviderId,
} from '../_shared/payments/types.ts';
import { MAX_PAYOUT_MINOR, MIN_PAYOUT_MINOR } from '../_shared/payments/types.ts';
import { defaultProviderId, getProvider } from '../_shared/payments/providers.ts';
import { creditLedger, debitLedger } from '../_shared/payments/ledger.ts';
import { hasApprovedKyc } from '../_shared/payments/kyc.ts';
import { payoutsEnabled, realMoneyEnabled } from '../_shared/flags.ts';

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

const DESTINATION_TYPES = ['bank_transfer', 'mobile_money', 'express'];

interface PayoutBody {
  amountMinor?: number;
  currency?: string;
  provider?: string;
  destination?: { type?: string; value?: string; holderName?: string };
  idempotencyKey?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  if (!realMoneyEnabled()) return json({ error: 'real_money_disabled' }, 403);
  if (!payoutsEnabled()) return json({ error: 'payouts_disabled' }, 403);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthenticated' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: 'unauthenticated' }, 401);

  let body: PayoutBody;
  try {
    body = (await req.json()) as PayoutBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const amountMinor = Math.trunc(Number(body.amountMinor));
  const currency = (body.currency ?? 'AOA') as Currency;
  const providerId = (body.provider ?? defaultProviderId()) as PaymentProviderId;
  const idempotencyKey = (body.idempotencyKey ?? '').trim();
  const destinationType = (body.destination?.type ?? '').trim();
  const destinationValue = (body.destination?.value ?? '').trim();
  const holderName = (body.destination?.holderName ?? '').trim() || undefined;

  if (!Number.isFinite(amountMinor) || amountMinor < MIN_PAYOUT_MINOR) {
    return json({ error: 'amount_below_minimum', minimumMinor: MIN_PAYOUT_MINOR }, 400);
  }
  if (amountMinor > MAX_PAYOUT_MINOR) {
    return json({ error: 'amount_above_maximum', maximumMinor: MAX_PAYOUT_MINOR }, 400);
  }
  if (currency !== 'AOA') return json({ error: 'currency_not_supported' }, 400);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    return json({ error: 'invalid_idempotency_key' }, 400);
  }
  if (!DESTINATION_TYPES.includes(destinationType)) {
    return json({ error: 'invalid_destination_type' }, 400);
  }
  if (destinationValue.length < 4 || destinationValue.length > 64) {
    return json({ error: 'invalid_destination_value' }, 400);
  }

  const provider = getProvider(providerId);
  if (!provider || !provider.supportsPayouts || typeof provider.createPayout !== 'function') {
    return json({ error: 'provider_payouts_unsupported' }, 400);
  }
  if (!provider.supportsCurrency(currency)) {
    return json({ error: 'provider_currency_unsupported' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!(await hasApprovedKyc(admin, user.id))) {
    return json({ error: 'kyc_required' }, 403);
  }

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

  const existing = (
    await admin.from('payouts').select('*').eq('idempotency_key', idempotencyKey).maybeSingle()
  ).data;
  if (existing) return json(existing, 200);

  const destination: PayoutDestination = {
    type: destinationType as PayoutDestination['type'],
    value: destinationValue,
    holderName,
  };

  const inserted = await admin
    .from('payouts')
    .insert({
      account_id: account.id,
      provider: providerId,
      amount_minor: amountMinor,
      currency,
      status: 'requested',
      destination,
      idempotency_key: idempotencyKey,
    })
    .select('*')
    .single();
  if (inserted.error || !inserted.data) {
    if (inserted.error?.code === '23505') {
      const { data: raced } = await admin
        .from('payouts')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (raced) return json(raced, 200);
    }
    return json({ error: 'payout_create_failed', detail: inserted.error?.message }, 500);
  }

  const payout = inserted.data;
  const nowIso = new Date().toISOString();

  const reserve = await debitLedger(admin, {
    accountId: account.id,
    amountMinor,
    referenceType: 'withdrawal',
    referenceId: payout.id,
    idempotencyKey: `payout:${payout.id}`,
    description: `Reserva de levantamento via ${providerId}`,
  });

  if (!reserve.ok && reserve.reason === 'insufficient_funds') {
    await admin
      .from('payouts')
      .update({ status: 'rejected', failure_reason: 'insufficient_funds', updated_at: nowIso })
      .eq('id', payout.id);
    return json({ error: 'insufficient_funds' }, 400);
  }

  const webhookUrl = `${supabaseUrl}/functions/v1/payout-webhook?provider=${providerId}`;
  try {
    const result = await provider.createPayout!({
      amountMinor,
      currency,
      referenceId: payout.id,
      idempotencyKey,
      destination,
      webhookUrl,
    });

    const updated = await admin
      .from('payouts')
      .update({
        provider_ref: result.providerRef,
        status: result.status,
        updated_at: nowIso,
      })
      .eq('id', payout.id)
      .select('*')
      .single();
    if (updated.error || !updated.data) {
      return json({ error: 'payout_update_failed', detail: updated.error?.message }, 500);
    }
    return json(updated.data, 201);
  } catch (error) {
    await creditLedger(admin, {
      accountId: account.id,
      amountMinor,
      referenceType: 'refund',
      referenceId: payout.id,
      idempotencyKey: `payout_refund:${payout.id}`,
      description: `Reembolso de levantamento falhado (${providerId})`,
    });
    await admin
      .from('payouts')
      .update({
        status: 'failed',
        failure_reason: String((error as Error).message),
        updated_at: nowIso,
      })
      .eq('id', payout.id);
    return json({ error: 'payout_failed', detail: String((error as Error).message) }, 502);
  }
});
