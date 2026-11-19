# Paridade Web ↔ Mobile — o que falta (retomar daqui)

> Contexto: alinhar `apps/mobile` (Expo/RN) para ficar **exatamente igual** à web
> (Next.js) em fontes, bordas, cores e tabuleiro. A **web é a fonte de verdade**.
> Este ficheiro marca o estado e TODO o que falta para continuar depois.
> Atualizado: 2026-11-17 (5.ª sessão: **§2 useNativeDriver FEITO** + **§3.3 FEITO
> em TODOS os ecrãs** — fontSize, lineHeight, letterSpacing, `TiraHeading` e
> auditoria dos 53 usos vs web; tsc/lint 0 erros / 8 warnings; compare OK mas
> A MEIO da sessão — re-executar no fim, ver §2). Antes: 4.ª sessão §3.2 FEITO
> (overlay + CvC), 3.ª sessão §3.1 FEITO + §2 verificado.

---

## Como verificar (sempre antes de dar por feito)

```bash
# Typecheck + lint (mobile) — NÃO usar `npx tsc` (falha com o pacote falso "tsc")
cd apps/mobile
node node_modules\typescript\bin\tsc --noEmit
npx expo lint          # 0 erros; 8 warnings pré-existentes (ver §5)

# Comparação visual automática (Next :3000 + Expo web :8081 + screenshots)
powershell -File scripts/visual-compare/run-compare.ps1
#   → inicia os 2 servidores, espera portas, corre compare.js, mata os processos.
#   → screenshots em C:\Users\Nortuno\AppData\Local\Temp\opencode\cmp-*.png
#   → imprime warnings/erros de console (fontes 404, atributos React, etc.)
#   → inclui teste de interação: clique em "casa 2, Jogador 1" →
#     cmp-{app,web}-board-selected (anel dourado + pontos de destino).
```

Fluxo do compare.js: web = `/` → "Continuar como convidado" → "JOGAR OFFLINE" →
"Contra o Computador" → "COMEÇAR PARTIDA"; app = `/offline` → "Contra o
Computador" → "COMEÇAR PARTIDA" (o modo começa a `null` nos dois).
Depois do tabuleiro: clique em `getByLabel('casa 2, Jogador 1')` nas DUAS
plataformas → screenshot `-board-selected`.
Depois (**4.ª sessão**): fase de overlay — `getByLabel('Voltar')` → "Computador
vs Computador" → "COMEÇAR PARTIDA" → espera o fim automático da partida CvC
(poll `Posição final|Como foi a vitória`, 150s) → screenshot `-gameover`
em cada plataforma. Não usar "Desistir"/"Sair" para chegar ao fim: no app
esses botões usam RN `Alert` que é **no-op no expo web** (ver §4).

---

## 1. FEITO (não refazer)

### Sessões anteriores

- **Fontes**: `assets/fonts/{Inter,BebasNeue,GeistMono}.ttf` descarregados;
  `Font.loadAsync` em `src/app/_layout.tsx` (nativo + web, gate `fontsReady`
  antes de render); `@font-face` **removido** de `global.css` (metro não
  reescreve `url()` → 404); `tailwind.config.js` font display `'Bebas Neue'`.
- **`packages/design-tokens/src/index.ts`**: reescrito com valores exatos da
  web (oklch→hex, raios base 18px, escala de fontes, geometria do tabuleiro,
  estados das casas). **Fonte única — não mexer em `apps/mobile/src/theme/tokens.ts`.**
- **`components/board/Board.tsx`**: port fiel do web (viewBox 300, linhas
  50→250 stroke 7 + diagonais, fills threat>win>selected, anel dourado
  ring-2, ponto válido 14px com pulse, tracejado origem, glow vitória radial
  `rgba(242,176,30)` animado, peças com gradiente inset + sombra, símbolos
  ▲/● como paths, orientação `flipped ? sq : 10-sq`, escala 1.1/1.05, sem
  target mark, peças via cosmetics `#00A859/#ED3237`).
  → **Verificado por screenshot: tabuleiro praticamente pixel-igual ao web.**
