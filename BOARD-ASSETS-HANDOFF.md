# Handoff — Tabuleiro com assets PNG (Tabuleiro.png + peças)

> **Objetivo:** Tabuleiro do `Board.tsx` (mobile) renderizado com `Tabuleiro.png`
> como fundo e peças PNG (`assets/images/p/*.png`) posicionadas sobre as casas,
> com animação de movimento — em todos os ecrãs que usam `<Board />`.
>
> **Estado: IMPLEMENTAÇÃO COMPLETA + correções de posicionamento do ponto de
> destino e responsividade — lint (0 erros) e typecheck a passar.**
> Falta verificação visual em dispositivo/emulador (§6) e calibração fina.

---

## 1. O que foi feito (nesta sessão)

### 1.1 Reescrita de `apps/mobile/src/components/board/Board.tsx`

Antes: SVG desenhado (moldura, linhas, peças-sphere). Agora, 5 camadas:

```
<View width=total height=round(total·1034/1520)>
  1. <Image>  Tabuleiro.png            (resizeMode="stretch", aspect exato)
  2. <Svg>    estados (tints, anel, ponto, tracejado, win-glow)
  3. <Pressable> × 9                   (só se houver onSquarePress)
  4. <View pointerEvents="none">       (wrapper das peças — NÃO mexer)
       <Image> peça estática por casa  (transform: scale)
       <Animated.Image> peça animada   (translateX/Y 0→delta, native driver)
  </View>
</View>
```

**API `BoardProps` intacta** (10 ecrãs) — não mudar.

### 1.2 Calibração FINAL (pixel-scanning de Tabuleiro.png + referencia.png)

| Constante | Valor | Origem |
|---|---|---|
| `BOARD_W × BOARD_H` | 1520 × 1034 | dimensões nativas do PNG |
| `ROW_FY` | `[0.122, 0.361, 0.638]` | Y das 3 linhas prateadas (scan: 126/373/660 px) |
| `COL_FX` (por linha) | `[[0.301,0.501,0.703], [0.276,0.501,0.731], [0.247,0.501,0.764]]` | interseções com as verticais (que abrem em perspetiva; fits lineares: esq x(y)=455−0.156(y−145), dir x(y)=1071+0.175(y−145), centro≈762) |
| `PIECE_BASE_DY` | `0.07` | base da peça fica 7% da altura abaixo da linha (medido em referencia.png: top 0.192 vs linha 0.120; base 0.708 vs 0.641) |
| `PIECE_W_FRAC` | `0.095` | largura da peça ≈ 9.5% da largura do tabuleiro (referencia: 71/746) |
| `SPHERE_DY` | `0.775` | centro da esfera a 22.5% do topo da peça |
| `SPHERE_R_FRAC` | `0.42` | raio do anel de seleção (esfera+halo ≈ 0.37 + margem) |
| `STAND_MID_DY` | `PIECE_BASE_DY/2` | tint/glow centrados no meio da zona de apoio |

> **Validado com mock**: composto Tabuleiro.png + 6 peças em PIL — peças calham
> exatamente nas interseções (ficheiro `mock.py` usou estes valores).
> NOTA: `ROW_FY`/`COL_FX` são **experiência/medidas desta sessão**, DIFEREM da
> tabela proposta no handoff anterior (que usava extremos das linhas; os
> corretos são as interseções com as verticais inclinadas).

### 1.3 Comportamento por estado (prioridade igual ao `cn()` do web)

| Estado | Marcador | Posição |
|---|---|---|
| Ameaça | tint radial `colors.p2` @0.10→0 | centro zona de apoio, r=0.33·cell |
| Vitória | tint `colors.gold` @0.16→0 **+** glow `#F2B01E` pulsante (0.6↔1) | idem, glow r=0.30·cell |
| Selecionada | tint gold @0.14→0 **+** anel `colors.gold` stroke 2 | anel na **esfera** da peça (r=0.42·pieceW) |
| Destino válido (vazia) | ponto `colors.boardValidDot` r=7 pulsante | **centro da interseção** (`cy = p.y`, igual ao tracejado) — antes estava na esfera fantasma, ficava muito acima |
| Última jogada (origem vazia) | tracejado `colors.boardLastMoveDash`, r=0.2·cell, dash "4 4" | ponto de interseção |
| Escala peça | sel/win 1.1, lastMove 1.05 (prioridade: sel/win > lastMove, igual ao web) | `transform: [{scale}]` |

### 1.4 Animação (port do web)

- `animMove` state `{from,to,player}` — lido de `state.board[lastMove.to-1]`.
- `Animated.Value` `animProgress` 0→1, **260ms Easing.out(ease)**,
  `useNativeDriver: true` (translateX/Y), timeout **300ms** limpa `animMove`.
- Durante anim: peça em `to` **não** desenha-se; `Animated.Image` arranca no
  retângulo de `from` e interpola até `to`.
