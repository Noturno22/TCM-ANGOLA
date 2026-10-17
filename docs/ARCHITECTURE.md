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
- Movimento de **1 passo para casa vizinha ligada por uma linha** do tabuleiro
  (modo por omissão `adjacent-only`); casas na diagonal **fora** das linhas
  (`2↔4`, `2↔6`, `4↔8`, `6↔8`) não são vizinhas; destino ocupado é inválido;
  sem capturas (D1).
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

### Salas (web)

`RoomsScreen` mostra **só o globo 3D** (`public/globe.svg` num `<iframe>`
sandboxed) com zoom. As cidades são pontos no SVG; clicar abre a sala
`global`/`mundo`. O zoom é **interno ao SVG** (via `viewBox`), porque o iframe
sandboxed não recebe eventos de `wheel` do parent; a app envia
`postMessage({ type: 'globe:zoom', mode })` (`Globe3D.tsx`).

### Tema e contraste (WCAG AA)

Os tokens de cor vivem em `src/app/globals.css` (tema único `:root` + override
`.light` ligado pela definição “Modo claro”). O tema escuro é o principal; o
tema claro é uma inversão com acentos **escurecidos** para cumprir WCAG AA
(≥4.5:1 em texto normal) sobre as superfícies claras
(`background`/`surface`/`surface-2`/`card`) — o dourado da marca (`--gold`,
0.83 no escuro) teria apenas 2.78:1 no claro. Valores no claro: `--gold`
`0.46 0.096 78`, `--p1` `0.44 0.109 155`, `--p2` `0.46 0.188 27`, `--orange`
`0.46 0.108 60` (croma limitada ao gamut sRGB). O texto com opacidade
(`text-muted-foreground/50`…) foi substituído pelo token a 100%.

## Backend (Supabase)

### Migrations (`supabase/migrations`)

`0001` profiles · `0002` payments (ledger) · `0003` KYC/payouts · `0004` KYC read ·
`0005` online rooms · `0006` online match · `0007` Edge authority ·
`0008` rooms international · `0009` friends · `0010` online tournaments ·
`0011` virtual bets · `0012` notifications · `0013` tournament auto-advance ·
`0014` age gate · `0015` manual payments (depósitos/levantamentos manuais).

O ficheiro `supabase/sql/setup-complete.sql` agrega **0001→0015** para projetos
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
| `create-deposit-intent`, `psp-webhook`, `submit-kyc`, `request-payout`, `payout-webhook` | Subsistema de dinheiro real por PSP — **gated por `REAL_MONEY_ENABLED`** (ver abaixo). |
| `admin-manage` | Ações do admin sobre depósitos/levantamentos manuais (aprovar/rejeitar/pagar, notificações, estatísticas). Crédito/débito no ledger real. Gate por `ADMIN_EMAILS`. |

### Realtime

Canais por sala e por partida; presença ("jogadores online"); reconexão. As
subscrições são idempotentes (verificação em `pg_publication_tables`).

## Economia

- **Moeda virtual do jogo (KZ)** — `profiles.coins`. Sem valor monetário.
  Novos registos recebem **5000 KZ** server-side. Apostas são **zero-sum**
  (escrow na fila; reembolso ao cancelar; liquidação do vencedor/empate).
- **Dinheiro real (USD/AOA)** — carteira com ledger double-entry append-only
  (`accounts`/`ledger_entries`, RPCs `ledger_credit`/`ledger_debit`). Dois
  caminhos:
  - **Manual (ativo)** — depósito com comprovativo (`payment_receipts`) e
    levantamento (`withdrawal_requests`); o admin aprova/paga na Edge Function
    `admin-manage`, que credita/debita o ledger. Tabelas portadas do TMT;
    `wallet_movements` é o histórico do utilizador e `admin_notifications` o sino
    do admin. Gate por `ADMIN_EMAILS`; detalhes em `docs/DECISIONS.md` (D6).
  - **PSP automático (inativo)** — integração de gateway/KYC
    (`create-deposit-intent`, `psp-webhook`, `submit-kyc`, `request-payout`),
    atrás da chave-mestra `REAL_MONEY_ENABLED`. Detalhes em
    `supabase/functions/PAYMENTS.md`.
  A chave-mestra `REAL_MONEY_ENABLED` está **ligada em produção** (`.env` +
  segredos das Edge Functions).

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
