// Supabase Auth "Send SMS" hook -> entrega por WhatsApp via WhatsApp Cloud API (Meta).
// Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
//       https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
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

/**
 * Envia o OTP por WhatsApp via WhatsApp Cloud API (Meta), sem intermediários.
 *
 * Se `WHATSAPP_TEMPLATE_NAME` estiver definido, envia por template (obrigatório para
 * iniciar conversa fora da janela de 24h — caso normal de OTP). Caso contrário, envia
 * texto livre (só funciona dentro de uma conversa aberta nas últimas 24h).
 */
async function sendWhatsApp(to: string, otp: string): Promise<void> {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const apiVersion = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v21.0';
  const templateName = Deno.env.get('WHATSAPP_TEMPLATE_NAME');
  const templateLang = Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'pt_PT';
  if (!phoneNumberId || !accessToken) {
    throw new Error(
      'WhatsApp não configurado (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN).',
    );
  }

  // A Cloud API espera o número só com dígitos (sem "+").
  const recipient = to.replace(/\D/g, '');

  const payload = templateName
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [{ type: 'body', parameters: [{ type: 'text', text: otp }] }],
        },
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: false,
          body: `O teu código Tira o Cocó do Meio é ${otp}. Não o partilhes com ninguém.`,
        },
      };

  const res = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new Error(`WhatsApp Cloud API ${res.status}: ${await res.text()}`);
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
