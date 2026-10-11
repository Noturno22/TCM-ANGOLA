# PROMPT MESTRE — TIRA O COCÓ DO MEIO
### Desenvolvimento completo (motor, IA, app mobile, web e backend online)

> **Como usar este ficheiro:** o **Bloco 0 a 9** é contexto comum — todos os agents leem antes de começar. O **Bloco 10** contém o prompt individual de cada agent (A1 a A4). O **Bloco 11** é a definição de pronto. Comece sempre pelo **Bloco 1 (Primeiros passos)**.

---

## 0. MISSÃO

Constrói o jogo **Tira o Cocó do Meio**: jogo de estratégia abstrata para 2 jogadores, inspirado na cultura angolana, com modo **offline (contra a IA e 2 jogadores no mesmo dispositivo)** e modo **online (salas, partidas em tempo real, chat, torneios, rankings, apostas com moeda virtual)**, em **app mobile (Expo)** e **web (Next.js)**.

Qualidade esperada: produto de loja de apps — fiel ao mockup, sem bugs de regras, rápido, acessível, em português.

**Idioma:** todo o UI, mensagens, documentação e comentários de produto em **português**. Identificadores de código em inglês.

---

## 1. PRIMEIROS PASSOS (obrigatório, por esta ordem)

1. Criar o monorepo (estrutura no Bloco 4).
2. Copiar os dois ficheiros de referência para dentro do repo:
   - `Tira_o_Coco_do_Meio_Especificacao_Completa.md` → `docs/spec/especificacao.md` (**fonte de verdade das regras**)
   - `ChatGPT_Image_30_09_2026__05_13_34.png` → `docs/design/mockups.png` (**fonte de verdade do visual e da estrutura de ecrãs**)
3. Criar `docs/DECISIONS.md` (registo de decisões) e `docs/PROGRESS.md` (estado por fase).
4. O **A1** publica o contrato do motor (tipos + assinaturas, Bloco 5) **antes** dos restantes agents escreverem código que dependa dele.
5. Só depois avançar pelas fases do Bloco 9.

---

## 2. FONTES DE VERDADE E PRECEDÊNCIA

| Assunto | Fonte de verdade |
|---|---|
| Regras do jogo, IA, testes do motor, arquitetura do motor | `docs/spec/especificacao.md` + **Bloco 3 deste prompt** (que a complementa e, em caso de ambiguidade, prevalece) |
| Visual, layout, cores, hierarquia, fluxo de ecrãs, textos de interface | `docs/design/mockups.png` |
| Funcionalidades online/economia/progressão | Bloco 7 deste prompt |

**Não alterar regras sem autorização explícita.** Se achares que uma regra está errada, regista em `docs/DECISIONS.md` como “PROPOSTA”, implementa o comportamento atual e segue em frente.

### Incoerências conhecidas entre mockup e especificação (já resolvidas — não voltar a discutir)

1. **O mockup da partida mostra 8 peças (4 verdes e 4 vermelhas).** É ilustrativo e está errado face às regras. **Regra: 3 peças por jogador.** Reproduzir o *estilo* do tabuleiro (moldura dourada, bolas brilhantes, alvo no centro), nunca a disposição das peças.
2. **Diferenciação por cor apenas:** o mockup usa só verde/vermelho; a spec (§27) exige que as peças **não se distingam só pela cor**. → gravar em relevo, discretamente, **▲ na peça P1 (verde)** e **● na peça P2 (vermelha)**; opção em Configurações “Símbolos nas peças” (ligada por omissão).
3. **Cores dos jogadores:** P1 = verde (casas 1-2-3, topo), P2 = vermelho (casas 7-8-9, base). No ecrã do jogador, **as suas peças aparecem sempre em baixo** (ver 6.3).
4. **Tratamento:** o mockup usa “tu” (“Joga, desafia, ganha!”, “Escreve uma mensagem…”). Onde o mockup tem texto, usar **literalmente**; onde só a spec tem texto, usar a spec adaptada ao tratamento por “tu”.
5. **Nome:** “Tira o Cocó do Meio” (com acento, como na spec e no logótipo).

---

## 3. REGRAS DO JOGO — VERSÃO EXECUTÁVEL (complementa a spec)

### 3.1 Numeração do tabuleiro
```
1 ─ 2 ─ 3
4 ─ 5 ─ 6      (5 = centro, “o cocó do meio”)
7 ─ 8 ─ 9
```
Internamente: `board[0..8]` ↔ casas `1..9`. A API pública usa **casas 1–9**.

### 3.2 Linhas vencedoras (8)
`[1,2,3] [4,5,6] [7,8,9] [1,4,7] [2,5,8] [3,6,9] [1,5,9] [3,5,7]`

### 3.3 Posição inicial e turnos
`P1: 1,2,3 · P2: 7,8,9 · vazias: 4,5,6`. **P1 joga sempre primeiro.** Um movimento de **uma** peça por turno, **obrigatório** (não há passar a vez).

### 3.4 Movimento — decisão D1 (interpretação por omissão: `free-blocked`)
A spec diz “qualquer casa livre, sem saltar peças”. Interpretação fixada:

