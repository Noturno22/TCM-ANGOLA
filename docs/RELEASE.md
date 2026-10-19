# Release

Instruções para publicar o **web** (Vercel), o **mobile** (EAS) e o **backend**
(Supabase). Antes de publicar, garantir:

```bash
bun run lint && bun run typecheck && bun run test && bun run e2e
```

## 1. Backend (Supabase)

Projeto de referência: **`TCM`** — ref `ogqnbhuvoypmqefxbijr`.

### Migrations

Num projeto novo, aplicar `supabase/sql/setup-complete.sql` (agrega 0001→0015).
Caso contrário, aplicar migrations individualmente (`0001`→`0015`):

```bash
supabase link --project-ref ogqnbhuvoypmqefxbijr
supabase db push
```

Helper local (Windows/PowerShell, via Management API):

```powershell
.\scripts\apply-supabase-migration.ps1 -File supabase\migrations\0015_manual_payments.sql
```

### Edge Functions

```bash
# Sincronizar o motor antes de publicar submit-move
bun run sync:engine

supabase functions deploy submit-move        --project-ref ogqnbhuvoypmqefxbijr
supabase functions deploy send-sms-hook      --project-ref ogqnbhuvoypmqefxbijr
supabase functions deploy admin-manage       --project-ref ogqnbhuvoypmqefxbijr --use-api
```

Funções de pagamento (manual + PSP automático):

```bash
supabase functions deploy create-deposit-intent --project-ref ogqnbhuvoypmqefxbijr
supabase functions deploy psp-webhook           --project-ref ogqnbhuvoypmqefxbijr --no-verify-jwt
supabase functions deploy submit-kyc            --project-ref ogqnbhuvoypmqefxbijr
supabase functions deploy request-payout        --project-ref ogqnbhuvoypmqefxbijr
supabase functions deploy payout-webhook        --project-ref ogqnbhuvoypmqefxbijr --no-verify-jwt
```

### Segredos das funções

```bash
supabase secrets set --project-ref ogqnbhuvoypmqefxbijr \
  REAL_MONEY_ENABLED=true \
  PAYOUTS_ENABLED=true \
  ADMIN_EMAILS="email-do-admin@exemplo.com"
```

> **Dinheiro real (D6, revista):** os depósitos/levantamentos **manuais** estão
> ligados. `ADMIN_EMAILS` (lista separada por vírgulas, emails dos admins) gateia
> a Edge Function `admin-manage`. Com `REAL_MONEY_ENABLED=false` todas as funções
> de pagamento respondem `403 real_money_disabled`.

### Segredos AppyPay (depósitos automáticos)

Só quando o PSP automático for ligado (sem eles `create-deposit-intent`
responde `checkout_failed appypay_not_configured`); detalhes em
`supabase/functions/PAYMENTS.md`:

```bash
supabase secrets set --project-ref ogqnbhuvoypmqefxbijr \
  APPYPAY_ENV=sandbox \
  APPYPAY_CLIENT_ID=<client-id> \
  APPYPAY_CLIENT_SECRET=<client-secret> \
  APPYPAY_PAYMENT_METHOD_GPO=<GPO_uuid> \
  APPYPAY_PAYMENT_METHOD_REF=<REF_uuid>
```

### Segredos BitPay (depósitos automáticos, sandbox)

O sandbox é aberto — criar conta em https://dashboard.bitpay.ao e copiar a
chave `sk_test_…` (Developers → Chaves). O webhook é registado
automaticamente na primeira cobrança; `BITPAY_WEBHOOK_SECRET` é opcional
(valida a assinatura, além da reconsulta à API).

```bash
supabase secrets set --project-ref ogqnbhuvoypmqefxbijr \
  BITPAY_SK=sk_test_...
# opcionais: BITPAY_WEBHOOK_SECRET=whsec_...  BITPAY_ENV=production
```

> A BitPay **ainda não está em produção** (certificação EMIS pendente): os
> depósitos via BitPay são simulados até haver chaves `sk_live_…`.

No portal AppyPay, configurar o webhook de cada aplicação (GPO e REF) para
`https://ogqnbhuvoypmqefxbijr.supabase.co/functions/v1/psp-webhook?provider=appypay`
(método POST). A AppyPay não assina os payloads — `psp-webhook` valida por
reconsulta `GET /v2.0/charges/{id}`.

## 2. Web (Vercel)

- **Build command:** `bun run build` · **Output:** Next.js standalone.
- Variáveis de ambiente (Project Settings → Environment Variables):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_SITE_URL` (URL de produção)
  - `NEXT_PUBLIC_REAL_MONEY_ENABLED=true`
  - `NEXT_PUBLIC_PAYOUTS_ENABLED=true`
  - `NEXT_PUBLIC_ADMIN_EMAILS` (emails com acesso ao painel admin)
  - `NEXT_PUBLIC_PAYMENTS_ENABLED_PROVIDERS=appypay,bitpay` *(nunca `mock` em produção)*

**Nunca** definir `NEXT_PUBLIC_E2E_AUTH` em produção (só para testes).

## 3. Mobile (EAS)

Projeto Expo `tira-o-coco-do-meio` (`com.tiraococo.app`, projectId
`59f6d936-74a3-4099-bb5e-a3e5d6bfe853`). Perfis em `apps/mobile/eas.json`:
`development`, `preview`, `production`.

```bash
cd apps/mobile
eas build --profile preview --platform android
eas build --profile production --platform android
eas submit --profile production
```

Configurar `apps/mobile/.env` com `EXPO_PUBLIC_SUPABASE_URL` e
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (equivalentes móveis das variáveis web).

## 4. CI

`.github/workflows/ci.yml`:

- **`quality`** — `bun install` → lint → typecheck → test → Playwright install →
  e2e (offline) + artefacto do relatório.
- **`build-web`** — `bun run build`.

**Fora do CI** (exigem secrets): `bun run e2e:online` (precisa de `.env.e2e` com
service role) e os builds EAS (exigem `EXPO_TOKEN`).

## 5. Verificação pós‑release

- [ ] Web carrega e o jogo offline funciona.
- [ ] Partida online a 2 clientes com jogadas validadas no servidor.
- [ ] Gate 18+ ao entrar numa sala com aposta.
- [ ] Depósito manual (comprovativo) submetido e visível no painel admin.
- [ ] Admin aprova → saldo creditado; levantamento pago → saldo debitado.
- [ ] Depósito automático AppyPay (Express e referência) → webhook credita o saldo.
- [ ] Depósito automático BitPay (sandbox: `923000000` / referência simulada) → saldo creditado.
- [ ] Migrations/functions sem erros nos logs do Supabase.
