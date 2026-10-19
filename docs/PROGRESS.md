# Progresso por fase

> Atualizado no fim de cada tarefa. Estados: **feito** · **em curso** ·
> **bloqueado** · **próximo**.

| Fase | Conteúdo | Estado |
|---|---|---|
| **F0** | Monorepo, CI, tokens base, contrato do motor | **feito** |
| **F1** | Motor completo + testes + solver | **feito** |
| **F2** | IA (4 níveis) + testes | **feito** |
| **F3** | Design system + ecrãs (web + mobile) + jogo offline | **feito** |
| **F4** | Backend: schema, RLS, auth, salas, matchmaking, `submit-move`, ledger | **feito** |
| **F5** | Chat, amigos, rankings, XP/Elo, conquistas, torneios, apostas virtuais, notificações | **feito** |
| **F6** | Tutorial, replay, som, háptico, acessibilidade, i18n, polimento | **em curso** |
| **F7** | QA final, e2e, performance, builds (EAS/Vercel), documentação | **em curso** |

## F0 — Monorepo e contrato do motor · feito

- Bun workspaces (`apps/*`, `packages/*`); `packages/engine` (TS puro), `ai`,
  `design-tokens`.
- Contrato do motor publicado antes do resto.
- CI (GitHub Actions): `quality` (lint, typecheck, test, e2e) + `build-web`.

## F1 — Motor completo · feito

- Regras em `packages/engine` (9 casas, 3 peças/jogador, `adjacent-only`).
- D2/D3/D4 implementadas; `homeLineCounts:false` (D5).
- Solver + relatório; valores de referência reproduzidos.

## F2 — IA · feito

- 4 níveis; nível "Perfeita" pela tabela do solver; IA nunca faz jogada ilegal.

## F3 — Design system e ecrãs · feito

- Tokens a partir do mockup (`~#050A08`, `~#0B1A14`, verde `~#10B25A`,
  vermelho `~#D7141B`, dourado `~#F2B01E`, laranja `~#E8830C`).
- Ecrãs fiéis ao mockup em web e mobile; jogo offline completo (PvP local, vs IA,
  CvC), replay e tutorial.

## F4 — Backend · feito

- Migrations `0001`→`0008`; RLS em todas as tabelas; RPCs `SECURITY DEFINER`.
- Auth (email, convidado, OTP por WhatsApp via `send-sms-hook`).
- Salas, matchmaking, `submit-move` (autoridade com `@tira/engine`), ledger.
- Partida online entre 2 clientes com validação no servidor; Realtime verificada.

## F5 — Social, progressão e torneios · feito

- `0009` amigos · `0010` torneios online · `0011` apostas virtuais (zero-sum,
  escrow, reembolso, liquidação) · `0012` notificações · `0013` auto-avanço de
  torneios.
- Elo zero-sum (piso 100); XP/nível `1 + floor(xp/100)`; conquistas; rankings.
- **Aplicado no projeto Supabase** (`TCM`, ref `ogqnbhuvoypmqefxbijr`); 14 salas;
  `submit-move` publicada.

## F6 — Polimento · em curso

- **Feito**: tema escuro/claro; i18n (`pt`); reduzir animações; símbolos nas
  peças; teclado na web; som/háptico com estrutura trocável; gate 18+
  (`0014_age_gate.sql`, `AgeGateDialog`/`AgeGateSheet`); **WCAG AA do tema
  claro** (acentos escurecidos em `globals.css`; texto com opacidade removido);
  **alvos de toque ≥ 48 dp** (chaves em `button`/`input`/`select`/`tabs` →
  `h-12`, `tabs` lista `h-14`, `switch` com área de toque de 48 px por
  pseudo-elemento, `dialog` fechar `size-12`, e varredura por toda a UI —
  `TabBar`/`BalancePill`/`FilterChip` → `min-h-12`, botões só-ícone →
  `w-12 h-12`). Exceções estruturais registadas: thumb do `slider` (16 px) e
  `input[type=range]` do replay.
- **Feito**: notificações lidas ao sair da lista (`I18`); **logo do header
  theme-aware** (`public/logo.svg` usa `var(--background)`/`var(--foreground)`
  em vez de `#2D2D2D` fixo); **top-up das contas a 0 KZ** + RLS de `profiles`
  fechado (`0016_profile_topup.sql`, `I19`).
