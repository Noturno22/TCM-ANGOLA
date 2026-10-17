// Edge Function: admin-manage
//
// Ações administrativas dos depósitos/levantamentos manuais. Portado do TMT
// (mesma semântica de estados e transições atómicas), mas o dinheiro move-se
// no ledger REAL do TCM (public.ledger_credit / public.ledger_debit), nunca em
// tabelas de capital.
//
// Autorização: o utilizador tem de estar autenticado (JWT) E o seu email tem de
// estar em `ADMIN_EMAILS` (segredo da função, lista separada por vírgulas).
//
// Ações:
//   list_receipts | approve_receipt | reject_receipt | delete_receipt | save_receipt
//   list_withdrawals | approve_withdrawal | reject_withdrawal | mark_withdrawal_paid
//   list_notifications | mark_notification_read | mark_all_notifications_read | unread_count
//   revenue_stats
//
// Dinheiro:
//   * approve_receipt        → credita a conta da moeda (entrada de depósito).
//   * mark_withdrawal_paid   → debita a conta da moeda (saída efetiva).
//   Ambas exigem `REAL_MONEY_ENABLED=true` (D6) e são idempotentes
//   (`idempotency_key = receipt:<id>` / `withdrawal:<id>`).
//
// Deploy: supabase functions deploy admin-manage --project-ref <REF> --use-api
// (verificação de JWT ATIVA.)

import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { creditLedger, debitLedger } from '../_shared/payments/ledger.ts';
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

function errorJson(message: string, status = 400): Response {
  return json({ error: message }, status);
}

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// União discriminada para o TypeScript estreitar `user` após o `if`.
type AdminAuth = { user: User; error: null } | { user: null; error: string };

async function verifyAdmin(
  admin: SupabaseClient,
  req: Request,
): Promise<AdminAuth> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return { user: null, error: 'Não autenticado.' };

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(jwt);
  if (error || !user) return { user: null, error: 'Não autenticado.' };

  const email = (user.email ?? '').trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) return { user: null, error: 'Acesso negado.' };

  return { user, error: null };
}

/** Moedas das tabelas manuais (minúsculas) → moeda do ledger (maiúsculas). */
function ledgerCurrency(currency: unknown): 'USD' | 'AOA' {
  return String(currency ?? '').toLowerCase() === 'usd' ? 'USD' : 'AOA';
}

/** Montante em unidades maiores → unidades menores do ledger (×100). */
function toMinor(amount: unknown): number {
  return Math.round(Number(amount ?? 0) * 100);
}

/** Garante que existe a conta de ledger da moeda e devolve o seu id. */
async function ensureAccount(
  admin: SupabaseClient,
  userId: string,
  currency: 'USD' | 'AOA',
): Promise<string | null> {
  const existing = await admin
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('currency', currency)
    .maybeSingle();
  if (existing.data) return existing.data.id as string;

  const created = await admin
    .from('accounts')
    .insert({ user_id: userId, currency })
    .select('id')
    .single();
  if (created.error || !created.data) return null;
  return created.data.id as string;
}

// ── Comprovativos (depósitos) ───────────────────────────────────────────────

async function handleApproveReceipt(
  admin: SupabaseClient,
  body: Record<string, unknown>,
  reviewedBy: string,
): Promise<Response> {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return errorJson('id em falta.');

  if (!realMoneyEnabled()) return errorJson('real_money_disabled', 403);

  const { data: receipt, error: fetchErr } = await admin
    .from('payment_receipts')
    .select('id, user_id, amount, currency, status')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return errorJson(fetchErr.message, 500);
  if (!receipt) return errorJson('Comprovativo não encontrado.', 404);

  // Transição atómica pending → approved: só quem a consegue creditará.
  const { data: transitioned, error: updateErr } = await admin
    .from('payment_receipts')
    .update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (updateErr) return errorJson(updateErr.message, 500);
  if (!transitioned) return json({ approved: true, alreadyProcessed: true });

  const userId = receipt.user_id as string;
  const currency = ledgerCurrency(receipt.currency);
  const amountMinor = toMinor(receipt.amount);

  if (amountMinor <= 0) {
    return json({ approved: true, credited: false, reason: 'amount_zero' });
  }

  const accountId = await ensureAccount(admin, userId, currency);
  if (!accountId) {
    await admin.from('payment_receipts').update({ status: 'pending' }).eq('id', id);
    return errorJson('account_create_failed', 500);
  }

  try {
    const result = await creditLedger(admin, {
      accountId,
      amountMinor,
      referenceType: 'deposit',
      referenceId: id,
      idempotencyKey: `receipt:${id}`,
      description: `Depósito aprovado (${String(receipt.currency ?? '').toUpperCase()})`,
    });
    return json({
      approved: true,
      credited: true,
      alreadyCredited: result.ok ? false : result.reason === 'duplicate',
    });
  } catch (error) {
    // Reverter para pending para o admin poder tentar de novo sem ficar
    // "aprovado sem crédito".
    await admin.from('payment_receipts').update({ status: 'pending' }).eq('id', id);
    return errorJson(`credit_failed: ${(error as Error).message}`, 500);
  }
}

