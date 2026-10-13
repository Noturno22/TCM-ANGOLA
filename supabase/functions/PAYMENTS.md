# Pagamentos (carteira AOA)

Slice de dinheiro real: **ledger double-entry append-only** (Postgres) + duas
Edge Functions. O saldo só muda no servidor, através de RPCs `SECURITY DEFINER`
executáveis apenas por `service_role`.

## Componentes

| Peça | Caminho |
|---|---|
| Schema (tabelas + RLS + RPCs) | `supabase/migrations/0002_payments.sql` |
| Tipos/helpers do cliente | `src/lib/payments/*` |
| UI da carteira | `src/components/payments/AoaWalletPanel.tsx` |
| Cria intenção + checkout | `supabase/functions/create-deposit-intent` |
| Recebe webhook do PSP | `supabase/functions/psp-webhook` |
| Adaptadores PSP + mock | `supabase/functions/_shared/payments/` |

## Invariantes de segurança (não violar)

- O cliente **nunca** escreve no ledger (RLS de leitura apenas; sem INSERT/UPDATE/DELETE).
- Só `ledger_credit` / `ledger_debit` escrevem; `EXECUTE` restrito a `service_role`.
- `ledger_entries` é imutável (sem UPDATE/DELETE nem para `service_role`).
- Crédito é idempotente por `idempotency_key` (unique) e por `deposit:<intent_id>`.
- Webhooks verificam assinatura e são idempotentes por `(provider, provider_event_id)`.

## Segredos das funções

```bash
supabase secrets set --project-ref <REF> \
  MOCK_WEBHOOK_SECRET=<segredo-hmac-do-mock> \
  PAYMENTS_DEFAULT_PROVIDER=mock \
  PAYMENTS_RETURN_URL=http://localhost:3000
```

## Deploy

```bash
supabase functions deploy create-deposit-intent --project-ref <REF>
supabase functions deploy psp-webhook --project-ref <REF> --no-verify-jwt
```

`psp-webhook` usa `--no-verify-jwt` (o PSP não envia JWT de utilizador; a
autenticação é a assinatura HMAC do próprio webhook).

## Ativar providers na UI

- Cliente: `NEXT_PUBLIC_PAYMENTS_ENABLED_PROVIDERS` (lista por vírgulas; default `mock`).
- Funções: `PAYMENTS_DEFAULT_PROVIDER`.
- **Nunca** ativar `mock` em produção.

## Ligar um PSP real (ex.: WiPay)

Implementar o adaptador em `_shared/payments/providers.ts` (`createCheckout` +
`verifyAndParse`) e ativá-lo. Sem credenciais o adaptador falha com
`wipay_not_configured` — nunca finge sucesso.

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
