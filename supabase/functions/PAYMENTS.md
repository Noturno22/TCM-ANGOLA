# Pagamentos (carteira AOA)

Slice de dinheiro real: **ledger double-entry append-only** (Postgres) + Edge
Functions. O saldo só muda no servidor, através de RPCs `SECURITY DEFINER`
executáveis apenas por `service_role`.

## Chave-mestra `REAL_MONEY_ENABLED` (D6)

Todo o subsistema de dinheiro real está **desligado por omissão** atrás de uma
única chave-mestra:

| Âmbito | Variável | Default |
|---|---|---|
| Cliente (browser) | `NEXT_PUBLIC_REAL_MONEY_ENABLED` | `false` |
| Servidor (Edge Functions) | `REAL_MONEY_ENABLED` (segredo) | `false` |

Com a chave desligada **não existe nenhum caminho de dinheiro real ativo**:

- UI: a carteira AOA mostra apenas um aviso "em breve"; os levantamentos ficam
  ocultos; nenhum provider é dado como disponível.
- Cliente: `createDeposit`/`submitKyc`/`uploadKycDocument`/`requestPayout`
  lançam `dinheiro_real_desativado` **antes** de contactar o backend.
- Servidor: `create-deposit-intent`, `submit-kyc`, `psp-webhook`,
  `payout-webhook` e `request-payout` respondem `403 real_money_disabled`.

As sub-flags (`NEXT_PUBLIC_PAYOUTS_ENABLED` / `PAYOUTS_ENABLED`) só têm efeito
com a chave-mestra ligada. Nunca ligar antes de resolvido o enquadramento legal
(BNA, contrato PSP, política KYC/AML).

## Componentes

| Peça | Caminho |
|---|---|
| Schema depósito (tabelas + RLS + RPCs) | `supabase/migrations/0002_payments.sql` |
| Schema KYC/levantamentos (bucket + helper) | `supabase/migrations/0003_kyc_payouts.sql` |
| Tipos/helpers do cliente | `src/lib/payments/*` |
| UI da carteira | `src/components/payments/AoaWalletPanel.tsx` |
| Cria intenção + checkout | `supabase/functions/create-deposit-intent` |
| Recebe webhook do PSP (depósito) | `supabase/functions/psp-webhook` |
| Submete KYC (metadados) | `supabase/functions/submit-kyc` |
| Pede levantamento | `supabase/functions/request-payout` |
| Recebe webhook do PSP (levantamento) | `supabase/functions/payout-webhook` |
| Adaptadores PSP + mock + ledger + kyc | `supabase/functions/_shared/payments/` |

## Invariantes de segurança (não violar)

- O cliente **nunca** escreve no ledger (RLS de leitura apenas; sem INSERT/UPDATE/DELETE).
- Só `ledger_credit` / `ledger_debit` escrevem; `EXECUTE` restrito a `service_role`.
- `ledger_entries` é imutável (sem UPDATE/DELETE nem para `service_role`).
- Crédito é idempotente por `idempotency_key` (unique) e por `deposit:<intent_id>`.
- Webhooks verificam assinatura e são idempotentes por `(provider, provider_event_id)`.
- **Levantamentos exigem KYC aprovado** (`has_approved_kyc`) e reservam os fundos
  antes de chamar o PSP; falha do PSP é compensada com entrada de reembolso
  (o ledger nunca é editado — só recebe novas entradas).
- **Todo o dinheiro real está DESLIGADO por omissão** (`REAL_MONEY_ENABLED=false`).
  Mesmo com a chave-mestra ligada, os levantamentos continuam desligados até
  `PAYOUTS_ENABLED=true`. Não ligar antes de resolvido o enquadramento legal
  (BNA, contrato PSP, KYC/AML).

## Segredos das funções

```bash
supabase secrets set --project-ref <REF> \
  REAL_MONEY_ENABLED=false \
  MOCK_WEBHOOK_SECRET=<segredo-hmac-do-mock> \
  PAYMENTS_DEFAULT_PROVIDER=mock \
  PAYMENTS_RETURN_URL=http://localhost:3000 \
  PAYOUTS_ENABLED=false
# AppyPay (depósitos automáticos) — ver secção "Ligar um PSP real":
#   APPYPAY_ENV, APPYPAY_CLIENT_ID, APPYPAY_CLIENT_SECRET,
#   APPYPAY_PAYMENT_METHOD_GPO, APPYPAY_PAYMENT_METHOD_REF
```

## Deploy

```bash
supabase functions deploy create-deposit-intent --project-ref <REF>
supabase functions deploy psp-webhook         --project-ref <REF> --no-verify-jwt
supabase functions deploy submit-kyc          --project-ref <REF>
supabase functions deploy request-payout      --project-ref <REF>
supabase functions deploy payout-webhook      --project-ref <REF> --no-verify-jwt
```