- O **destino** tem de estar **vazio**.
- Se **origem e destino estão na mesma reta do tabuleiro** (linha, coluna ou diagonal pelo centro), **todas as casas entre elas têm de estar vazias**. Ex.: `1→9` exige `5` vazia; `1→3` exige `2` vazia; `2→8` exige `5` vazia.
- Se **não estão na mesma reta** (ex.: `1→6`, `2→4`, `1→8`), **não existe caminho a atravessar** e o movimento é **permitido** se o destino estiver vazio.
- Sem capturas. Sem substituir peças.

> Implementar como `RulesConfig.movementMode`: `'free-blocked'` (omissão) | `'lines-only'` (só movimentos ao longo de retas, com caminho livre) | `'adjacent-only'`. **Só `free-blocked` vai para produção** — os outros existem para a decisão do Sama (Bloco 12) e para testes.

### 3.5 Verificação de vitória — **ARMADILHA CRÍTICA (decisão D2)**
**Na posição inicial, P1 já ocupa a linha `1-2-3` e P2 já ocupa `7-8-9`.**
Se o motor verificar “todas as linhas, para qualquer jogador” após cada movimento, **P2 ganha logo após a primeira jogada de P1** (porque `7-8-9` continua intacta). Isto é um bug.

**Regra:** depois de cada movimento, verificar **apenas as peças do jogador que acabou de mover**. Só esse jogador pode ter completado uma linha nesse movimento (as peças do adversário não mudaram). A posição inicial **não** é vitória para ninguém (o jogo começa em `READY`/`PLAYER_1_TURN`, sem verificação).
Consequência legítima: um jogador pode **sair** da sua linha de casa e **voltar** a ela mais tarde para ganhar — isto é jogável e está dentro das regras.

### 3.6 Empate — decisão D3
Terceira ocorrência da **mesma posição completa + mesmo jogador a jogar** ⇒ `DRAW`. A posição inicial conta como 1.ª ocorrência. Chave: `"<casas P1 ordenadas>|<casas P2 ordenadas>|<jogador>"`. Opcional (config, desligado por omissão): `maxPlies`.

### 3.7 Sem movimentos legais — decisão D4
Em `free-blocked` **é impossível** (provado por pesquisa exaustiva nos 3 360 estados — o teste exaustivo tem de confirmar). Nos outros modos existem estados sem movimentos. Comportamento configurável `noMovesOutcome`: `'lose'` (omissão) | `'draw'`. O motor nunca pode lançar exceção nem ficar bloqueado.

### 3.8 Fim de jogo
Depois de `WIN_P1 | WIN_P2 | DRAW` nenhum movimento é aceite. Desistência e timeout online são resultados **de partida** (camada de match), não do motor de regras.

---

## 4. STACK E ARQUITETURA

**Stack (preferir soluções autocontidas, poucas dependências externas):**
- Monorepo **pnpm + Turborepo**, **TypeScript estrito** (`strict`, sem `any`).
- **Mobile:** Expo (**Dev Client**), Expo Router, React Native Reanimated 3, `react-native-svg`, `expo-haptics`, `expo-audio`/`expo-av`. Build com **EAS Build**.
- **Web:** **Next.js** (App Router), CSS/Tailwind + SVG para o tabuleiro, Framer Motion (ou CSS) para animação. Deploy **Vercel**.
- **Backend:** **Supabase** (Auth, Postgres + RLS, Realtime, Edge Functions, `pg_cron`).
- **Testes:** Vitest (packages), React Native Testing Library (mobile), Playwright (web e2e), `fast-check` (propriedades), pgTAP ou testes SQL (RLS/RPC).
- **Fontes:** self-hosted (sem CDN). Títulos: condensada pesada (Bebas Neue/Anton); corpo: Inter.

**Estrutura:**
```
tira-o-coco-do-meio/
├─ apps/
│  ├─ web/                 Next.js
│  └─ mobile/              Expo Dev Client
├─ packages/
│  ├─ engine/              TS puro, ZERO dependências — regras (Bloco 5)
│  ├─ ai/                  TS puro, depende só de engine (Bloco 6)
│  ├─ design-tokens/       cores, tipografia, espaçamentos, raios, sombras
│  ├─ game-client/         hooks/stores partilhados (useGame, useMatch, i18n, clientes supabase)
│  └─ config/              tsconfig, eslint, prettier
├─ supabase/               migrations, functions, seed, tests
├─ tools/solver/           resolvedor do jogo (gera a tabela da IA “Perfeita” + relatório)
└─ docs/                   spec/, design/, DECISIONS.md, PROGRESS.md, balance-report.md
```
**Regra de ouro (spec §36–37):** **uma única fonte de verdade para as regras** = `packages/engine`. UI, IA, replay, tutorial, testes **e servidor (Edge Function)** usam exatamente o mesmo código. Proibido reimplementar regras em qualquer outro sítio. Lógica e estado partilhados; a UI pode ser nativa por plataforma para manter fidelidade visual.

---

## 5. CONTRATO DO MOTOR (`packages/engine`) — A1 publica primeiro