- **`components/game/ui.tsx`**: GameButton `fontSize` 14→`sm` (15.75) +
  lineHeight 1.5; BalancePill `sm`/`base`; AVATAR_TEXT 15.75/20.25/27;
  AVATAR_BADGE_TEXT lg→15.75.
- **`components/game/TabBar.tsx`**: bg `alpha(bg,0.95)`, `borderRadius
  radii.lg`, rota `/achievements` adicionada (faltava), pb safe-area 4.5.
- **`components/tira/TiraButton.tsx`**: radius `radii.xl`; variantes
  outline (border-2 `gold/60`) e ghost (`surface-2` + border) iguais ao web.
- **`src/app/game.tsx`**:
  - Ações com ícones **lucide** (`Undo2/Eye/RotateCcw/Flag/LogOut`) via
    `ActionButton` (h-48, label 13.5) — substituíram emojis ↩️⚠️🔄🏳️🚪.
  - Overlay: `RotateCcw/LogOut` (15.75) — substituíram 🔄🚪.
  - PlayerCard: `User/Bot` 16dp, `Clock` 12dp (substituíram 👤🤖⏱);
    "Sua vez"/"A pensar" → `fontSize 11 + uppercase` (web text-[11px]);
    "Sem relógio" → `10px italic`.
  - Header: `headerLeft` = ChevronLeft 48dp round, `headerRight` =
    MessageCircle 48dp → `/how-to-play` (web).
- **`components/tira/TiraScreen.tsx`**: camada `AngolanPattern` (SVG ±45°,
  step 30, gold, opacity 0.018 = `.angolan-pattern` da web); header inline
  `alpha(bg,0.6)` (web `bg-background/60`).
- **`components/game/AppHeader.tsx`**: `alpha(bg,0.95)` (web `bg-background/95`).
- **`src/store/game.ts`**: corrigido TS2367 (`mode === 'practice'` após early
  return — removido da condição do oponente).
