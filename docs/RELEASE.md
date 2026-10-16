# Release

Instruções para publicar o **web** (Vercel), o **mobile** (EAS) e o **backend**
(Supabase). Antes de publicar, garantir:

```bash
bun run lint && bun run typecheck && bun run test && bun run e2e
```

## 1. Backend (Supabase)

Projeto de referência: **`TCM`** — ref `ogqnbhuvoypmqefxbijr`.

### Migrations

Num projeto novo, aplicar `supabase/sql/setup-complete.sql` (agrega 0001→0014).
Caso contrário, aplicar migrations individualmente (`0001`→`0014`):

```bash
supabase link --project-ref ogqnbhuvoypmqefxbijr
supabase db push
```

Helper local (Windows/PowerShell, via Management API):

```powershell
.\scripts\apply-supabase-migration.ps1 -File supabase\migrations\0014_age_gate.sql
```

### Edge Functions

```bash
# Sincronizar o motor antes de publicar submit-move
bun run sync:engine

supabase functions deploy submit-move        --project-ref ogqnbhuvoypmqefxbijr
supabase functions deploy send-sms-hook      --project-ref ogqnbhuvoypmqefxbijr
```

Funções de pagamento (só se D6 estiver ligado — ver abaixo):

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
  REAL_MONEY_ENABLED=false \
  PAYOUTS_ENABLED=false
```

> **Dinheiro real (D6):** manter `REAL_MONEY_ENABLED=false` até existir parecer
> jurídico/licenciamento. Com `false`, todas as funções de pagamento respondem
> `403 real_money_disabled`.

## 2. Web (Vercel)

- **Build command:** `bun run build` · **Output:** Next.js standalone.
- Variáveis de ambiente (Project Settings → Environment Variables):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_SITE_URL` (URL de produção)
  - `NEXT_PUBLIC_REAL_MONEY_ENABLED=false`
  - `NEXT_PUBLIC_PAYOUTS_ENABLED=false`
  - `NEXT_PUBLIC_PAYMENTS_ENABLED_PROVIDERS=mock` *(nunca `mock` em produção se
    D6 vier a ser ligado)*

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
- [ ] Carteira AOA mostra "em breve" (D6 desligado) e nenhum provider ativo.
- [ ] Migrations/functions sem erros nos logs do Supabase.
