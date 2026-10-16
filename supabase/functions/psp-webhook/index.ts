// Edge Function: psp-webhook
//
// Recebe callbacks do PSP (?provider=<id>). Verifica a assinatura, garante
// idempotência (tabela processed_webhooks) e credita o saldo via
// `ledger_credit` quando o pagamento é confirmado.
//
// Deploy: supabase functions deploy psp-webhook --project-ref <REF> --no-verify-jwt
// (--no-verify-jwt é obrigatório: o PSP não envia um JWT de utilizador.)

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  creditLedger,
  markWebhookProcessed,
  wasWebhookProcessed,
} from '../_shared/payments/ledger.ts';
import { getProvider, isKnownProvider } from '../_shared/payments/providers.ts';
import type { NormalizedEvent } from '../_shared/payments/types.ts';
import { realMoneyEnabled } from '../_shared/flags.ts';

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  if (!realMoneyEnabled()) return json({ error: 'real_money_disabled' }, 403);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const providerId = new URL(req.url).searchParams.get('provider') ?? '';
  if (!isKnownProvider(providerId)) return json({ error: 'unknown_provider' }, 400);
  const provider = getProvider(providerId)!;

  const rawBody = await req.text();
  let event: NormalizedEvent;
  try {
    event = await provider.verifyAndParse(rawBody, req.headers);
  } catch (error) {
    return json({ error: 'invalid_webhook', detail: String((error as Error).message) }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Idempotência por evento do provider ----
  if (await wasWebhookProcessed(admin, providerId, event.eventId)) {
    return json({ ok: true, duplicate: true }, 200);
  }

  // ---- Localiza a intenção (via idempotency_key = reference) ----
  const { data: intent } = await admin
    .from('payment_intents')
    .select('*')
    .eq('idempotency_key', event.reference)
    .maybeSingle();

  if (!intent) return json({ ok: false, reason: 'intent_not_found' }, 200);

  const nowIso = new Date().toISOString();

  // ---- Pagamento confirmado ----
  if (event.type === 'payment.paid') {
    if (event.amountMinor !== intent.amount_minor || event.currency !== intent.currency) {
      return json({ ok: false, reason: 'amount_mismatch' }, 200);
    }
    if (intent.status === 'paid') {
      await markWebhookProcessed(admin, {
        provider: providerId,
        eventId: event.eventId,
        eventType: event.type,
        paymentIntentId: intent.id,
      });
      return json({ ok: true, already_paid: true }, 200);
    }

    // Idempotency key determinística: mesmo com webhooks repetidos, credita 1x.
    const credit = await creditLedger(admin, {
      accountId: intent.account_id,
      amountMinor: event.amountMinor,
      referenceType: 'deposit',
      referenceId: intent.id,
      idempotencyKey: `deposit:${intent.id}`,
      description: `Depósito via ${providerId}`,
    });

    await admin
      .from('payment_intents')
      .update({
        status: 'paid',
        paid_at: event.paidAt ?? nowIso,
        provider_ref: event.providerRef,
        updated_at: nowIso,
      })
      .eq('id', intent.id);

    await markWebhookProcessed(admin, {
      provider: providerId,
      eventId: event.eventId,
      eventType: event.type,
      paymentIntentId: intent.id,
    });

    return json(
      {
        ok: true,
        credited: credit.ok,
        balanceMinor: credit.ok ? credit.entry.balance_after : null,
      },
      200,
    );
  }

  // ---- Pagamento falhado / expirado ----
  if (event.type === 'payment.failed' || event.type === 'payment.expired') {
    const status = event.type === 'payment.failed' ? 'failed' : 'expired';
    if (intent.status !== 'paid') {
      await admin
        .from('payment_intents')
        .update({ status, provider_ref: event.providerRef, updated_at: nowIso })
        .eq('id', intent.id);
    }
    await markWebhookProcessed(admin, {
      provider: providerId,
      eventId: event.eventId,
      eventType: event.type,
      paymentIntentId: intent.id,
    });
    return json({ ok: true, status }, 200);
  }

  // ---- Reembolso concluído: debita a carteira ----
  if (event.type === 'refund.completed') {
    const { error: debitError } = await admin.rpc('ledger_debit', {
      p_account_id: intent.account_id,
      p_amount_minor: event.amountMinor || intent.amount_minor,
      p_reference_type: 'refund',
      p_reference_id: intent.id,
      p_idempotency_key: `refund:${intent.id}`,
      p_description: `Reembolso via ${providerId}`,
    });
    if (debitError && !/duplicate key/i.test(debitError.message)) {
      // Saldo insuficiente para refletir o reembolso → requer intervenção.
      return json({ ok: false, reason: 'refund_debit_failed', detail: debitError.message }, 200);
    }
    await admin
      .from('payment_intents')
      .update({ status: 'refunded', updated_at: nowIso })
      .eq('id', intent.id);
    await markWebhookProcessed(admin, {
      provider: providerId,
      eventId: event.eventId,
      eventType: event.type,
      paymentIntentId: intent.id,
    });
    return json({ ok: true, status: 'refunded' }, 200);
  }

  return json({ ok: false, reason: 'unhandled_event' }, 200);
});
