# Registo de decisões

> Decisões que **só o SAMA pode alterar** (D1–D6, §12 do prompt). As restantes são
> decisões de implementação tomadas pelos agentes (mais reversíveis).
> Formato: **ID · decisão · estado**. Alternativas suportadas por flag ficam
> indicadas.

## Decisões de produto (só o SAMA altera)

| # | Tema | Por omissão (implementado) | Alternativa (por flag) |
|---|---|---|---|
| D1 | Interpretação do "caminho livre" | `adjacent-only` — 1 passo para uma **casa vizinha ligada por uma linha** do tabuleiro | `free-blocked`, `lines-only` |
| D2 | Vitória | Só conta para o **jogador que acabou de mover** | — |
| D3 | Empate | **3.ª repetição** da mesma posição | — |
| D4 | Sem movimentos | **Derrota** de quem não tem jogada | — |
| D5 | Equilíbrio | Manter a spec; `homeLineCounts:false` (a linha de casa **não** conta) para evitar a vitória trivial de P1 em 3 jogadas | alternar `firstPlayer` por partida |
| D6 | **Dinheiro real** | **Ligado** — depósitos/levantamentos **manuais** (comprovativo + aprovação de admin), USD/AOA; a chave `REAL_MONEY_ENABLED` continua a existir e pode ser desligada | Desligar a chave (volta a "em breve"); PSP automático (WiPay/AppyPay/Stripe) |
| — | Taxa da casa em apostas | **0%** (`RAKE_PERCENT=0`) | `RAKE_PERCENT` |

### D1 — detalhe (movimento: só vizinhas ligadas por linha)

Decisão do SAMA (após reporte: "no tabuleiro as peças continuam a pular casa").
O modo em produção é `adjacent-only`, mas com a vizinhança restrita às **casas
ligadas por uma das 8 linhas desenhadas** (horizontal, vertical ou uma das duas
diagonais). Concretamente, um movimento `A→B` é válido se for de **1 passo** e
`A` e `B` pertencerem ambos a uma mesma linha vencedora (`WINNING_LINES`).

- **Permitido:** `1→4`, `1→5`, `2→5`, `3→5`, `3→6`, `5→9`, `5→7`, …
- **Proibido:** `2↔4`, `2↔6`, `4↔8`, `6↔8` (diagonais **fora** das linhas — eram o
  que o utilizador via como "salto").

Efeito na posição inicial: cada peça tem 1–2 destinos (a peça do meio `2` tem
apenas `5`). Implementação: `packages/engine/src/index.ts` (`isLineAdjacent` +
`checkPath`). Consumidores revalidados: IA/solver (`packages/ai`), puzzles,
tutorial, e2e. O solver da IA passou a ser **por modo de movimento** (analisa as
mesmas regras do jogo) e a IA "perfeita" deixou de "esquecer" empates por
repetição — em jogo perfeito a posição inicial é **empate**.

### D6 — detalhe (chave-mestra)

`REAL_MONEY_ENABLED` é a **chave-mestra** do subsistema de dinheiro real. Continua
a existir com default `false` no código (`src/lib/config/flags.ts`,
`supabase/functions/_shared/flags.ts`), mas está **ligada em produção** via
`.env` (`NEXT_PUBLIC_REAL_MONEY_ENABLED=true`) e segredos das Edge Functions
(`REAL_MONEY_ENABLED=true`, `PAYOUTS_ENABLED=true`).

Com a chave desligada:

- a UI mostra "em breve" e não oferece providers de dinheiro real;
- o cliente lança `dinheiro_real_desativado` antes de contactar o backend;
- as Edge Functions de pagamento respondem `403 real_money_disabled`.

As sub-flags `NEXT_PUBLIC_PAYOUTS_ENABLED` / `PAYOUTS_ENABLED` (levantamentos) só
têm efeito com a chave-mestra ligada.

### D6 — reversão: pagamentos **manuais** (comprovativo + aprovação)

Reversão deliberada do "desativado" (o SAMA pediu paridade com o TMT). O modelo
é **100% manual**, sem PSP automático:

- O utilizador escolhe um método (**Binance** USD, **Rodotpay** USD+AOA,
  **Express** AOA), vê os dados de recebimento, paga e envia um **comprovativo**
  (foto). Cria uma linha em `payment_receipts` (`pending`).
- Um **admin** (email em `ADMIN_EMAILS`) aprova/rejeita. A aprovação **credita o
  ledger real** do TCM (`public.ledger_credit`), nunca uma tabela de capital.
- Levantamentos: `withdrawal_requests` (`pending → approved → paid/rejected`).
  **Marcar como pago debita** o ledger (`public.ledger_debit`).
- `wallet_movements` = histórico do utilizador (sincronizado por triggers);
  `admin_notifications` = sino do admin.

Moedas nas tabelas manuais em **minúsculas** (`usd`/`aoa`, como no TMT); o ledger
usa **maiúsculas** (`USD`/`AOA`) — a conversão é feita na Edge Function. Valores
manuais em unidades **maiores** (`numeric(14,2)`); o ledger guarda unidades
**menores** (×100).

Escrita de estado (aprovar/rejeitar/pagar) e crédito/débito do saldo são **só do
`service_role`** (Edge Function `admin-manage`); o cliente apenas lê/insere as
suas próprias linhas (RLS). Idempotência: `receipt:<id>` / `withdrawal:<id>`.


## Decisões de implementação