- **Feito**: torneios online com **editar/descrever** (só o criador, enquanto
  aberto) e **convidar amigos** por notificação (`0017_tournament_edit_invite.sql`,
  `I20`): `create_tournament` ganhou `p_description`, novas RPCs
  `update_tournament`/`invite_to_tournament` (ambas `security definer`, cliente
  continua sem escrever em `tournaments`), convite `tournament_invite` com deep
  link para o torneio a partir da lista de notificações.
- **Feito**: **PSP automático com AppyPay** para depósitos AOA (`I21`) —
  adaptador `_shared/payments/appypay.ts` (OAuth2 + `POST /v2.0/charges`;
  `gpo` Multicaixa Express e `ref` entidade/referência), webhook **sem
  assinatura** validado por reconsulta `GET /charges/{id}` em `psp-webhook`,
  lookup da intenção por `metadata.merchant_txn`, e UI em `DepositScreen`
  (bloco "Depósito automático" + cartão pendente com polling de 5 s e retoma
  ao reabrir). Coexiste com o fluxo manual; levantamentos continuam manuais;
  sem credenciais responde `appypay_not_configured`.
- **Feito**: 2.º PSP automático **BitPay** (`I22`, sandbox; produção só após
  certificação EMIS) — `_shared/payments/bitpay.ts` (Express/referência,
  `Idempotency-Key` e `merchant_reference` = `idempotency_key`, webhook
  assinado **e** reconsulta, registo automático do endpoint). UI escolhe o PSP
  quando há mais de um ativo e só recua em erros `*_not_configured`
  (AppyPay → BitPay).
- **Dívidas conhecidas**: PSP WiPay e Stripe (stubs); AppyPay bloqueado por
  NIF empresarial (portal recusa adesão sem empresa) — credenciais pendentes.

## F7 — QA, e2e, release e docs · em curso

- **Feito**:
  - Testes unitários **148/148** (14 ficheiros); typecheck limpo; lint **0 erros**.
  - e2e web **offline 8/8** (`e2e/`) e **online 3/3** (`e2e/online/`: 2
    contextos + depósito/levantamento manuais, contra o Supabase real).
  - CI (`.github/workflows/ci.yml`).
  - **Mobile**: fatia vertical online (`apps/mobile/**`); `expo lint` 0 erros.
  - **Dinheiro real (D6, revista)**: chave-mestra `REAL_MONEY_ENABLED` (cliente +
    servidor), default `false`; **ligada em produção** com depósitos/levantamentos
    **manuais** (comprovativo + aprovação de admin) — `0015_manual_payments.sql` +
    Edge Function `admin-manage`.
  - Documentação: `README.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
    `docs/PROGRESS.md`, `docs/RELEASE.md`.
- **Pendente**:
  - Builds EAS (mobile) e Vercel (web) com secrets reais.
  - e2e online no pipeline público (exige service role — usar staging).

## Definição de Pronto (Bloco 11)

### A) Regras — completo

- [x] 9 casas; 3 peças/jogador; posição inicial fixa; P1 começa
- [x] Destino ocupado inválido; saltos impedidos; sem capturas
- [x] 8 linhas; **só para quem moveu**; posição inicial não é vitória
- [x] Vitória termina; empate por repetição (3×); turnos alternam
- [x] Movimentos inválidos rejeitados; nada joga depois do fim
- [x] PvP, PvE, CvC; IA respeita o motor; replay reproduz os movimentos
- [x] Valores de referência do solver reproduzidos

### B) Produto

- [x] Ecrãs fiéis ao mockup, escuro e claro
- [x] Offline completo; online completo (salas, partida, chat, amigos, rankings,
      torneios, apostas virtuais)
- [x] Servidor autoritativo; RLS verificada; ledger consistente
- [x] **Sem dinheiro real em qualquer caminho de código**; gate 18+ nas salas com aposta
      — *D6 revista: dinheiro real manual (comprovativo + admin) ligado atrás da chave-mestra*
- [x] Acessibilidade (peças não só por cor, contraste, animações desligáveis)
      — *WCAG AA do tema claro corrigido (acentos + opacidades de texto)*
- [ ] `lint && typecheck && test && e2e` verdes; **builds EAS e Vercel a funcionar**
      — *localmente verdes; builds na nuvem por confirmar*
