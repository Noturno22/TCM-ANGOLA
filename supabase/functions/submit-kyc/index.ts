// Edge Function: submit-kyc
//
// Recebe os METADADOS de um pedido de KYC. Os documentos já foram enviados pelo
// cliente para o bucket privado `kyc-documents/<uid>/...` (RLS permite só a
// própria pasta); aqui validamos que os caminhos pertencem ao utilizador e
// criamos o registo em `kyc_records` (status `pending`). A aprovação é feita
// fora do fluxo do utilizador (revisão manual / serviço).
//
// Deploy: supabase functions deploy submit-kyc --project-ref <REF>
// (verificação de JWT ATIVA — o cliente envia a sessão.)

import { createClient } from 'npm:@supabase/supabase-js@2';
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

const ALLOWED_DOCUMENT_TYPES = ['BI', 'passport', 'driver_license'];

interface KycBody {
  documentType?: string;
  documentNumber?: string;
  documentFrontPath?: string;
  documentBackPath?: string;
  selfiePath?: string;
  addressProofPath?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  if (!realMoneyEnabled()) return json({ error: 'real_money_disabled' }, 403);

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

  let body: KycBody;
  try {
    body = (await req.json()) as KycBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const documentType = (body.documentType ?? '').trim();
  const documentNumber = (body.documentNumber ?? '').trim();
  const documentFrontPath = (body.documentFrontPath ?? '').trim();
  const documentBackPath = (body.documentBackPath ?? '').trim() || null;
  const selfiePath = (body.selfiePath ?? '').trim() || null;
  const addressProofPath = (body.addressProofPath ?? '').trim() || null;

  if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
    return json({ error: 'invalid_document_type' }, 400);
  }
  if (documentNumber.length < 4 || documentNumber.length > 40) {
    return json({ error: 'invalid_document_number' }, 400);
  }

  const ownedPrefix = `${user.id}/`;
  const paths = [documentFrontPath, documentBackPath, selfiePath, addressProofPath].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length === 0 || !paths.every((p) => p.startsWith(ownedPrefix))) {
    return json({ error: 'invalid_document_path', expectedPrefix: ownedPrefix }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const alreadyApproved = (
    await admin
      .from('kyc_records')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle()
  ).data;
  if (alreadyApproved) return json({ error: 'kyc_already_approved', record: alreadyApproved }, 409);

  const pending = (
    await admin
      .from('kyc_records')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'requires_review'])
      .maybeSingle()
  ).data;
  if (pending) return json({ error: 'kyc_already_pending', record: pending }, 409);

  const inserted = await admin
    .from('kyc_records')
    .insert({
      user_id: user.id,
      status: 'pending',
      document_type: documentType,
      document_number: documentNumber,
      document_front_url: documentFrontPath,
      document_back_url: documentBackPath,
      selfie_url: selfiePath,
      address_proof_url: addressProofPath,
    })
    .select('id, status, document_type, created_at')
    .single();

  if (inserted.error || !inserted.data) {
    return json({ error: 'kyc_create_failed', detail: inserted.error?.message }, 500);
  }
  return json(inserted.data, 201);
});