```ts
export type PlayerId = 'P1' | 'P2';
export type Square = 1|2|3|4|5|6|7|8|9;
export type Cell = PlayerId | null;
export type Line = readonly [Square, Square, Square];
export type GameStatus = 'READY'|'PLAYER_1_TURN'|'PLAYER_2_TURN'|'WIN_P1'|'WIN_P2'|'DRAW';

export interface Move { from: Square; to: Square }

export interface RulesConfig {
  movementMode: 'free-blocked' | 'lines-only' | 'adjacent-only'; // omissão: 'free-blocked'
  firstPlayer: PlayerId;            // omissão: 'P1'
  homeLineCounts: boolean;          // omissão: true  (ver Bloco 12 / D5)
  repetitionLimit: number;          // omissão: 3
  maxPlies: number | null;          // omissão: null
  noMovesOutcome: 'lose' | 'draw';  // omissão: 'lose'
}

export interface GameState {
  board: readonly Cell[];           // length 9, index = casa-1
  currentPlayer: PlayerId;
  status: GameStatus;
  winner: PlayerId | null;
  winningLine: Line | null;
  moveCount: number;
  history: readonly Move[];
  positionCounts: Readonly<Record<string, number>>;
  config: RulesConfig;
}

export type MoveErrorCode =
  'GAME_OVER'|'NOT_YOUR_TURN'|'INVALID_SQUARE'|'SAME_SQUARE'|
  'NOT_YOUR_PIECE'|'DESTINATION_OCCUPIED'|'PATH_BLOCKED';

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: MoveErrorCode; message: string }; // message em PT (Bloco 8.4)

export function createGame(config?: Partial<RulesConfig>): GameState;
export function getLegalMoves(state: GameState, player?: PlayerId): Move[];
export function validateMove(state: GameState, move: Move, player?: PlayerId): ValidationResult;
export function applyMove(state: GameState, move: Move): { state: GameState; events: GameEvent[] }; // imutável
export function getWinningMoves(state: GameState, player: PlayerId): Move[];   // vitória imediata possível
export function getThreats(state: GameState, player: PlayerId): Threat[];       // destinos que completam linha
export function positionKey(state: GameState): string;
export function replayFrom(moves: Move[], config?: Partial<RulesConfig>): GameState[]; // estados 0..n
export function serialize(state: GameState): string; export function deserialize(s: string): GameState;
```
`GameEvent`: `MOVE_APPLIED | TURN_CHANGED | THREAT_CREATED | WIN | DRAW_BY_REPETITION | NO_MOVES`.
O motor é **puro e determinístico**: sem `Date`, sem `Math.random`, sem I/O.

> **Atenção a bloqueios:** defender-se de uma ameaça pode ser feito **ocupando o destino** *ou* **ocupando uma casa do caminho** do atacante (no modo `free-blocked`). Por isso nenhuma parte do sistema pode assumir “bloquear = ocupar a casa vazia da linha”; deve perguntar ao motor (`getWinningMoves`, `getLegalMoves`).

---

## 6. IA (`packages/ai`)

### 6.1 Níveis (spec §21–22)
| Nível | Comportamento |
|---|---|
| **Fácil** | ~30% jogadas aleatórias legais; caso contrário: ganha se puder, bloqueia ameaça imediata simples |
| **Médio** | Minimax profundidade 3–4 + avaliação (centro, ameaças, linhas abertas, mobilidade); evita repetição |
| **Difícil** | Minimax + poda Alpha-Beta (profundidade ≥ 8), deteta ciclos, ordenação de jogadas |
| **Perfeito** | Tabela pré-calculada por **análise retrógrada** dos 3 360 estados (ver 6.2): joga o caminho mais rápido para ganhar / mais lento para perder; em empate, evita repetições desnecessárias |

Ordem de decisão base (spec §21): ganhar → impedir derrota imediata → criar ameaça dupla → impedir ameaça dupla → melhorar posição → centro → evitar repetição.
A IA **só** usa `getLegalMoves/applyMove/getWinningMoves` do motor. **Atraso de “pensamento” na UI:** 400–900 ms, configurável.
Todas as funções da IA são **puras** e aceitam uma `seed` para RNG reprodutível.

### 6.2 Solver e relatório de equilíbrio (`tools/solver`) — **entregável obrigatório**
Espaço de estados = C(9,3)·C(6,3)·2 = **3 360**. Gerar a tabela retrógrada (vitória/derrota/empate + distância em jogadas) e escrever `docs/balance-report.md`.

**Valores de referência já calculados por um resolvedor independente (a tua implementação TEM de os reproduzir — se não reproduzir, há bug no motor ou no solver):**