- `reduceMotion` (de `useSettings`) desliga anim, glow e ponto.
- Deps do efeito: `[lastMove, reduceMotion, board, animProgress]`.
- **PADRÃO OBRIGATÓRIO**: `useState(() => new Animated.Value(0))[0]` — o lint
  tem a regra `react-hooks/refs` ativa; `useRef().current` dá ERRO.

### 1.5 Geometria de toque

- Bandas de linha: `[0, (fy0+fy1)/2, (fy1+fy2)/2, 1]` = [0, 0.2415, 0.4995, 1].
- Colunas por linha: limites = meios entre `COL_FX[row]` adjacentes (0 e 1 nas
  extremidades) → perspetiva correta por linha.
- Cada Pressable: `accessibilityRole="button"`, `accessibilityLabel` (função
  `cellLabel` inalterada: `casa N`/`centro`, `Jogador 1/2`, `, selecionada`,
  `, destino válido`, `, vazia`), `testID={testID}-sq-${square}`.
- Container: `accessibilityLabel="Tabuleiro de …"` + `testID={testID}`.

### 1.6 Peças

```ts
PIECE_SRC   = { P1: p/p1v.png (verde 759×985), P2: p/p1r.png (vermelho 730×991) }
PIECE_ASPECT= { P1: 985/759, P2: 991/730 }
```
p1r≡p2r≡p3r e p1v≡p2v≡p3v (MD5 idênticos) → só se usa p1r/p1v.
Âncora: **base centrada no ponto** (left = x − pieceW/2, top = baseY − height).

### 1.7 Responsividade (sessão seguinte)

- **Encaixe ao contentor**: o `Board` passou a ter um wrapper externo
  (`alignSelf: 'stretch'`, `alignItems: 'center'`, `collapsable={false}`,
  `onLayout`) que mede a largura disponível; `total = min(size, contentor)`.
  Geometria 100% fracionária (`ROW_FY`/`COL_FX`) → nunca desalinha peças,
  independentemente do dispositivo. O wrapper interno mantém
  `width/height` fixos (camadas intactas).
- **Teto md→lg (360→440)** em 8 ecrãs (`min(preset, largura−32)`):
  telemóveis ≤392dp ficam iguais (largura-limited); tablets e ecrãs largos
  ganham tabuleiro maior. Mini-boards de resultado (`size="sm"`) não mudam.
- **`scroll={false}` removido** em `game`, `match`, `lightning` (continha
  `scroll={false}`): em ecrãs pequenos/paisagem o conteúdo passa a fazer
  scroll em vez de ser cortado. `tournament-play` mantém (tem ScrollView
  interno com header próprio).

### 1.8 Correções pré-existentes (não da task, mas bloqueavam `tsc`)

- `src/store/settings.ts:87` — `createAsyncStorage<SettingsStore>()` →
  `<Settings>()` (migrate devolve `Settings` ⇒ PersistedState=Settings).
- `src/components/tira/TiraScreen.tsx:134` — `pointerEvents` não existe em
  `ImageProps` (RN nova) → imagem envolvida em `<View pointerEvents="none">`.
  **Mesma razão pela qual o Board usa o wrapper View das peças.**

---

## 2. Ficheiros alterados

```
apps/mobile/src/components/board/Board.tsx      ← REESCRITO + ponto de destino na interseção + encaixe ao contentor
apps/mobile/src/store/settings.ts               ← fix genérico storage (1 linha)
apps/mobile/src/components/tira/TiraScreen.tsx  ← fix pointerEvents em Image
ecrãs (8): campaign-play, challenge, game, lightning, match, replay,
           tournament-play, watch               ← teto de board md→lg (440)
ecrãs (3): game, match, lightning               ← scroll={false} removido
```

Assets usados (já no repo, NÃO mexer):
```
apps/mobile/assets/images/Tabuleiro.png     fundo 1520×1034
apps/mobile/assets/images/p/p1v.png         peça verde  (P1)
apps/mobile/assets/images/p/p1r.png         peça vermelha (P2)
apps/mobile/assets/images/referencia.png    referência visual
```

NÃO alterados (regra de ouro): `packages/engine`, `src/store/game`,
`useGame.ts`, ecrãs (nenhum precisa de mudança — API do Board igual).

---

## 3. Verificação feita

```bash
cd apps/mobile
bunx tsc --noEmit     # → TSC OK (0 erros)
bunx expo lint        # → 0 errors, 8 warnings (todos pré-existentes:
                      #    BOM game.tsx/matchLogic, vars unused em
                      #    game.tsx/themed-view/tournaments, disable em
                      #    tournament-play — NÃO são desta task)
```

Não existem testes unitários/e2e do Board mobile
(`glob apps/mobile/**/*.{test,spec}.ts(x)` → vazio; o Playwright `e2e/` corre
contra a app **web** em :3000, não contra o Expo).

---

## 4. Pendências / próximos passos (ordem sugerida)