- **Board `Rect`**: removido `accessible={true}` (warning React "non-boolean
  attribute" no expo web).

### 3.ª sessão (2026-11-17) — §3.1 + §2

- **§3.1 FIX FEITO em `apps/mobile/src/components/board/Board.tsx`**:
  1. `Platform` importado de `react-native`.
  2. Props do `<Rect>` da célula divididas por plataforma:
     - **web**: `{ onPress: null, onClick, 'aria-label', 'data-testid' }`
       (cast `as unknown as Record<string, unknown>`). `onPress: null` é
       **obrigatório**: sem ele, `prepare()` do rn-svg faz
       `clean.onClick = props.onPress` (undefined) e **apaga** o onClick;
       com `null` o `if (onPress !== null)` não corre e o onClick de `rest`
       sobrevive. `hasTouchableProperty(null)` = false → 0 responder props.
     - **nativo**: `{ onPress, accessibilityLabel, testID }` (como antes).
  3. `pointerEvents="none"` em TODOS os overlays por cima do Rect (anel,
     ponto válido AnimatedCircle, tracejado, glow, e **cada folha** do
     `Piece` — `<G>` sozinho NÃO bloquea filhos no hitTest nativo:
     `GroupView.hitTest` itera filhos sem checar o próprio NONE;
     `RenderableView.hitTest:698` / `RNSVGRenderable.mm:671` só pegam na folha).
  4. `<Svg testID>` → web usa `'data-testid'` (evita warning React DOM).
  - **Validado**: `run-compare.ps1` → **0 warnings rn-svg**; clique em
    `casa 2, Jogador 1` funciona nas DUAS plataformas (anel dourado +
    célula selected + ponto válido no centro). Único erro de console
    restante é **pré-existente do expo-router** (`collapsable={false}`
    non-boolean em View DOM — fora do âmbito, não é da app).
- **§2 VERIFICADO**:
  - `run-compare.ps1` re-executado após todos os fixes de header/pattern/alphas.
  - Teste de interação **adicionado ao `compare.js`** e **OK**:
    `getByLabel('casa 2, Jogador 1').click()` → `-board-selected` em app e web.
  - Screenshots: tabuleiro app ≈ web (pixel-sampling idêntico no estado
    inicial: bg `19,26,22`, linhas `122,130,126`); seleção pinta célula
    `50,49,29` (gold/14) só no app selecionado.
- **Estado final da sessão**: `tsc --noEmit` **0 erros**;
  `expo lint` **0 erros (8 warnings pré-existentes)**.

### 4.ª sessão (2026-11-17) — §3.2 overlay de fim de jogo

- **`apps/mobile/src/app/game.tsx` — `GameOverOverlay` reconstruído** (port
  de `GameScreen.tsx` 468-659 + `LINE_LABELS`/`describeLine` 645-659):
  - Caixa de ícone `w-14 h-14` (56dp) `rounded-2xl` (`radii.cardLg`) com
    lucide `Handshake/Trophy/Frown` 28dp — substituíram 🤝/🏆/😔/discos.
  - Título `TiraHeading level="display"` (Bebas 33.75 = text-3xl) com
    `letterSpacing 0.84` (tracking-wide) + `lineHeight` (leading-none) +
    glow `textShadowColor alpha(gold,0.35) radius 12` na vitória humana
    (`.text-glow-gold`); subtítulo `text-xs` muted.
  - **Tabuleiro FINAL real**: moldura `rounded-xl border alpha(border,0.6)
    bg alpha(surfaceAlt,0.6) p-3`, label `text-[10px] uppercase
    letterSpacing 1` = "Como foi a vitória" (linha de 3) ou "Posição
    final", `<Board state size="sm" lastMove>` (estático, sem
    `onSquarePress`, sem flip — igual à web).
  - Texto: `describeLine(winningLine)` (span `font-medium` foreground) +
    "Jogada final: casa X → Y" ou "Última jogada: casa X → casa Y." +
    "Nenhuma linha foi completada[ — a posição repetiu-se.]".
  - **Título/subtítulo corrigidos para a lógica da web**: cvc →
    `IA {n} venceu!` (antes mostrava "Derrota"), subtítulo usa
    `naturalWin` (linha de 3) senão "A partida terminou sem linha
    vencedora." — i18n mantida (`t('game.*')`).
  - Fundo `alpha(bg, 0.95)` (antes 0.8), cartão `maxWidth 420`,
    `padding 20` (p-5), glow `gold` só se `!isDraw && !humanLost`.
  - Motion: fade overlay 300ms + spring cartão (scale 0.8/y20 → 1,
    stiffness 300 damping 25) + pop ícone (delay 100ms, damping 15);
    tudo desligado com `settings.reduceMotion`.
  - `Confetti` novo (50 peças, cores p1/p2/gold/orange/white, queda
    1.5-3s rotate 720°, uma corrida) só na vitória humana e sem
    reduceMotion; `VictoryRays` novo — conic-gradient do web
    aproximado com 48 cunhas SVG (opacidade rampa 0→1 em 0.20, 1→0 em
    0.25 do quartil), pulso `pulse-soft 1s` (1→0.5→1 → 0.15) — só se
    `!isDraw`.
  - Botões: `ActionButton` p1 `RotateCcw` / outline `LogOut`, label 15.75.
  - Animated values via **`useState(() => new Animated.Value())[0]`**
    (padrão do Board.tsx — ver §4).
- **`apps/mobile/src/lib/i18n/index.ts`**: chaves novas PT/EN/FR —
  `game.ai_won`, `game.end.{board_win,board_final,won_by,final_move,
  last_move,no_line,no_line_draw,no_winner}` e
  `game.line.{bottom,mid,top,col_left,col_mid,col_right,diag_main,
  diag_sec,other}` (rótulos de `LINE_LABELS`).
- **`scripts/visual-compare/compare.js`**: fase nova `gameoverCvc()` em
  ambas as plataformas — "Voltar" → "Computador vs Computador" →
  "COMEÇAR PARTIDA" → poll do overlay → `cmp-{web,app}-gameover`.
  Motivo: RN Alert = no-op no expo web (não dá para desistir no app).