- Modo **`free-blocked`** (omissão), regras por omissão: 3 360 estados; **0** estados sem movimentos; do ponto de vista de quem joga: **2 416 vitórias / 288 derrotas / 656 empates**.
- **Posição inicial = vitória forçada de P1 em 3 jogadas (plies: P1, P2, P1).**
  Exemplo: P1 joga `1→5` (ou `2→5`, ou `3→5`). Todas as 8 respostas legais de P2 perdem. Com `1→5`:
  `7→1` ⇒ P1 `2→7` · `7→4` ou `7→6` ⇒ P1 `2→7` ou `5→1` · `8→1` ⇒ P1 `3→8` · `8→4` ou `8→6` ⇒ P1 `3→8` ou `5→1` · `9→4` ou `9→6` ⇒ P1 `5→1`. (`9→1` é ilegal: passa por `5`.)
  Mecanismo: P1 sai da linha de casa e ameaça **voltar**; P2 só pode impedir ocupando a casa vazia, o que abre outra linha.
- Modo `lines-only`: 16 estados sem movimentos; posição inicial também vitória de P1 em 3 plies.
- Variante “linha de casa não conta” (`homeLineCounts:false`): `free-blocked` ⇒ P1 ainda ganha, em 9 plies; `lines-only` ⇒ **empate**.

Converter os pontos acima em **testes de regressão**. **Não alterar as regras por omissão** por causa disto — o relatório serve para o Sama decidir (Bloco 12). A IA “Perfeita” deve refletir o resultado real (como P1 nunca perde; como P2 perde sempre contra jogo perfeito).

---

## 7. PRODUTO ONLINE, ECONOMIA E PROGRESSÃO

### 7.1 ⚠️ Moeda e apostas — decisão D6 (limite legal/ético)
- Todas as “apostas” usam **moeda virtual (KZ virtual / moedas)**. **Não implementar** depósitos, levantamentos, gateways de pagamento nem conversão para dinheiro real.
- Flag `REAL_MONEY_ENABLED=false` (server + client), sem qualquer caminho de código ativo atrás dela.
- **Salas com aposta** e **Apostas ao Vivo**: confirmação de maioridade (18+) antes da 1.ª entrada, guardada no perfil.
- Mostrar aviso de jogo responsável (texto curto) nas Apostas e em Termos.
- O botão “+” junto ao saldo abre a **Carteira**: bónus diário, missões, histórico; compra de moedas fica como placeholder **desativado** (“Em breve”).

### 7.2 Carteira / Ledger
Tabela `ledger_entries` (append-only, nunca `UPDATE/DELETE`): `id, user_id, delta, reason(enum), ref_type, ref_id, balance_after, created_at`. Saldo = soma/coluna derivada mantida por trigger. Operações sempre por **RPC/Edge Function** transacional; o cliente nunca escreve saldo.
Motivos: `WELCOME_BONUS, DAILY_BONUS, MATCH_STAKE_LOCK, MATCH_PAYOUT, MATCH_REFUND, BET_PLACED, BET_PAYOUT, TOURNAMENT_ENTRY, TOURNAMENT_PRIZE, ADMIN_ADJUST`.
Bónus de boas-vindas (banner do mockup: “ATÉ 5.000 KZ”): valor configurável; omissão: 5 000.

### 7.3 Salas (ecrãs “Salas” e “Sala X”)
Sala = lobby com chat, lista de jogadores online, **aposta fixa por partida** (0 = grátis), capacidade (ex.: 24/50). Salas do mockup: **Luanda 100 KZ · Benguela 50 KZ · Huambo 25 KZ · Cabinda 10 KZ · Global 0 KZ (Free, cap. 100)** + **Angola** (destaque na Home). Filtros: **Todas · Online · Apostas · Amigos**.
Fluxo: Entrar na sala → ver jogadores/chat → **“Jogar”** (matchmaking na sala: fila por sala+aposta, par por `SKIP LOCKED`, preferir Elo próximo) ou desafiar jogador específico.
Mensagens de sistema tipo **Anúncio** (bolha verde, ícone “Anúncio”) geridas por admin.

### 7.4 Partida online
- **Servidor autoritativo:** o cliente envia `{matchId, from, to}` para a Edge Function `submit-move`, que carrega o estado, valida com `@tira/engine`, grava em `match_moves`, atualiza a partida e devolve/emite o novo estado. O cliente só faz **atualização otimista** reversível.
- Realtime por canal `match:{id}` (+ fonte de verdade em DB para reconexão).
- **Relógio por turno:** 45 s (configurável). Mockup mostra contadores por jogador (“00:28 A sua vez” / “00:45 Adversário”). Timeout ⇒ jogada legal aleatória; **3 timeouts seguidos ⇒ derrota**. Prazo guardado como `turn_deadline` (o cliente só desenha a contagem; o servidor decide).
- **Desistir** (botão vermelho) e **Sair** (durante jogo = desistência) pedem confirmação.
- Reconexão: voltar à partida em curso; abandono > 60 s sem ligação ⇒ derrota.
- Fim de partida: Elo, XP, pagamento do prémio (pote = 2×aposta − taxa; `RAKE_PERCENT` omissão 0), histórico.
- Estados da partida: `WAITING → ACTIVE → FINISHED` com `result ∈ {P1,P2,DRAW}` e `reason ∈ {LINE, REPETITION, RESIGN, TIMEOUT, DISCONNECT, NO_MOVES}`.