async function handleRejectReceipt(
  admin: SupabaseClient,
  body: Record<string, unknown>,
  reviewedBy: string,
): Promise<Response> {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return errorJson('id em falta.');

  const { data: transitioned, error } = await admin
    .from('payment_receipts')
    .update({
      status: 'rejected',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) return errorJson(error.message, 500);
  if (!transitioned) return json({ rejected: true, alreadyProcessed: true });
  return json({ rejected: true });
}

async function handleDeleteReceipt(
  admin: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return errorJson('id em falta.');
  const { error } = await admin.from('payment_receipts').delete().eq('id', id);
  if (error) return errorJson(error.message, 500);
  return json({ deleted: true });
}

async function handleSaveReceipt(
  admin: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const userId = typeof body.user_id === 'string' ? body.user_id : '';
  const proofUrl = typeof body.proof_url === 'string' ? body.proof_url : '';
  if (!userId || !proofUrl) return errorJson('user_id e proof_url são obrigatórios.');

  const { data, error } = await admin
    .from('payment_receipts')
    .insert({
      user_id: userId,
      user_email: typeof body.user_email === 'string' ? body.user_email : null,
      proof_url: proofUrl,
      plan: typeof body.plan === 'string' ? body.plan : 'wallet',
      method: typeof body.method === 'string' ? body.method : '',
      amount: Number(body.amount) || 0,
      currency: typeof body.currency === 'string' ? body.currency : 'aoa',
      status: 'pending',
    })
    .select()
    .single();
  if (error) return errorJson(error.message, 500);
  return json({ receipt: data });
}

// ── Levantamentos ───────────────────────────────────────────────────────────

async function handleMarkWithdrawalPaid(
  admin: SupabaseClient,
  body: Record<string, unknown>,
  reviewedBy: string,
): Promise<Response> {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return errorJson('id em falta.');

  if (!realMoneyEnabled()) return errorJson('real_money_disabled', 403);

  const { data: request, error: fetchErr } = await admin
    .from('withdrawal_requests')
    .select('id, user_id, amount, currency')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return errorJson(fetchErr.message, 500);
  if (!request) return errorJson('Levantamento não encontrado.', 404);

  // Transição atómica approved → paid (evita pagamento duplo).
  const { data: transitioned, error: updateErr } = await admin
    .from('withdrawal_requests')
    .update({
      status: 'paid',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'approved')
    .select('id')
    .maybeSingle();
  if (updateErr) return errorJson(updateErr.message, 500);
  if (!transitioned) return errorJson('Levantamento não está aprovado ou já foi pago.', 409);

  const userId = request.user_id as string;
  const currency = ledgerCurrency(request.currency);
  const amountMinor = toMinor(request.amount);

  if (amountMinor <= 0) return json({ ok: true, debited: false, reason: 'amount_zero' });

  const accountId = await ensureAccount(admin, userId, currency);
  if (!accountId) {
    await admin.from('withdrawal_requests').update({ status: 'approved' }).eq('id', id);
    return errorJson('account_create_failed', 500);
  }

  const result = await debitLedger(admin, {
    accountId,
    amountMinor,
    referenceType: 'withdrawal',
    referenceId: id,
    idempotencyKey: `withdrawal:${id}`,
    description: `Levantamento pago (${String(request.currency ?? '').toUpperCase()})`,
  });

  if (!result.ok && result.reason === 'insufficient_funds') {
    await admin.from('withdrawal_requests').update({ status: 'approved' }).eq('id', id);
    return errorJson('insufficient_funds', 400);
  }

  return json({
    ok: true,
    debited: true,
    alreadyDebited: result.ok ? false : result.reason === 'duplicate',
  });
}

// ── Notificações / estatísticas ─────────────────────────────────────────────

async function handleRevenueStats(admin: SupabaseClient): Promise<Response> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const startOfLastMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  ).toISOString();

  const [thisMonth, lastMonth, pendingWithdrawals, pendingReceipts] = await Promise.all([
    admin
      .from('payment_receipts')
      .select('amount, currency')
      .eq('status', 'approved')
      .gte('created_at', startOfMonth),
    admin
      .from('payment_receipts')
      .select('amount, currency')
      .eq('status', 'approved')
      .gte('created_at', startOfLastMonth)
      .lt('created_at', startOfMonth),
    admin.from('withdrawal_requests').select('amount, currency').eq('status', 'pending'),
    admin.from('payment_receipts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const firstError =
    thisMonth.error || lastMonth.error || pendingWithdrawals.error || pendingReceipts.error;
  if (firstError) return errorJson(firstError.message, 500);

  const sumByCurrency = (rows: { amount: unknown; currency: unknown }[] | null) => {
    const out: Record<string, number> = {};
    for (const r of rows ?? []) {
      const cur = String(r.currency ?? 'aoa').toLowerCase();
      out[cur] = (out[cur] ?? 0) + Number(r.amount ?? 0);
    }
    return out;
  };

  return json({
    thisMonthRevenue: sumByCurrency(thisMonth.data),
    lastMonthRevenue: sumByCurrency(lastMonth.data),
    thisMonthCount: (thisMonth.data ?? []).length,
    pendingWithdrawalsAmount: sumByCurrency(pendingWithdrawals.data),
    pendingReceiptsCount: pendingReceipts.count ?? 0,
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorJson('Método não permitido.', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await verifyAdmin(admin, req);
  if (auth.error !== null) return errorJson(auth.error, 401);
  const reviewerId = auth.user.id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorJson('JSON inválido.', 400);
  }

  const action = String(body.action ?? '');
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
  const offset = Math.max(Number(body.offset) || 0, 0);

  switch (action) {
    case 'list_receipts': {
      let query = admin
        .from('payment_receipts')
        .select('*')
        .order('created_at', { ascending: false });
      if (typeof body.status === 'string' && body.status) query = query.eq('status', body.status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return errorJson(error.message, 500);
      return json({ receipts: data });
    }
    case 'approve_receipt':
      return handleApproveReceipt(admin, body, reviewerId);
    case 'reject_receipt':
      return handleRejectReceipt(admin, body, reviewerId);
    case 'delete_receipt':
      return handleDeleteReceipt(admin, body);
    case 'save_receipt':
      return handleSaveReceipt(admin, body);

    case 'list_withdrawals': {
      let query = admin
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (typeof body.status === 'string' && body.status) query = query.eq('status', body.status);
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return errorJson(error.message, 500);
      return json({ withdrawals: data });
    }
    case 'approve_withdrawal': {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return errorJson('id em falta.');
      const { data: transitioned, error } = await admin
        .from('withdrawal_requests')
        .update({
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      if (error) return errorJson(error.message, 500);
      if (!transitioned) return json({ ok: true, alreadyProcessed: true });
      return json({ ok: true });
    }
    case 'reject_withdrawal': {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return errorJson('id em falta.');
      const { data: transitioned, error } = await admin
        .from('withdrawal_requests')
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          notes: typeof body.notes === 'string' ? body.notes : null,
        })
        .eq('id', id)
        .in('status', ['pending', 'approved'])
        .select('id')
        .maybeSingle();
      if (error) return errorJson(error.message, 500);
      if (!transitioned) return json({ ok: true, alreadyProcessed: true });
      return json({ ok: true });
    }
    case 'mark_withdrawal_paid':
      return handleMarkWithdrawalPaid(admin, body, reviewerId);

    case 'list_notifications': {
      const { data, error } = await admin
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return errorJson(error.message, 500);
      return json({ data });
    }
    case 'mark_notification_read': {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return errorJson('id em falta.');
      const { error } = await admin.from('admin_notifications').update({ read: true }).eq('id', id);
      if (error) return errorJson(error.message, 500);
      return json({ updated: true });
    }
    case 'mark_all_notifications_read': {
      const { error } = await admin
        .from('admin_notifications')
        .update({ read: true })
        .eq('read', false);
      if (error) return errorJson(error.message, 500);
      return json({ updated: true });
    }
    case 'unread_count': {
      const { count, error } = await admin
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);
      if (error) return errorJson(error.message, 500);
      return json({ count: count ?? 0 });
    }

    case 'revenue_stats':
      return handleRevenueStats(admin);

    default:
      return errorJson('Ação desconhecida.', 400);
  }
});