- **Validado**: `tsc` **0 erros**; `expo lint` **0 erros (8 warnings
  pré-existentes)**; `run-compare.ps1` **OK** — screenshots
  `cmp-web-gameover` e `cmp-app-gameover` gerados (jogo CvC terminou nas
  duas plataformas). **Falta inspeção visual desses 2 screenshots**
  (ver §2). O warning `useNativeDriver` foi resolvido na 5.ª sessão (ver §1).

### 5.ª sessão (2026-11-17) — §2 useNativeDriver + §3.3 tipografia

- **`game.tsx` — `useNativeDriver`**: `Platform` importado de `react-native`;
  constante `const useNativeDriver = Platform.OS !== 'web'` junto aos imports;
  todas as 10 animações do overlay (Confetti §660-723, VictoryRays §725-809,
  fade/springs do cartão e ícone §828-905) passaram a usar a constante em vez
  de `true`. No expo web o driver nativo não existe → o warning desapareceu
  (verificado por `run-compare.ps1`: só resta o `collapsable` do expo-router).
- **§3.3 FEITO para os ecrãs prioritários** — `fontSize` hardcoded alinhado com
  a escala web (base 18px: xs 13.5, sm 15.75, base 18, lg 20.25, xl 22.5,
  2xl 27, 3xl 33.75, 4xl 40.5):
  - `index.tsx` (home): 20 valores (16→18, 12→13.5, 14→15.75, 20→22.5,
    24→27, 18→20.25, 30→33.75) + `letterSpacing` 0.02em nos 6 títulos
    display (0.54/0.45/0.45/0.675/0.405/0.45).
  - `profile.tsx`: 10 valores + tracking 0.6→0.675 no nome e 0.45/0.54
    nos valores display.
  - `settings.tsx`: 11 valores 14→15.75 + tracking 0.315 no "0.8s".
  - `rankings.tsx`: 12→13.5 (podium + posição atual), 14→15.75 (nome da
    lista) + tracking 0.02em nos 5 valores display (0.54/0.45/0.405/0.36/0.45).
  - `shop.tsx`: sem mudanças de `fontSize`; tracking do título 0.6→0.844
    (web `tracking-wide` × 33.75).
  - `deposit.tsx`: constantes partilhadas (`GOLD_BUTTON_TEXT`,
    `GHOST_BUTTON_TEXT`, `INPUT_STYLE`, `FormLabel`) 14→15.75; restantes
    14→15.75 e 11/12→13.5; display 18→20.25 / 20→22.5 / 36→40.5 com
    tracking corrigido (0.405, 0.506, 0.405, 0.5625, 1.0125, 0.315).
  - `wallet.tsx`: sem mudanças de `fontSize`; tracking display 1→3.6
    (6xl, web `tracking-wider`), 1→0.54 (2xl) e 0.36 no valor da transação.
  - **Preservados** os literais web `text-[9px]/[10px]/[11px]/[12px]/[14px]`
    e os tamanhos de emoji/ícones.
- **§3.3 CONTINUADO — restantes ecrãs + componentes** (mesma regra; só mudou
  onde a web discordava):
  - Corrigidos: `tournament.tsx` (7), `tournament-play` (1), `watch.tsx` (13),
    `stats.tsx` (9), `notifications.tsx` (8), `achievements.tsx` (1),
    `campaign.tsx` (2), `tutorial.tsx` (1), `welcome.tsx` (4 + 2 botões),
    `auth.tsx` (1).
  - `fontSize` já certos (sem mudar): `offline`, `friends`, `rooms`,
    `campaign-play`, `challenge`, `lightning`, `match`, `about`, `game.tsx`
    (4), `components/game/ui.tsx`, `TabBar`, `AdSlot`, `EmptyState`.
    (Estes ficheiros receberam depois correções de `letterSpacing`/
    `TiraHeading` — ver pontos seguintes.)
  - Componentes corrigidos: `game/AppHeader.tsx` título **18→20.25** (web
    `text-lg` — afeta TODOS os headers), `tira/AgeGateSheet.tsx` input
    **15→15.75**. `themed-text.tsx` é **código morto** (template Expo, sem
    importadores) — 8 `fontSize` por ignorar (ver §3.3 resíduos).