### 7.5 Progressão
- **Elo** inicial 1000, K=32 (omissão). **Rankings:** Semanal · Global · Amigos; pódio top-3 + lista.
- **XP/Nível** (perfil: “Nível 12 · 1.250 / 2.000 XP”): XP por resultado — vitória +30, empate +10, derrota +5 (tabela configurável); XP necessário por nível em tabela configurável (no mockup, o nível 12 pede 2.000 XP); barra de XP.
- **Estatísticas de perfil:** Vitórias, Derrotas, % Vitória = `vitórias / total de partidas` (empates contam no total).
- **Conquistas** (mín. 12): Primeira Vitória, Série de 5, Dominador do Centro (ganhar com linha pelo 5), Mestre do Bloqueio, Virada (ganhar após ameaça dupla do adversário), Noite de Torneio, etc.
- **Amigos:** pedido/aceitar/remover por username; convidar para partida; estado online.

### 7.6 Torneios
Torneio semanal (banner “PRÉMIO: 50.000 KZ”): inscrição (grátis ou com taxa), janela de inscrição, **eliminatória simples** com byes, partidas de 1 jogo, avanço automático, prémio em moeda virtual. Criação por admin (seed/painel Supabase). Ecrã de torneio com estado, chave e “PARTICIPE AGORA”.

### 7.7 Apostas ao Vivo (ecrã “Apostas”)
Separadores **Ao Vivo · Em Breve · Histórico**. Lista de partidas (“KwanzaMaster vs JJ_Manuel · Aposta: 100 KZ · **1.85x** · [Apostar]”). Odds de resultado calculadas por probabilidade Elo com margem (omissão 5%, mínimo 1.05x). Apostas fecham após a **2.ª jogada**. Pagamento via ledger. Limites por aposta e diário configuráveis. Tudo com moeda virtual (7.1).

### 7.8 Chat e moderação
Chat por sala + chat da partida. Rate-limit (ex.: 1 msg/s), limite de 280 caracteres, filtro de palavrões em PT, **denunciar** e **bloquear** utilizador, silenciar notificações. Mensagens persistidas (últimas N) com Realtime.

### 7.9 Autenticação
Criar conta (email + palavra-passe; preparar telefone/OTP como extensão), Entrar, **Continuar como convidado** (conta anónima Supabase, pode jogar offline e salas grátis; converter para conta conserva progresso). Username único, avatar (conjunto de avatares incluído).

### 7.10 Notificações
Push (Expo) para: desafio recebido, vez de jogar, torneio a começar, pedido de amizade. Preferência em Configurações.

---

## 8. PRODUTO — ECRÃS, DESIGN E UX

### 8.1 Navegação
**Tab bar (5):** Início · Salas · Chat · Rankings · Perfil (ícone + rótulo; tab ativa em dourado). Ecrãs fora da tab bar: Splash, Boas-vindas/Login, Partida, Apostas, Configurações, Torneios, Amigos, Carteira, Tutorial, Replay, Sobre.

### 8.2 Ecrãs (reproduzir o mockup)
1. **Splash** — logótipo (tabuleiro 3×3 com alvo no centro + “TIRA O COCÓ DO MEIO”), “ESTRATÉGIA · MOVIMENTO · CONQUISTA”, barra de progresso, “A JOGAR COM ANGOLA”, padrões geométricos angolanos nos cantos (vermelho/preto/verde).
2. **Boas-vindas** — “Joga, desafia, ganha!”, “O clássico jogo de estratégia angolano. Agora online, com pessoas reais!”, 3 benefícios (“Joga Online ou Offline”, “Salas e Torneios”, “Apostas e Gratuito”), **CRIAR CONTA** (vermelho), **ENTRAR** (contorno), “Continuar como convidado”.
3. **Início** — cabeçalho com logótipo, saldo em pílula dourada com “+”, sino; cartão do utilizador (avatar, nome, Nível, ponto verde online, barra XP); banner **TORNEIO SEMANAL** (fechável, troféu, “PARTICIPE AGORA”); CTAs **JOGAR ONLINE** (verde, “Encontre jogadores em tempo real”) e **JOGAR OFFLINE** (laranja, “Contra a IA”); atalhos SALAS · TORNEIOS · APOSTAS · AMIGOS; “Jogos em Destaque” (“Ver todos”) com cartões de sala e ocupação.
4. **Salas** — chips de filtro + lista (imagem da cidade, “Jogadores: 24/50”, “Aposta: 100 KZ” em dourado, botão **Entrar** verde).
5. **Sala X** — cabeçalho com imagem, “Jogadores: 24/50 | Aposta: 100 KZ”, **Entrar na Sala**, “Jogadores Online” (avatares + nível), bolha de **Anúncio**, mensagens, campo “Escreve uma mensagem…” + enviar.
6. **Partida** — barra superior (avatar/nome/nível dos dois + “Sala Luanda · Aposta: 100 KZ”), tabuleiro com moldura dourada, **centro marcado com alvo**, relógios laterais (“A sua vez” / “Adversário”), rodapé **Desistir** (vermelho) · **Chat** · **Sair**.
7. **Chat da Sala** — cabeçalho da sala (badge Entrar, sino), bolhas com nome colorido, hora, anúncio em verde.
8. **Perfil** — avatar com coroa (se top), Nível, barra XP “1.250 / 2.000 XP”, Vitórias/Derrotas/% Vitória, separadores **Histórico · Conquistas · Amigos**, lista de resultados (Vitória/Derrota/Empate, adversário, hora), “Ver mais”.
9. **Apostas** — ver 7.7, banner “BÓNUS DE BOAS-VINDAS ATÉ 5.000 KZ”, saldo no topo.
10. **Configurações** — Conta · Notificações (toggle) · Som e Música (toggle) · Idioma (Português) · Modo Escuro (toggle) · Ajuda · Termos e Privacidade · Sair · “Versão 1.0”. Acrescentar: Símbolos nas peças, Reduzir animações, Vibração, Modo daltonismo.
11. **Rankings** (não está no mockup — desenhar na mesma linguagem): separadores Semanal/Global/Amigos, pódio top-3, lista com posição, avatar, nome, Elo, variação.
12. **Modo offline** (spec §20, §30–33): seleção **2 JOGADORES · CONTRA COMPUTADOR (Fácil/Médio/Difícil/Perfeito, escolher lado) · COMPUTADOR VS COMPUTADOR (demo)**; **Tutorial** (10 passos da spec §26); **Replay** (spec §24); **Como jogar**; **Sobre**; ecrã de **Vitória/Empate** (spec §33) com “Jogar novamente” e “Sair”.

