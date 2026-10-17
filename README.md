# Tira o Cocó do Meio

Jogo de tabuleiro 3×3 (3 peças por jogador) para **web** (Next.js 16) e
**mobile** (Expo SDK 57 / React Native). Offline (PvP local, vs IA em 4 níveis,
CvC), online (salas, matchmaking, partidas autoritativas, chat, amigos,
rankings, torneios) e economia de **moeda virtual** (KZ) — **sem dinheiro real**
(D6).

## Pré‑requisitos

- **Node.js** ≥ 20 e **Bun** ≥ 1.1
- **Playwright** (para e2e web): `bun run e2e:install`
- **Supabase CLI** ≥ 2.x (apenas para mexer no backend)
- **Expo** com Dev Client (apenas para mobile)

### RAM (máquina de dev com pouca memória)

A máquina de dev tem 8 GB instalados (2×4 GB DDR3L-1600, 2 slots ocupados) mas o
SO só vê ~6,4 GB por causa da gráfica integrada. O `vitest` já corre com
`maxWorkers: 1` + `isolate: false` (ver `vitest.config.ts`). Para não estourar:

- Fecha o browser e apps pesadas enquanto compilas.
- **Não** corras `next dev` e um browser/headless Chromium ao mesmo tempo.
- Para screenshots, usa o build de produção (`bun run build` + `bun run start`)
  em vez de `next dev`.
- Upgrade real: 2×8 GB **DDR3L-1600 SODIMM** (máximo suportado: 16 GB).
- Pendrives USB/ReadyBoost **não** servem de RAM e o pagefile não deve ir para USB.

## Setup em 10 minutos

```bash
# 1. Dependências (monorepo com workspaces: apps/* e packages/*)
bun install

# 2. Variáveis de ambiente
cp .env.example .env        # preenche NEXT_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY

# 3. Correr a app web
bun run dev                 # http://localhost:3000
```

A app web é uma **SPA** (só existe a rota `/`); a navegação entre ecrãs é feita
por estado (`useApp.screen`). Sem credenciais Supabase, a app arranha em modo
**offline** (PvP local e IA funcionam na mesma).

## Scripts (raiz)

| Comando | Descrição |
|---|---|
| `bun run dev` | Servidor de desenvolvimento web (porta 3000) |
| `bun run build` | Build de produção web (Next 16, standalone) |
| `bun run start` | Serve o build standalone |
| `bun run lint` | ESLint (web + packages) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | Testes unitários (Vitest) |
| `bun run e2e` | e2e web offline (Playwright) |
| `bun run e2e:online` | e2e web online a 2 contextos (usa `.env.e2e` real) |
| `bun run sync:engine` | Sincroniza `@tira/engine` para a Edge Function |

Mobile:

```bash
cd apps/mobile
bun run start          # Expo
bunx expo lint         # lint (eslint-config-expo)
```

## Estrutura

```
apps/mobile/        Expo (Expo Router) — ecrãs, stores e cliente online
packages/           engine (regras, zero deps), ai, design-tokens
src/                App web Next.js (componentes, stores, lib de domínio)
supabase/           migrations SQL, Edge Functions, seeds, testes RLS
e2e/                Testes Playwright (offline/ e online/)
docs/               spec/, design/, ARCHITECTURE.md, DECISIONS.md, PROGRESS.md, RELEASE.md
```

## Regras e fontes de verdade

- **Regras do jogo**: `packages/engine` é a **única** fonte de verdade. UI, IA,
  servidor e testes importam o mesmo código — é proibido reimplementar regras.
- **Spec**: `docs/spec/especificacao.md` (+ `docs/PROMPT_AGENTS.md`).
- **Visual**: `docs/design/mockups.png`.

## Qualidade antes de entregar

```bash
bun run lint && bun run typecheck && bun run test && bun run e2e
```

## Documentação

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura, motor, economia, segurança.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — registo de decisões (incl. D1–D6).
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — estado por fase.
- [`docs/RELEASE.md`](docs/RELEASE.md) — como publicar (Vercel + EAS + Supabase).

## Dinheiro real

Ligado (decisão **D6**, revista). O modo ativo é **manual**: depósitos com
**comprovativo** (`payment_receipts`) e levantamentos (`withdrawal_requests`)
que um **admin** aprova/paga. A aprovação credita e o pagamento debita o ledger
real, através da Edge Function `admin-manage` (gate `ADMIN_EMAILS`).

Tudo continua atrás da chave-mestra `REAL_MONEY_ENABLED` (cliente e servidor),
ligada em produção via `.env` e segredos das Edge Functions. Com a chave
desligada não há **qualquer** caminho de dinheiro real ativo (a UI volta a "em
breve" e as funções respondem `403 real_money_disabled`). Ver
`docs/DECISIONS.md` (D6) e `supabase/functions/PAYMENTS.md`.