| # | Decisão | Notas |
|---|---|---|
| I1 | `packages/engine` é a única fonte de verdade das regras | UI/IA/servidor importam; sincronizado para a Edge Function com `sync:engine`. |
| I2 | Números do tabuleiro fixos: `1-2-3` (topo), `4-5-6` (meio), `7-8-9` (base) | Ordem e2e (não-flipped): `[7,8,9,4,5,6,1,2,3]`. |
| I3 | Peças não se distinguem só por cor | `▲` na P1 (verde), `●` na P2 (vermelha); opção "Símbolos nas peças" ligada por omissão. |
| I4 | Web é SPA numa só rota | Navegação por `useApp.screen`, não por URL. |
| I5 | Cliente nunca escreve nas tabelas | Escrita via RPC/Edge Function; RLS de leitura apenas. |
| I6 | Nome e tratamento | "Tira o Cocó do Meio"; tratamento por "tu". |
| I7 | Economia virtual em KZ | `profiles.coins`; novos registos +5000 KZ server-side; apostas zero-sum. |
| I8 | Idade em `profile_private` | PII nunca em `profiles`; `MIN_BET_AGE = 18`. |
| I9 | Elo zero-sum (piso 100); `levelFromXp = 1 + floor(xp/100)` | — |
| I10 | Login email/password só para e2e | Mostrado apenas com `NEXT_PUBLIC_E2E_AUTH=1`; invisível em produção. |
| I11 | e2e online fora do CI público | Exige `.env.e2e` (service role) — correção local/staging. |
| I12 | Pagamentos manuais portados do TMT | Tabelas `payment_receipts`/`withdrawal_requests`/`wallet_movements`/`admin_notifications` + bucket `payment-proofs`; aprovação move o **ledger real** (`ledger_credit`/`ledger_debit`) via Edge Function `admin-manage`. |
| I13 | Admin por allow-list de emails | Segredo `ADMIN_EMAILS` na Edge Function (gate real) + `NEXT_PUBLIC_ADMIN_EMAILS` no cliente (só mostra/oculta a UI). |
| I14 | `admin-manage` é a única porta de escrita de estado | O cliente insere/elimina só as próprias linhas pendentes (RLS); aprovar/pagar/rejeitar é exclusivo do `service_role`. |
| I15 | Salas = só globo | `RoomsScreen` mostra o globo 3D (`public/globe.svg`) com zoom; clicar numa cidade abre a sala `global`/`mundo`. Filtros/listas removidos. |
| I16 | Tema claro com acentos escurecidos (WCAG AA) | Acentos de marca escurecidos no `.light` (ex.: `--gold` 0.46) para ≥4.5:1 sobre as superfícies claras; escuro intacto. Opacidades de texto (`text-muted-foreground/50`…) removidas. |
| I17 | Alvos de toque ≥ 48 dp | Chaves `button`/`input`/`select` (`h-12`), lista `tabs` `h-14`, `switch` com área de 48 px por pseudo-elemento, `dialog` fechar `size-12` e varredura por toda a UI (só-ícone → `w-12 h-12`, `min-h-[44px]` → `min-h-12`). Exceções: thumb do `slider` e `input[type=range]` do replay. |
| I18 | Notificações: lidas ao sair da lista | `NotificationsScreen` marca tudo como lida no unmount — o sino limpa o badge depois de abrires a lista, e enquanto lá estás continuas a ver pontos/contador "por ler". |
| I19 | Top-up de KZ = backfill + RLS de `profiles` fechado | `0016_profile_topup.sql`: dá 5.000 KZ a contas com `coins = 0` (criadas antes do bónus de boas-vindas) e revoga o UPDATE do cliente em `profiles` (só `username`/`avatar`/`updated_at`) — antes qualquer um podia fazer `update profiles set coins = 999999`. Sem bónus diário nem botão de claim. |
| I20 | Torneios: editar/descrever + convidar amigos via RPC | `0017_tournament_edit_invite.sql`: `create_tournament` ganhou `p_description`; `update_tournament` (só `created_by` e `status = 'open'`) e `invite_to_tournament` (criador ou inscrito → `_notify` `tournament_invite`, máx. 50 por chamada, ignora quem já está inscrito). Cliente continua sem escrever em `tournaments`. |
| I21 | PSP automático = **AppyPay** (GPO + referência), coexistindo com o manual | Adaptador `_shared/payments/appypay.ts`: OAuth2 Client Credentials (Azure AD + `resource` por ambiente), `POST /v2.0/charges` (`gpo` = Multicaixa Express com `customerPhone`; `ref` = entidade/referência gerada por nós com recuo progressivo de `paymentInfo` se o ambiente gerar a referência). **Webhook sem assinatura** → `verifyAndParse` só confia na reconsulta `GET /v2.0/charges/{id}` (recomendação da própria AppyPay); estado `Pending` vira `payment.pending` e é ignorado sem efeito. `merchantTransactionId` ≤15 alnum derivado da `idempotency_key` (`merchantTxnFor`) e guardado **no insert** em `payment_intents.metadata.merchant_txn` → o webhook procura `idempotency_key` → `provider_ref` → `metadata.merchant_txn` (sem corrida). Sem página externa: o `checkout_url` é o **nosso app** com `psp/intent/method/entity/reference/phone_masked` em query → cartão pendente no `DepositScreen` com polling de 5 s (e retoma ao reabrir o ecrã). `supportsPayouts: false` (levantamentos continuam manuais); sem credenciais responde `appypay_not_configured`. |

## PROPOSTAS (não implementadas; aguardam autorização)

- **Outros PSP** — WiPay (Angola) e Stripe para cartão internacional: stubs
  explícitos em `_shared/payments/providers.ts`, a ligar quando houver
  credenciais/contrato. O **AppyPay** para depósitos está implementado (I21) e
  só precisa das credenciais sandbox/produção + webhook no portal.

> **Contas de recebimento** (`BINANCE_ID`/`RODOTPAY_UID`/`EXPRESS_PHONE` em
> `src/lib/payments/manual.ts`): confirmadas pelo SAMA (`547723572` /
> `1927969477` / `+244926717730`).
