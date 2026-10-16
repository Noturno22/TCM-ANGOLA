// Edge Function: payout-webhook
//
// Callbacks do PSP para levantamentos (?provider=<id>). Idempotente por evento.
// Os fundos já foram debitados em `request-payout`; aqui apenas confirmamos o
// estado (`payout.paid`) ou reembolsamos em caso de falha (`payout.failed`).
//
// Deploy: supabase functions deploy payout-webhook --project-ref <REF> --no-verify-jwt

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

  if (await wasWebhookProcessed(admin, providerId, event.eventId)) {
    return json({ ok: true, duplicate: true }, 200);
  }

  const { data: payout } = await admin
    .from('payouts')
    .select('*')
    .eq('idempotency_key', event.reference)
    .maybeSingle();

  if (!payout) return json({ ok: false, reason: 'payout_not_found' }, 200);

  const nowIso = new Date().toISOString();

  if (event.type === 'payout.paid') {
    if (payout.status !== 'paid') {
      await admin
        .from('payouts')
        .update({ status: 'paid', provider_ref: event.providerRef, processed_at: nowIso, updated_at: nowIso })
        .eq('id', payout.id);
    }
    await markWebhookProcessed(admin, {
      provider: providerId,
      eventId: event.eventId,
      eventType: event.type,
    });
    return json({ ok: true, status: 'paid' }, 200);
  }

  if (event.type === 'payout.failed') {
    let refunded = false;
    if (payout.status !== 'failed' && payout.status !== 'rejected') {
      const refund = await creditLedger(admin, {
        accountId: payout.account_id,
        amountMinor: payout.amount_minor,
        referenceType: 'refund',
        referenceId: payout.id,
        idempotencyKey: `payout_refund:${payout.id}`,
        description: `Reembolso de levantamento falhado (${providerId})`,
      });
      refunded = refund.ok;
      await admin
        .from('payouts')
        .update({
          status: 'failed',
          failure_reason: 'psp_reported_failure',
          updated_at: nowIso,
        })
        .eq('id', payout.id);
    }
    await markWebhookProcessed(admin, {
      provider: providerId,
      eventId: event.eventId,
      eventType: event.type,
    });
    return json({ ok: true, status: 'failed', refunded }, 200);
  }

  return json({ ok: false, reason: 'unhandled_event' }, 200);
});
