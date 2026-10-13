# `send-sms-hook` — entrega do OTP por WhatsApp

Supabase Auth **Send SMS Hook** que recebe o código OTP do login por telefone e o entrega
por **WhatsApp** (via Twilio), em vez do SMS por defeito.

Fluxo: `AuthScreen` → `signInWithOtp({ phone })` → Supabase Auth gera o OTP →
chama este hook (HTTPS) → Twilio WhatsApp → utilizador recebe o código.

## 1. Segredos da função

```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 \
  SUPABASE_AUTH_HOOK_SECRET=v1,whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- `TWILIO_WHATSAPP_FROM`: o teu remetente WhatsApp aprovado (ex.: sandbox Twilio
  `whatsapp:+14155238886`, ou o teu número WhatsApp Business).
- `TWILIO_CONTENT_SID` *(opcional)*: Content Template aprovado pela Meta. **Necessário**
  para iniciar a conversa fora da janela de 24h (o caso normal de OTP). Define-o nos
  segredos e o hook passa a enviar por template com a variável `{{1}}` = código.
- `SUPABASE_AUTH_HOOK_SECRET`: gerado no dashboard (passo 3). Usado para validar a
  assinatura *Standard Webhooks* de cada pedido.

## 2. Deploy

```bash
supabase functions deploy send-sms-hook --no-verify-jwt
```

`--no-verify-jwt` é obrigatório: o Supabase Auth chama o hook assinado por webhook,
não com um JWT de utilizador.

## 3. Configurar no dashboard

Project Settings → **Authentication → Hooks → Send SMS**:

1. Ativa **HTTPS** e define o URL:
   `https://<PROJECT_REF>.supabase.co/functions/v1/send-sms-hook`
2. Clica **Generate secret** e copia o valor `v1,whsec_...`.
3. Define esse valor como `SUPABASE_AUTH_HOOK_SECRET` nos segredos da função (passo 1).

> Enquanto o hook estiver ativo, este endpoint substitui **todo** o envio de SMS do Auth.

## 4. Desenvolvimento local

```bash
supabase functions serve send-sms-hook --env-file ./supabase/.env.local
```

Cria `supabase/.env.local` (ignorado pelo git) com as variáveis acima.

## Notas sobre WhatsApp

- Fora da janela de 24h, a Meta exige **template aprovado** → usa `TWILIO_CONTENT_SID`.
- O sandbox da Twilio só entrega a números que tenham enviado `join <código>` ao sandbox.
- Para produção, usa um número WhatsApp Business verificado.