- **`lineHeight` < `fontSize` (corta glifos em RN) — 12 corrigidos** para o
  valor web (Tailwind v4, lido em `node_modules/tailwindcss/theme.css`):
  default **xs18/sm22.5/base27/lg31.5/xl31.5/2xl36/3xl40.5/4xl45** @18px;
  `leading-none`=fs, `leading-tight`=fs×1.25. Casos: `index`×6
  (27, 22.5, 22.5, 33.75, 25.31, 28.13), `profile` 22.5, `campaign` 31.5,
  `stats` 36, `about` 33.75, `achievements` 33.75, `rankings` podium 27.
- **`welcome.tsx` botões 16→18 estava ERRADO → 15.75**: no web o `GameButton`
  tem `text-base-sm` e o call-site `text-base`; `twMerge` mantém **AMBAS** e
  `.text-base-sm` (definido DEPOIS no `@layer utilities` do `globals.css`)
  vence no cascade → **15.75 renderizado** (ver §4).
- **`letterSpacing` display alinhado ao web**:
  - Títulos 3xl `tracking-wide` (0.025em) → **0.844**: `achievements`×2,
    `rankings`, `notifications`, `watch`, `friends`, `shop`.
  - `about` título `tracking-wider` (0.05em) → **1.6875**.
  - `offline` item `text-lg` → 0.405 (+lh 25.31); `wallet` ×2 `text-lg
    tracking-wide` → 0.506; `campaign` título `text-base` → 0.36 (+lh 22.5).
  - Eyebrows body 11px `tracking-wider` = **0.55** (`index` ×3, estavam 1.1).
- **`TiraHeading.tsx` (componente base de TODOS os títulos)**:
  - `fontWeight: bold` **REMOVIDO — web renderiza 400** (preflight reset +
    Bebas single-weight; faux-bold ≠ web). Removido também dos títulos de
    `friends.tsx` e `shop.tsx`.
  - `letterSpacing` default = `fontSize × 0.02` (base `.font-display`) por
    nível: display 0.675 / h1 0.81 / h2 0.54 / h3 0.405 (antes 0.6 fixo).
- **Auditoria dos 53 usos de `TiraHeading` vs web — 48 corrigidos** com
  `style`/`level`: níveis trocados (match `h1`→`display`, lightning ×2
  `h2`→`display`, auth `h3`→`display`, challenge/match `h3`↔`h2`), tracking
  `tracking-wide` por uso (0.844/0.675/0.506/1.0125), `lineHeight` web por
  uso (40.5/36/33.75/31.5/28.125/25.31/20.25), `SectionTitle` com estilo
  próprio (challenge/how-to-play/lightning/share) e share:186 →
  `15.75/0/22.5/600` (`text-sm font-semibold`).
  - **4 UNCERTAIN deixados como estão** (sem heading equivalente na web):
    `auth.tsx:55` "Sessão iniciada", `match.tsx:306` "VS", `rooms.tsx:168`
    "online", `rooms.tsx:268` filtro.
- **Validado**: `tsc --noEmit` **0 erros**; `bunx expo lint` **0 erros (8
  warnings pré-existentes)**; `run-compare.ps1` **OK a meio da sessão**
  (1 warning `collapsable`, sem `useNativeDriver`) — **corrido ANTES da
  varredura tipográfica → re-executar agora** (ver §2) e inspecionar os
  screenshots novos.

---

## 2. PENDENTE — verificação imediata

- [x] Re-executar `run-compare.ps1` (3.ª/4.ª/5.ª sessão — OK; 5.ª com fase CvC).
- [ ] **Re-executar `run-compare.ps1` NO FIM da 5.ª sessão** — a última corrida
  foi **antes** da varredura tipográfica, da auditoria `TiraHeading` e das
  correções de `lineHeight`/`letterSpacing`; gerar screenshots novos
  (`cmp-*`) para inspeção. Só depois disto marcar §3.4.