### 8.3 Sistema de design (`packages/design-tokens`)
Extrair as cores **do PNG com conta-gotas** e fixar em tokens; valores orientadores: fundo quase preto esverdeado (`~#050A08`), superfícies verde-escuro (`~#0B1A14`), **verde esmeralda** (ação/P1, `~#10B25A`), **vermelho** (CTA/P2, `~#D7141B`), **dourado** (saldo, tab ativa, moldura, preços, `~#F2B01E`), **laranja** (Jogar Offline, `~#E8830C`). Raios generosos (14–20), contornos finos translúcidos nos cartões, brilho suave nas ações primárias.
**Peças:** esferas brilhantes com realce especular e sombra de contacto; **casa central** com emblema de alvo (anéis concêntricos) quando vazia; moldura dourada/bronze do tabuleiro. **Tema claro** também obrigatório (toggle “Modo Escuro”), mantendo a identidade.
Imagens das salas/cidades do mockup **não podem ser usadas** (geradas/sem licença): criar **placeholders** (gradiente + silhueta SVG da cidade) em `assets/rooms/*` com slots fáceis de substituir.
Identidade cultural (spec §29): geometria contemporânea inspirada em padrões angolanos; **sem estereótipos nem decoração genérica de “África”**.

### 8.4 Mensagens (PT, mapeadas a `MoveErrorCode` e eventos)
| Evento | Texto |
|---|---|
| Início da vez | “A sua vez. Escolhe uma peça.” |
| Peça selecionada | “Escolhe uma casa livre.” |
| `DESTINATION_OCCUPIED` | “Essa casa está ocupada.” |
| `PATH_BLOCKED` | “Não podes saltar uma peça.” |
| `NOT_YOUR_TURN` | “Ainda não é a tua vez.” |
| `NOT_YOUR_PIECE` | “Essa peça não é tua.” |
| Vitória | “Jogador 1 venceu!” / “Venceste!” (online) |
| Empate | “Empate! A posição repetiu-se.” |
Todas as cadeias em ficheiros i18n (`pt` completo; estrutura pronta para `en`).

### 8.5 Interação do tabuleiro (spec §16–19)
Tocar peça ⇒ realce da peça + **realce das casas de destino válidas** (vindas de `getLegalMoves`); tocar destino ⇒ animar deslocação (150–250 ms); mover → verificar vitória/empate → mudar vez. Indicador permanente de quem joga. Vitória: realçar as 3 peças + linha vencedora, bloquear input, “Jogar novamente”. **Modo tutorial:** realçar ameaças imediatas do adversário (`getThreats`).
**Perspetiva:** online e vs IA, **as peças do utilizador ficam sempre em baixo** (rodar a vista; os índices lógicos não mudam).
Alvos de toque ≥ 48 dp, contraste AA, leitura por ecrã (rótulos: “Casa 5, centro, vazia”), suporte a teclado na web (setas + Enter), animações desligáveis, sons opcionais.

### 8.6 Som e háptico (spec §28)
Eventos: seleção, movimento, erro, ameaça, vitória, empate, início. SFX curtos e discretos (placeholders sintetizados, prontos a substituir); música opcional e desligável; háptico leve no mobile.

---

## 9. FASES E ORDEM DE EXECUÇÃO