Os `*-webhook` usam `--no-verify-jwt` (o PSP não envia JWT de utilizador; a
autenticação é a assinatura HMAC do próprio webhook). As restantes exigem JWT.

## Levantamentos (payouts)

Fluxo: o cliente envia documentos para o bucket privado `kyc-documents/<uid>/...`
(RLS só permite a própria pasta) e chama `submit-kyc` com os caminhos; depois
`request-payout` valida o pedido, reserva o valor (débito `withdrawal`) e inicia
o levantamento no PSP. O webhook confirma (`payout.paid`) ou reembolsa
(`payout.failed`).

Estados: `requested → processing → paid` (ou `failed` / `rejected`).

## Ativar providers na UI

- Cliente: `NEXT_PUBLIC_PAYMENTS_ENABLED_PROVIDERS` (lista por vírgulas; default `mock`).
- Funções: `PAYMENTS_DEFAULT_PROVIDER`.
- **Nunca** ativar `mock` em produção.

## Ligar um PSP real

### AppyPay (implementado — depósitos automáticos)

Adaptador `_shared/payments/appypay.ts` (registado em `providers.ts`):

| Método | O que faz |
|---|---|
| `gpo` | Multicaixa Express — envia um pedido para o telemóvel (`customerPhone`). |
| `ref` | Entidade + referência a pagar em ATM/Internet Banking (geradas por nós, com recuo automático se a AppyPay gerar a referência). |

Segredos (sem eles a função responde `appypay_not_configured`):

```bash
supabase secrets set --project-ref <REF> \
  APPYPAY_ENV=sandbox \
  APPYPAY_CLIENT_ID=<client-id> \
  APPYPAY_CLIENT_SECRET=<client-secret> \
  APPYPAY_PAYMENT_METHOD_GPO=<GPO_uuid> \
  APPYPAY_PAYMENT_METHOD_REF=<REF_uuid>
# opcionais (defaults são os públicos da AppyPay):
#   APPYPAY_RESOURCE_ID   (resource do merchant por ambiente)
#   APPYPAY_BASE_URL      (https://gwy-api-tst.appypay.co.ao/v2.0 | .../gwy-api...)
#   APPYPAY_TOKEN_URL     (login.microsoftonline.com/<tenant>/oauth2/token)
```

Passos no portal (sandbox: `https://app-tst.appypay.co.ao`, produção:
`https://app.appypay.co.ao`):

1. **Definições → Credenciais de API**: gerar `Client ID` + `Client Secret`.
2. **Aplicações**: criar a aplicação **GPO** e a **REF** e copiar a *API Key*
   (`GPO_…` / `REF_…`) para `APPYPAY_PAYMENT_METHOD_*`.
3. **Aplicação → Programador → Webhook**: ativar e apontar para
   `<SUPABASE_URL>/functions/v1/psp-webhook?provider=appypay` (método POST).
   A AppyPay **não assina** os webhooks — a validação é a reconsulta
   `GET /v2.0/charges/{id}` feita dentro de `psp-webhook`.
4. Cliente: `NEXT_PUBLIC_PAYMENTS_ENABLED_PROVIDERS` tem de incluir `appypay`.

Notas de integração (porquês no código):

- `merchantTransactionId` é limitado a **15 caracteres alfanuméricos** →
  derivado da `idempotency_key` (`merchantTxnFor`) e guardado no insert em
  `payment_intents.metadata.merchant_txn`, para o webhook localizar a intenção
  mesmo antes de `provider_ref` existir.
- Montantes: AOA com 2 casas (`amountMinor / 100`).
- Estado `Pending` → evento `payment.pending` (ignorado; só `paid` credita).
- Sandbox: telemóvel `900000000` = sucesso, `999999999` = cancelado,
  `900000001` = saldo insuficiente, `900000002` = valor inválido.
- **Levantamentos**: `supportsPayouts: false` — continuam manuais.

### Outros providers

Implementar o adaptador em `_shared/payments/providers.ts` (`createCheckout` +
`verifyAndParse`) e ativá-lo. Sem credenciais o adaptador falha com
`wipay_not_configured` / `stripe_not_configured` — nunca finge sucesso.

## Limitação do `mock` (sandbox)

O checkout do mock é apenas um URL de retorno; **não** dispara o webhook
automaticamente. Para testar localmente, envia o webhook assinado:

```bash
# payload
{"type":"payment.paid","event_id":"evt_1","reference":"<idempotency_key>","provider_ref":"mock_...","amount_minor":50000,"currency":"AOA"}
# assinatura: hex( HMAC_SHA256( MOCK_WEBHOOK_SECRET, rawBody ) )
curl -X POST "<SUPABASE_URL>/functions/v1/psp-webhook?provider=mock" \
  -H "x-mock-signature: sha256=<hex>" -H "content-type: application/json" -d @payload.json
```
