# `send-sms-hook` — entrega do OTP por WhatsApp

Supabase Auth **Send SMS Hook** que recebe o código OTP do login por telefone e o entrega
por **WhatsApp**, usando diretamente a **WhatsApp Cloud API (Meta)** — sem Twilio nem
outros intermediários.

Fluxo: `AuthScreen` → `signInWithOtp({ phone })` → Supabase Auth gera o OTP →
chama este hook (HTTPS) → WhatsApp Cloud API → utilizador recebe o código.

## 1. Segredos da função

```bash
supabase secrets set --project-ref <PROJECT_REF> \
  WHATSAPP_PHONE_NUMBER_ID=1234567890 \
  WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxx \
  WHATSAPP_TEMPLATE_NAME=otp_tira_o_coco \
  WHATSAPP_TEMPLATE_LANG=pt_PT \
  SUPABASE_AUTH_HOOK_SECRET=v1,whsec_xxxxxxxxxxxx
```

- `WHATSAPP_PHONE_NUMBER_ID`: *Phone number ID* do teu número WhatsApp Business
  (Meta → App → WhatsApp → API Setup).
- `WHATSAPP_ACCESS_TOKEN`: token de acesso. Em produção usa um **System User token
  permanente**; o token de teste de 24h expira.
- `WHATSAPP_TEMPLATE_NAME` / `WHATSAPP_TEMPLATE_LANG` *(opcional)*: template
  **authentication** aprovado pela Meta. **Necessário** para iniciar a conversa fora da
  janela de 24h (o caso normal de OTP). Sem ele, o hook envia texto livre, que só chega
  se o utilizador tiver uma conversa aberta nas últimas 24h.
- `WHATSAPP_API_VERSION` *(opcional)*: default `v21.0`.
- `SUPABASE_AUTH_HOOK_SECRET`: segredo que valida a assinatura *Standard Webhooks*.

## 2. Deploy

```bash
supabase functions deploy send-sms-hook --project-ref <PROJECT_REF> --no-verify-jwt
```

`--no-verify-jwt` é obrigatório: o Supabase Auth chama o hook assinado por webhook,
não com um JWT de utilizador.

## 3. Ligar o hook ao Auth

Dashboard → **Authentication → Hooks → Send SMS**:

1. Ativa **HTTPS** e define `https://<PROJECT_REF>.supabase.co/functions/v1/send-sms-hook`.
2. **Generate secret** → copia `v1,whsec_...` para `SUPABASE_AUTH_HOOK_SECRET` (passo 1).
3. Ativa o provider **Phone** em Authentication → Providers.

> Enquanto ativo, este endpoint substitui **todo** o envio de SMS do Auth.

## 4. Desenvolvimento local

```bash
supabase functions serve send-sms-hook --project-ref <PROJECT_REF> --env-file ./supabase/.env.local
```

## Notas sobre WhatsApp Cloud API

- OTP a utilizadores fora da janela de 24h exige **template aprovado**.
- O template deve ter o código em `{{1}}` (categoria *authentication*, ou *utility*).
- Produção: número WhatsApp Business verificado + token permanente de System User.