- [x] Teste de interação no tabuleiro (3.ª sessão — OK, app + web).
- [ ] **Inspeção visual do overlay** (4.ª sessão): comparar
  `cmp-web-gameover.png` vs `cmp-app-gameover.png` em
  `C:\Users\Nortuno\AppData\Local\Temp\opencode\` — título Bebas, caixa
  de ícone, tabuleiro final com linha vencedora, moldura, texto da
  linha, botões. Corrigir divergências se houver. **Ainda por fazer:
  o modelo usado na 5.ª sessão não suporta leitura de imagens.**
- [x] **Warning de console `useNativeDriver` — FEITO (5.ª sessão)**:
  `const useNativeDriver = Platform.OS !== 'web'` em `game.tsx` aplicado
  às 10 animações do overlay (Confetti/Rays/fade/springs). `run-compare.ps1`
  agora imprime só 1 warning/erro de console (o `collapsable` do expo-router).
- [ ] **Confirmar visualmente as fontes** no app (Bebas nos títulos
  "Partida #"/"VS IA", Inter no corpo) — sem 404, mas sem inspeção
  explícita de tipografia lado a lado.
- [ ] **Erros de console restantes**: `collapsable` do expo-router
  (não é da app; se incomodar, ignorar ou ver se expo já corrigiu).

---

## 3. PENDENTE — por resolver (priorizado)

### 3.1 ~~Warnings do react-native-svg~~ — **FEITO (3.ª sessão)**
- Não refazer. Resumo do que ficou (ver §1.3ª sessão): Platform split no
  Rect + `pointerEvents="none"` nas folhas dos overlays + `data-testid` no Svg.
- Se reaparecerem warnings: verificar que não se removeu `onPress: null` no
  branch web nem `pointerEvents` das folhas do Piece.

### 3.2 ~~Overlay de fim de jogo~~ — **FEITO (4.ª sessão)**
- Não refazer. Resumo do que ficou: ver §1 "4.ª sessão" (ícone lucide +
  título display + tabuleiro final + `describeLine` + i18n novas +
  Confetti/Rays + motion; compare.js com fase CvC).
- Se reaparecer divergência: comparar com `GameScreen.tsx` 468-659 e
  com `cmp-{web,app}-gameover.png`.

### 3.3 ~~Varredura de tipografia~~ — **FEITO em TODOS os ecrãs (5.ª sessão)**
- Não refazer. Detalhe em §1 "5.ª sessão": ecrãs prioritários + restantes +
  componentes + `lineHeight` + `letterSpacing` + `TiraHeading` + auditoria dos
  53 usos.
- Regra aplicada: web base 18px → xs 13.5, sm 15.75, base 18, lg 20.25,
  xl 22.5, 2xl 27, 3xl 33.75, 4xl 40.5; literais
  `text-[9px]/[10px]/[11px]/[12px]/[14px]` mantidos; display **sem bold**;
  tracking = `fs×0.02` (+`×0.025` se web `tracking-wide`).
- **Resíduos conhecidos (baixa prioridade)**:
  - 4 usos `TiraHeading` UNCERTAIN: `auth.tsx:55`, `match.tsx:306`,
    `rooms.tsx:168`, `rooms.tsx:268`.
  - `themed-text.tsx` = código morto (8 `fontSize`) — apagar se se confirmar
    que ninguém importa.
  - Eyebrows body com tracking "inventado" noutros ecrãs (`deposit` 1.2,
    `wallet` 1.5, `achievements` 1.1@10px…) — web usa `tracking-wider/widest`
    (11px→0.55, 11px widest→1.1); alinhar na comparação visual (§3.4).
  - `letterSpacing` de display não-heading ainda aproximado (ex.: settings
    "0.8s" 0.315, restos 0.6) — confirmar por screenshot.

### 3.4 Comparação visual dos restantes ecrãs
- Feitos: home, offline-select, game (+tabuleiro + seleção).
- **Passo 0: re-executar `run-compare.ps1`** (screenshot de referência mudou
  com a tipografia da 5.ª sessão — ver §2).
- Falta: profile, settings, shop, rankings, tournament(+play), replay,
  tutorial, how-to-play, wallet/deposit, friends, notifications, stats,
  achievements, welcome/auth, about, challenge, lightning, watch,
  campaign(-play), match, rooms. Comparar par a par (`src/components/screens/*`
  ↔ `apps/mobile/src/app/*`), corrigir divergências e só então marcar feito.

### 3.5 `TiraButton` size `lg` — tamanho de texto
- `lg` usa `typography.fontSize.lg` (20.25) mas o web `GameButton` usa
  sempre `text-base-sm` (15.75). Decidir: alinhar `lg`→15.75 ou manter
  (há ecrãs a usar `size="lg"`?). Rever usos antes de mudar.

### 3.6 Afinar opacity do padrão no ecrã de jogo (opcional)
- Web game: `.angolan-pattern opacity-30` → ~0.0054; mobile usa 0.018 em
  todo o lado. Passar `opacity={0.0054}` no `/game` se se notar diferença.

### 3.7 Teste em NATIVO (device/emulator) — nunca feito
- Fontes via `Font.loadAsync`, toques no Board (anel/pontos — **§3.1 já
  preparou pointerEvents**; falta validar em device), `boxShadow` do
  contêiner do tabuleiro (RN ≥0.76), gradientes inset das peças, haptics,
  TabBar alpha, `AngolanPattern` performance.

### 3.8 Toast que espelha erros de console (dev) — CONCLUÍDO
- §3.1 feito → warnings rn-svg desapareceram; toast LogBox deles também.
- Resta 1 no expo web: `collapsable` do **expo-router** (node_modules,
  não da app). O `useNativeDriver` do overlay foi corrigido na 5.ª sessão
  (§2/§1). Em produção LogBox não aparece.

---

## 4. NÃO fazer (armadilhas descobertas)

- **`npx tsc` falha** em `apps/mobile` (pacote falso `tsc`) →
  `node node_modules\typescript\bin\tsc --noEmit`.
- **Servidores morrem** se iniciados com `Start-Process` avulso → usar
  sempre `scripts/visual-compare/run-compare.ps1` (tudo numa sessão).
- **`@font-face` com `url()` em `global.css`** → 404 (metro/nativewind não
  reescreve). Fontes só via `Font.loadAsync`.
- **Não mexer** em `apps/mobile/src/theme/tokens.ts` (espelho NativeWind do
  globals.css; chain require do tailwind config).
- **Não usar `colors.p1/p2` nas peças do Board** — as peças web são
  `#00A859`/`#ED3237` (cosmetics), não `--p1/--p2` (#35C177/#F45249).
- Dois golds na web: `--gold`≈`#F1BF4E` (classes) vs `rgba(242,176,30)`
  (glow do Board) — mantidos distintos de propósito.
- Orde de prioridade das casas (web `cn()`/twMerge): **threat > win >
  selected**; escala da peça: **lastMoved(1.05) > win/selected(1.1)**.
- Orientação por omissão: **casa 1 em baixo à direita** (`10 - sq`).
- Código com BOM (`game.tsx`, `matchLogic.ts`) — não "corrigir" sem necessidade
  (warning unicode-bom é cosmético).
- **rn-svg web `prepare()`**: não passar `onPress` sem `null` se usar `onClick`
  próprio — `clean.onClick = props.onPress` apaga o handler (ver §1.3ª sessão).
- **`pointerEvents` em rn-svg**: por omissão só na folha ajuda no hitTest
  nativo; `<G pointerEvents="none">` **não** propaga aos filhos no Android/iOS
  (`GroupView.hitTest` / `RNSVGGroup.hitTest` ignoram o NONE do grupo).
- **Lint `react-hooks/refs`**: proíbe `useRef(new Animated.Value()).current`
  em render → usar `const [v] = useState(() => new Animated.Value(x))[0]`
  (padrão do `Board.tsx`).
- **RN `Alert.alert` é no-op no expo web** (`react-native-web` não o
  implementa) — "Desistir"/"Sair" do app não fazem nada no browser; no
  compare usar CvC para chegar ao fim de jogo (ver §2/compare.js).
- Espaçamentos da web (`gap-3`, `h-12`, `w-14`, `p-5`…) → grelha mobile
  ×4 (12/48/56/20) nos tokens; tamanhos de fonte `rem` → ×18 (13.5/15.75…);
  `max-w-[420px]`/`text-[10px]` são px literais.
- **Web `GameButton` renderiza 15.75 mesmo com call-site `text-base`**:
  `cn()` (twMerge) mantém `text-base-sm` **e** `text-base` (testado com
  `twMerge()`), e `.text-base-sm` é definido DEPOIS no `@layer utilities`
  do `globals.css` → vence no cascade. Não "corrigir" para 18 (aprendido
  na 5.ª sessão em `welcome.tsx`).
- **Títulos web = peso 400** (preflight do Tailwind reseta `h1..h6`;
  Bebas Neue single-weight): NUNCA pôr `fontWeight: bold` em texto display
  — faux-bold no app ≠ web (era o default do `TiraHeading`).
- **`letterSpacing` display**: base `.font-display` = 0.02em → `fs×0.02`;
  `tracking-wide` = 0.025em; `tracking-wider` = 0.05em; `tracking-widest`
  = 0.1em (eyebrow 11px → 0.55 / 0.55 / 1.1).
- **`lineHeight` Tailwind v4 @18px** (fonte: `node_modules/tailwindcss/theme.css`,
  `--text-*--line-height`): default xs 18 / sm 22.5 / base 27 / lg 31.5 /
  xl 31.5 / 2xl 36 / 3xl 40.5 / 4xl 45; `leading-none` = fs,
  `leading-tight` = fs×1.25. RN com `lineHeight < fontSize` corta glifos —
  nunca deixar (12 casos corrigidos na 5.ª sessão, ver §1).

---

## 5. Warnings/lint pré-existentes (8, baixa prioridade)

- `game.tsx`: BOM; `forfeit` e `isBoardDisabled` não usados.
- `tournament-play.tsx`: eslint-disable desnecessário.
- `themed-view.tsx`: args `lightColor`/`darkColor` não usados.
- `matchLogic.ts`: BOM.
- `lib/online/tournaments.ts`: `Array<T>` → `T[]`.

---

## 6. Ficheiros-chave

| Papel | Ficheiro |
|---|---|
| Referência visual/cores/raios | `src/app/globals.css`, `src/app/layout.tsx` |
| Tabuleiro web (referência) | `src/components/game/Board.tsx` |
| Kit UI web (referência) | `src/components/game/ui.tsx`, `TabBar.tsx`, `AppHeader.tsx` |
| Overlay fim de jogo web | `src/components/screens/GameScreen.tsx` (468-659) |
| Tokens do app (fonte única) | `packages/design-tokens/src/index.ts` |
| Tabuleiro mobile (§3.1 aqui) | `apps/mobile/src/components/board/Board.tsx` |
| Jogo mobile (§3.2 overlay — FEITO) | `apps/mobile/src/app/game.tsx` |
| i18n mobile (chaves novas do overlay) | `apps/mobile/src/lib/i18n/index.ts` |
| Shell de ecrã + padrão | `apps/mobile/src/components/tira/TiraScreen.tsx` |
| Títulos display mobile (§3.3 base) | `apps/mobile/src/components/tira/TiraHeading.tsx` |
| Escala/line-height web (fonte do sweep) | `node_modules/tailwindcss/theme.css` (`--text-*`) + `src/app/globals.css` |
| Fonts | `apps/mobile/src/app/_layout.tsx`, `apps/mobile/assets/fonts/` |
| Comparação visual + interação + fim de jogo | `scripts/visual-compare/{run-compare.ps1,compare.js}` |
| Este estado | `docs/PARITY-REMAINING.md` |
