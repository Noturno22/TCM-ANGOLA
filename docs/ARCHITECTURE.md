# Arquitetura

## Visão geral

Monorepo (Bun workspaces) com três alvos:

- **Web** — Next.js 16 (App Router/Turbopack), React 19, Tailwind v4, shadcn/ui,
  Zustand, Framer Motion. É uma **SPA**: só existe a rota `/`; os ecrãs são
  componentes trocados por estado (`useApp.screen`).
- **Mobile** — Expo SDK 57 / React Native 0.86, Expo Router (`apps/mobile/src/app`).
- **Backend** — Supabase: Postgres + RLS + RPCs, Auth, Realtime, Storage e Deno
  Edge Functions.

## Pacotes partilhados

| Pacote | Responsabilidade |
|---|---|
| `packages/engine` | **Regras do jogo** (TS puro, zero dependências). Fonte de verdade única. |
| `packages/ai` | IA (4 níveis; inclui o nível "Perfeita" a partir da tabela do solver). |
| `packages/design-tokens` | Cores, tipografia, espaçamentos, raios, sombras. |

> **Regra de ouro:** nenhuma regra de jogo é reimplementada fora de
> `packages/engine`. A UI, a IA, o replay, o tutorial, os testes **e a Edge
> Function** usam o mesmo código (sincronizado via `bun run sync:engine`).

## Motor das regras (resumo)

- 9 casas; **3 peças por jogador**; posição inicial fixa; P1 (verde) começa.
- Movimento para casa adjacente (modo por omissão `adjacent-only`); destino
  ocupado é inválido; saltos impedidos; sem capturas.
- **Vitória** verificada nas 8 linhas, **só para o jogador que acabou de mover**
  (D2); a posição inicial não é vitória.
- **Empate** à 3.ª repetição da mesma posição (chave
  `p1casas|p2casas|jogador`, com o jogador a jogar) (D3).
- Sem movimentos possíveis = derrota (D4).
- Equilíbrio (D5): mantém-se a spec; `homeLineCounts:false` (a linha de casa não
  conta para a vitória), o que evita a vitória trivial de P1 em 3 jogadas.

## Estado e navegação (web)

- `useApp` — ecrã atual (`Screen`) e `navigate`. **Não persistido** (arranca em
  `'splash'`).
- `useProfile` / `useSettings` — persistidos em `localStorage`.
- `useAuth` — sessão Supabase (`signInWithEmail`, Google, OTP de telefone).

## Backend (Supabase)

### Migrations (`supabase/migrations`)

`0001` profiles · `0002` payments (ledger) · `0003` KYC/payouts · `0004` KYC read ·
`0005` online rooms · `0006` online match · `0007` Edge authority ·
`0008` rooms international · `0009` friends · `0010` online tournaments ·
`0011` virtual bets · `0012` notifications · `0013` tournament auto-advance ·
`0014` age gate.

O ficheiro `supabase/sql/setup-complete.sql` agrega **0001→0014** para projetos
novos.

### Autoridade e segurança

- O **cliente nunca escreve** nas tabelas sensíveis; a escrita passa por **RPCs
  `SECURITY DEFINER`** e **Edge Functions**.
- **RLS em todas as tabelas**; princípio do menor privilégio
  (`revoke insert, update, delete` onde aplicável; leitura por `authenticated`).
- A jogada é validada pelo motor dentro da Edge Function `submit-move`
  (a RPC `submit_move` é o fallback SQL).
- Dados PII (data de nascimento) ficam em `public.profile_private` com RLS
  ligado e sem policies — nunca em `profiles`.

### Edge Functions

| Função | Papel |
|---|---|
| `submit-move` | Valida e aplica jogadas com `@tira/engine` (autoridade). |
| `send-sms-hook` | Hook do Supabase Auth → WhatsApp Cloud API (OTP). |
| `create-deposit-intent`, `psp-webhook`, `submit-kyc`, `request-payout`, `payout-webhook` | Subsistema de dinheiro real — **gated por `REAL_MONEY_ENABLED`** (ver abaixo). |

### Realtime

Canais por sala e por partida; presença ("jogadores online"); reconexão. As
subscrições são idempotentes (verificação em `pg_publication_tables`).

## Economia

- **Moeda virtual do jogo (KZ)** — `profiles.coins`. Sem valor monetário.
  Novos registos recebem **5000 KZ** server-side. Apostas são **zero-sum**
  (escrow na fila; reembolso ao cancelar; liquidação do vencedor/empate).
- **Dinheiro real (AOA)** — carteira com ledger double-entry append-only e
  integração de PSP. **Desativada por omissão (D6)** atrás da chave-mestra
  `REAL_MONEY_ENABLED=false` (cliente + servidor). Detalhes em
  `supabase/functions/PAYMENTS.md`.

## Gate 18+

A data de nascimento é PII. `public._is_adult(uuid)` e `public.my_age_gate()`
decidem; `join_matchmaking` / `join_tournament` recusam (`age_restricted`)
salas/torneios com aposta (`MIN_BET_AGE = 18`) quando o utilizador não é adulto.
O cliente mostra `AgeGateDialog` (web) / `AgeGateSheet` (mobile) antes da
primeira aposta.

## Progressão

- **Elo** zero-sum (piso 100). **XP** e nível: `levelFromXp = 1 + floor(xp/100)`.

## Testes

- **Unitários** (Vitest, ambiente `node`): `src/lib/**/*.test.ts` e
  `packages/**/*.test.ts`.
- **e2e web** (Playwright): `e2e/` — offline (`playwright.config.ts`) e online a
  2 contextos (`playwright.online.config.ts`, `e2e/online/`), este último contra
  um projeto Supabase real via `.env.e2e`.
- Incoerência deliberada: os specs e2e usam `.spec.ts` e **não** são apanhados
  pelo Vitest.