| Fase | Conteúdo | Agents | Gate para avançar |
|---|---|---|---|
| **F0** | Monorepo, CI, tokens base, contrato do motor (tipos/stubs) | A1 A2 A3 | `pnpm typecheck && pnpm test` verdes |
| **F1** | Motor completo + testes + solver + relatório | A1 | Bloco 11 §A completo; valores de referência reproduzidos |
| **F2** | IA (4 níveis) + testes | A1 | IA nunca faz jogada ilegal; Perfeita = tabela; Médio/Difícil batem Fácil |
| **F3** | Design system + ecrãs com dados simulados (web + mobile) + jogo offline completo | A2 | Jogo offline jogável de ponta a ponta em web e mobile |
| **F4** | Backend: schema, RLS, auth, salas, matchmaking, `submit-move`, ledger | A3 | Partida online entre 2 clientes com validação no servidor |
| **F5** | Chat, amigos, rankings, XP/Elo, conquistas, torneios, apostas (virtuais), notificações | A2 A3 | Todas as funcionalidades do Bloco 7 |
| **F6** | Tutorial, replay, som, háptico, acessibilidade, i18n, polimento | A2 A4 | Checklist de acessibilidade + fidelidade visual |
| **F7** | QA final, e2e, performance, builds (EAS/Vercel), documentação | A4 | Bloco 11 completo |

Paralelismo: A2 e A3 arrancam em F0 contra o **contrato** do motor; A4 escreve testes e2e à medida que os ecrãs aparecem.

---

## 10. PROMPTS INDIVIDUAIS POR AGENT

### 🧠 A1 — Motor, IA e Solver
**Responsabilidade:** `packages/engine`, `packages/ai`, `tools/solver`, `docs/balance-report.md`.
1. Publicar **primeiro** os tipos e assinaturas do Bloco 5 (com `throw new Error('TODO')`), commit e registo no `PROGRESS.md`.
2. Implementar o motor seguindo **exatamente** o Bloco 3 (atenção a D1 e à **armadilha D2**).
3. Testes (Vitest + `fast-check`), no mínimo: inicialização; 8 linhas vencedoras; ocupação; salto/caminho bloqueado (colineares) e caminho inexistente (não colineares); alternância de turnos; nenhum movimento após fim; repetição 3× com mesma posição+jogador; **a posição inicial não é vitória; após a 1.ª jogada de P1 o jogo continua**; sair e voltar à linha de casa ⇒ vitória; **teste exaustivo** dos 3 360 estados (nenhum sem movimentos em `free-blocked`; `applyMove` preserva 3+3 peças; imutabilidade; `serialize/deserialize` idempotente); propriedade: `getLegalMoves` ⇔ `validateMove.ok`.
4. Implementar IA (Bloco 6) e o solver; gerar tabela da IA Perfeita (ficheiro compacto versionado + script de regeneração); reproduzir **os valores de referência do 6.2** como testes de regressão.
5. Escrever `docs/balance-report.md` (resultados por modo, estados, distâncias, exemplos).
**Critérios de pronto:** cobertura do motor ≥ 95%; zero dependências runtime; IA nunca ilegal em 10 000 partidas IA-vs-IA com seeds diferentes; partidas Perfeito-vs-Perfeito terminam em ≤ 3 plies (P1 ganha) com regras por omissão.

### 🎨 A2 — Design System e Apps (mobile + web)
**Responsabilidade:** `packages/design-tokens`, `packages/game-client` (em conjunto com A3 para a parte online), `apps/mobile`, `apps/web`.
1. Tokens (8.3) e componentes base: Button (primário verde, perigo vermelho, contorno, offline laranja), Card, Chip, Pill de saldo, ProgressBar XP, Avatar + badge de nível, Toggle, Tab bar, Toast, Modal de confirmação, Skeletons.
2. **Componente `Board`** (SVG) com peças animadas, realce de seleção/destinos, casa central com alvo, linha vencedora, perspetiva invertível, acessível.
3. Implementar **todos os ecrãs do 8.2** com dados simulados primeiro, depois ligados ao `game-client`. Comparar **lado a lado com o mockup** (screenshot vs PNG) e corrigir até ficar fiel a espaçamentos, tamanhos, cores e hierarquia.
4. **Jogo offline completo** (PvP local, vs IA 4 níveis, CvC) usando o motor e a IA; guardar histórico local; replay e tutorial.
5. Tema escuro/claro, i18n (`pt`), reduzir animações, símbolos nas peças, teclado na web.
**Critérios de pronto:** fidelidade visual validada ecrã a ecrã (lista no `PROGRESS.md` com capturas); 60 fps nas animações do tabuleiro; nenhuma regra de jogo reimplementada na UI.

### 🌐 A3 — Backend, Realtime e Economia
**Responsabilidade:** `supabase/` e a parte online do `packages/game-client`.
1. **Schema** (migrations versionadas): `profiles, rooms, room_members, matches, match_moves, matchmaking_queue, ledger_entries, bets, tournaments, tournament_entries, messages, friendships, achievements, user_achievements, notifications, reports, blocks`. **RLS em todas as tabelas**, princípio do menor privilégio; escrita sensível só por RPC/Edge Function.
2. Auth (email, anónimo/convidado, conversão de conta), perfil + username único + 18+.
3. **Edge Functions:** `submit-move` (valida com `@tira/engine`), `find-match`, `resign`, `timeout-tick` (cron), `settle-match` (Elo+XP+payout transacional), `place-bet`, `settle-bets`, `join-tournament`, `advance-tournament`, `daily-bonus`.
4. Realtime: canais por sala e por partida; presença (“jogadores online”); reconexão.
5. Seed: salas do mockup, conquistas, torneio semanal de exemplo, contas de teste.
6. Segurança: validação de entrada (zod), rate-limit, sem segredos no cliente, `.env.example`, `REAL_MONEY_ENABLED=false`.
**Critérios de pronto:** duas sessões jogam uma partida completa com validação no servidor; tentativa de jogada ilegal/fora de turno/forjada é rejeitada; ledger nunca dessincroniza (teste de invariantes); testes de RLS a provar que um utilizador não lê/escreve dados alheios.