1. **Verificação visual em dispositivo/emulador** (única coisa que falta mesmo):
   ```bash
   cd apps/mobile && bunx expo start        # (ou npx expo start)
   ```
   - [ ] `game.tsx` pvp/pve: peças nas interseções, P2 (vermelha) em cima,
         P1 (verde) em baixo, não-flipped (igual a `referencia.png`)
   - [ ] Selecionar peça → tint + anel dourado na esfera
   - [ ] Mover → animação 260ms origem→destino; origem fica com tracejado
   - [ ] Destino vazio → ponto verde pulsante
   - [ ] Fim de jogo → tint + glow pulsante; overlay `size="sm"` (game.tsx:1024)
   - [ ] `flipped` (alguns modos) → perspetiva inverte corretamente
   - [ ] `reduceMotion` ON → sem animações
   - [ ] Ameaças ON (se mostrar) → tint vermelho
2. **Calibração fina em ecrã real** — se algo estiver desalinhado, só mexer em:
   - `ROW_FY` / `COL_FX` (posição das casas)
   - `PIECE_BASE_DY` (peça mais acima/baixo da linha)
   - `PIECE_W_FRAC` (peça maior/menor; referência = 0.095)
   - Marcadores: raios `0.33/0.30·cell`, `SPHERE_R_FRAC`
   Dica PIL para novo mock: compor `Tabuleiro.png` + peças com os valores e
   ver sobreposto (script da sessão anterior: `mock.py` — recriar se preciso).
3. **Testar todos os ecrãs com `<Board />`** (só passam `size`+handlers, sem
   mudanças esperadas): game (422, 1024), campaign-play (339, 538),
   challenge (273), lightning (441), match (327), replay (329),
   tournament-play (302, 454), tutorial (354), watch (398).
4. **Scroll vertical**: `game.tsx` usa `TiraScreen scroll={false}`; o tabuleiro
   ficou **mais baixo** (altura = 0.68·largura em vez de quadrado) — deve
   libertar espaço; se sobrar espaço/mudar layout, ajustar no ecrã.
5. **Opcional futuro** (não fazer sem pedido):
   - Reativar cosméticos (`lib/cosmetics.ts`) como override do PNG (D6 diz:
     ignorados nesta task).
   - Variante de peças p2/p3 (byte-idênticas; exigiria tracking UI-only).
   - Sprite/`Animated` do glow com `useNativeDriver` (hoje glow/ponto são
     `useNativeDriver:false` porque animam props do Svg — igual ao old Board).

---

## 5. Decisões (mantidas + novas)

| # | Decisão | Razão |
|---|---|---|
| D1 | `Tabuleiro.png`, não `tabuleiro.svg` | SVG 19 MB / 45k paths |
| D2 | Peças de `assets/images/p/`, não `peoes.png` | individuais fornecidas; idênticas por cor |
| D3 | P1=verde=`p1v`, P2=vermelho=`p1r` | `piece_classic` + referencia (vermelhas em cima = P2 não-flipped) |
| D4 | API `BoardProps` intacta | 10 ecrãs importam o componente |
| D5 | Board = render puro do GameState | regras só em `@tira/engine` |
| D6 | Sem cosméticos para fundo/peça | assets fixos pedidos |
| D7 | Âncora = base no ponto da interseção | bonecos altos; calibrado com referencia |
| D8 | Aspect 1520/1034 gerido **dentro** do Board | `size` continua = largura; game.tsx não mudou |
| D9 | Casas = interseções linhas×verticais (não extremos da linha) | verticais inclinadas em perspetiva; confirmado no mock |
| D10 | Camada de peças num `<View pointerEvents="none">` | `pointerEvents` não existe em `ImageProps`; sem isto as peças bloqueiam os Pressable |
| D11 | `animProgress` via `useState(() => new Animated.Value(0))` | regra lint `react-hooks/refs` proíbe `useRef().current` em render |
| D12 | Tints/glow em RadialGradient (não retângulos) | PNG não tem fundos de célula; radial fica suave sobre a arte |

---

## 6. Comandos úteis

```bash
cd apps/mobile
bunx expo start        # dev server
bunx expo lint         # lint (0 errors esperado)
bunx tsc --noEmit      # typecheck (TSC OK esperado)
bunx expo install --fix# se mexer em deps
bun test packages/engine  # testes do motor (raiz do repo)
```

---

## 7. Estado das tarefas

- [x] Análise + geometria medida (sessão anterior)
- [x] Reescrever `Board.tsx` (fundo PNG, casas, toque, estados, peças, animação)
- [x] Lint + typecheck
- [x] Ponto de destino válido na interseção (estava na esfera fantasma → "muito acima")
- [x] Responsividade: encaixe ao contentor + teto md→lg + scroll nos ecrãs fixos
- [ ] Verificação visual em dispositivo + calibração fina (§4.1–4.2)
- [ ] Testar os 10 ecrãs (§4.3) — em especial tablets (tabuleiro 440) e modais estreitos

---

*Documento gerado para transferência entre sessões. Atualizar §7 (e §1.2 se a
calibração mudar) quando a verificação visual for feita.*
