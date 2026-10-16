# Registo de decisões

> Decisões que **só o SAMA pode alterar** (D1–D6, §12 do prompt). As restantes são
> decisões de implementação tomadas pelos agentes (mais reversíveis).
> Formato: **ID · decisão · estado**. Alternativas suportadas por flag ficam
> indicadas.

## Decisões de produto (só o SAMA altera)

| # | Tema | Por omissão (implementado) | Alternativa (por flag) |
|---|---|---|---|
| D1 | Interpretação do "caminho livre" | `free-blocked` | `lines-only`, `adjacent-only` (usado por omissão no motor) |
| D2 | Vitória | Só conta para o **jogador que acabou de mover** | — |
| D3 | Empate | **3.ª repetição** da mesma posição | — |
| D4 | Sem movimentos | **Derrota** de quem não tem jogada | — |
| D5 | Equilíbrio | Manter a spec; `homeLineCounts:false` (a linha de casa **não** conta) para evitar a vitória trivial de P1 em 3 jogadas | alternar `firstPlayer` por partida |
| D6 | **Dinheiro real** | **Desativado** — só moeda virtual | Ligar após parecer jurídico/licenciamento e integração de pagamentos |
| — | Taxa da casa em apostas | **0%** (`RAKE_PERCENT=0`) | `RAKE_PERCENT` |

### D6 — detalhe (chave-mestra)

`REAL_MONEY_ENABLED` é a **chave-mestra** do subsistema de dinheiro real, com
default `false` no cliente (`NEXT_PUBLIC_REAL_MONEY_ENABLED`) **e** no servidor
(`REAL_MONEY_ENABLED`, segredo das Edge Functions). Com a chave desligada:

- a UI mostra "em breve" e não oferece providers de dinheiro real;
- o cliente lança `dinheiro_real_desativado` antes de contactar o backend;
- as Edge Functions de pagamento respondem `403 real_money_disabled`.

As sub-flags `NEXT_PUBLIC_PAYOUTS_ENABLED` / `PAYOUTS_ENABLED` (levantamentos) só
têm efeito com a chave-mestra ligada. Implementação:
`src/lib/config/flags.ts` (cliente) e `supabase/functions/_shared/flags.ts`
(servidor).

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

## PROPOSTAS (não implementadas; aguardam autorização)

- **UI de torneios**: editar/descrever torneios e convidar amigos diretamente.
  Estado atual: a UI só cria torneios com `entry_fee = 0`.
- **Marcar notificação como lida ao clicar no sino** (hoje só lista).
- **Top-up de moeda virtual** para contas antigas com 0 KZ.
- **Migrar o backend de pagamentos** para um PSP real (WiPay/AppyPay/Stripe) —
  depende de D6.
