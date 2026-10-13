// Supabase Auth "Send SMS" hook -> entrega por WhatsApp (Twilio).
// Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
//
// Corre como Edge Function (Deno). Não faz parte do build do Next.

const encoder = new TextEncoder();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifica a assinatura Standard Webhooks enviada pelo Supabase Auth. */
async function verifySignature(secret: string, req: Request, payload: string): Promise<boolean> {
  const id = req.headers.get('webhook-id');
  const timestamp = req.headers.get('webhook-timestamp');
  const signatureHeader = req.headers.get('webhook-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  // Aceita "v1,whsec_<base64>" ou "<base64>".
  const cleaned = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(cleaned),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signedContent = `${id}.${timestamp}.${payload}`;
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent));
  const expected = bytesToBase64(new Uint8Array(mac));

  return signatureHeader.split(' ').some((part) => {
    const [, sig] = part.split(',');
    return sig ? timingSafeEqual(sig, expected) : false;
  });
}

/** Envia o OTP por WhatsApp via Twilio (Messaging API). */
async function sendWhatsApp(to: string, otp: string): Promise<void> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM');
  const contentSid = Deno.env.get('TWILIO_CONTENT_SID');
  if (!sid || !token || !from) {
    throw new Error('Twilio não configurado (TWILIO_ACCOUNT_SID / AUTH_TOKEN / WHATSAPP_FROM).');
  }

  const body = new URLSearchParams({ From: from, To: `whatsapp:${to}` });
  if (contentSid) {
    // Template aprovado pela Meta — obrigatório para iniciar conversa fora da janela de 24h.
    body.set('ContentSid', contentSid);
    body.set('ContentVariables', JSON.stringify({ '1': otp }));
  } else {
    body.set('Body', `O teu código Tira o Cocó do Meio é ${otp}. Não o partilhes com ninguém.`);
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const payload = await req.text();
  const secret = Deno.env.get('SUPABASE_AUTH_HOOK_SECRET');

  if (secret && !(await verifySignature(secret, req, payload))) {
    return new Response(JSON.stringify({ error: 'assinatura inválida' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { user, sms } = JSON.parse(payload) as {
      user?: { phone?: string };
      sms?: { otp?: string };
    };
    const phone = user?.phone;
    const otp = sms?.otp;
    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: 'payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await sendWhatsApp(phone, otp);

    // 200 = envio aceite; o Supabase considera o hook bem-sucedido.
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro desconhecido';
    console.error('send-sms-hook:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