### ✅ A4 — Qualidade, Acessibilidade, Áudio e Release
**Responsabilidade:** testes e2e, acessibilidade, som/háptico, performance, CI/CD, documentação.
1. CI (GitHub Actions): lint, typecheck, testes unitários, e2e web (Playwright), build web; perfis EAS (`development`, `preview`, `production`).
2. Testes e2e: partida offline completa (vitória, empate por repetição, tentativa de salto), fluxo de conta, sala → partida online (2 contextos), desistência, timeout.
3. Acessibilidade: auditoria WCAG AA, tamanhos de toque, rótulos de leitor de ecrã, daltonismo, teclado, reduzir animações.
4. Áudio/háptico (8.6), com estrutura para trocar os assets.
5. Performance: arranque mobile < 2,5 s em dispositivo médio, bundle web com orçamento, sem *jank* no tabuleiro.
6. Documentação: `README` (setup em 10 min), `docs/ARCHITECTURE.md`, `docs/RELEASE.md`, `docs/DECISIONS.md` atualizado.
**Critérios de pronto:** Bloco 11 integralmente cumprido e evidenciado.

---

## 11. DEFINIÇÃO DE PRONTO

### A) Regras (spec §35, todos obrigatórios)
- [ ] 9 casas; 3 peças por jogador; posição inicial fixa; P1 começa
- [ ] Destino ocupado inválido; saltos impedidos; sem capturas
- [ ] 8 linhas verificadas, **só para o jogador que moveu**; posição inicial não é vitória
- [ ] Vitória termina a partida; empate por repetição (3×) detetado; turnos alternam
- [ ] Movimentos inválidos rejeitados com mensagem clara; nada joga depois do fim
- [ ] PvP, PvE e CvC funcionam; a IA respeita o motor; replay reproduz exatamente os movimentos
- [ ] Valores de referência do solver (6.2) reproduzidos

### B) Produto
- [ ] Todos os ecrãs do 8.2 implementados, fiéis ao mockup, em escuro e claro
- [ ] Offline completo; online completo (salas, partida, chat, amigos, rankings, torneios, apostas virtuais)
- [ ] Servidor autoritativo; RLS verificada; ledger consistente
- [ ] Sem dinheiro real em qualquer caminho de código; gate 18+ nas salas com aposta
- [ ] Acessibilidade (peças não só por cor, toque ≥ 48 dp, contraste AA, animações desligáveis)
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` verdes; builds EAS e Vercel a funcionar

---

## 12. DECISÕES QUE SÓ O SAMA PODE ALTERAR (não mudar sozinho)

| # | Tema | Por omissão (implementado) | Alternativa (já suportada por flag) |
|---|---|---|---|
| D1 | Interpretação do “caminho livre” | `free-blocked` | `lines-only`, `adjacent-only` |
| D5 | **Equilíbrio:** com as regras da spec, P1 ganha sempre em 3 jogadas | Manter a spec tal como está | `homeLineCounts:false` (a linha de casa não conta), ou `firstPlayer` alternado por partida |
| D6 | Dinheiro real | **Desativado** (moeda virtual) | Só após parecer jurídico/licenciamento e integração de pagamentos |
| — | Taxa da casa nas partidas com aposta | 0% | `RAKE_PERCENT` |

---

## 13. REGRAS DE TRABALHO PARA TODOS OS AGENTS

1. **Autonomia:** não pares para pedir permissão. Se bloqueado, regista a dúvida em `docs/DECISIONS.md`, escolhe a opção mais segura/reversível e continua.
2. **Commits pequenos e frequentes** (Conventional Commits). Cada tarefa termina com testes verdes.
3. **Nunca enfraqueças um teste** para o fazer passar. Se o teste estiver errado, explica no `DECISIONS.md`.
4. Atualiza `docs/PROGRESS.md` no fim de cada tarefa (feito / em curso / bloqueado / próximo).
5. **Sem duplicação de regras.** Se precisares de lógica de jogo, importa-a de `@tira/engine`.
6. Sem `any`, sem `console.log` esquecido, sem segredos no repositório, sem dependências desnecessárias (justifica cada uma).
7. Fidelidade ao mockup é requisito, não opinião: compara sempre com `docs/design/mockups.png`.
8. No fim, entrega um **relatório final**: o que foi feito, o que ficou fora, riscos, como correr tudo, e links/instruções de deploy.
