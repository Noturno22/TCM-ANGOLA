# HANDOFF — Som nos movimentos + função "Tira o Coco do Meio"

## Contexto do projeto

- **Repo:** `C:\Users\Nortuno\Desktop\DEV\TCM` — monorepo (Next.js web + Expo mobile + motor puro).
- **Web app:** `src/` (Next.js 16, React 19, Tailwind 4, shadcn, framer-motion, zustand).
- **Motor puro:** `packages/engine/src/index.ts` (cópia edge em `supabase/functions/_shared/engine.ts` — sincronizar com `npm run sync:engine` **se** o engine mudar; NESTE plano **não** é preciso mexer no engine).
- **Som:** `src/lib/sound/index.ts` — efeitos sintetizados via Web Audio API, sem assets. API: `playSound(event: SoundEvent)`, `useSound()`, `setMusicState()`.
- **Testes:** vitest — `npm run test` (inclui `src/lib/**/*.test.ts` e `packages/**/*.test.ts`).
- **Verificações obrigatórias ao fim:** `npm run typecheck`, `npm run lint`, `npm run test`.

---

## Tarefa 1 — Movimentos das peças com som

### Estado atual (já verificado, não repetir pesquisa)

| Caminho | Som de movimento? | Local exato |
|---|---|---|
| Offline (loja `useGame`) | ✅ TEM | `src/store/game.ts` — `selectSquare` → `playSound('select')` **:125**; `attemptMove` → `playSound('move')` **:154**; `aiMove` → `playSound('move')` **:230** |
| Challenge (puzzle diário) | ✅ TEM | `src/components/screens/ChallengeScreen.tsx:108` e `:176` |
| Lightning Challenge | ✅ TEM | `src/components/screens/LightningChallengeScreen.tsx:189` |
| Watch (IA vs IA) | ✅ TEM | `src/components/screens/WatchScreen.tsx:86` |
| **Online** | ❌ **NÃO TEM** | `src/components/screens/OnlineMatchScreen.tsx` |
| **Replay** | ❌ **NÃO TEM** | `src/components/screens/ReplayScreen.tsx` |

### 1a. Online — adicionar sons

Ficheiro: **`src/components/screens/OnlineMatchScreen.tsx`**

- Handler de clique **:114-122**:
  ```ts
  const handleSquareClick = (sq: Square) => {
    if (!state || !mySide || !isMyTurn) return;
    if (state.board[sq - 1] === mySide) {
      setSelected(sq);                 // ← adicionar playSound('select')
    } else if (selected && validTargets.includes(sq)) {
      void playMove(selected, sq);     // ← adicionar playSound('move') (otimista, ao submeter)
      setSelected(null);
    }
  };
  ```
- `playSound` já está importado (**:30**) — só falta usá-lo.
- **Jogada do adversário (chegada via Realtime):** adicionar um `useEffect` que observa `match` e toca `playSound('move')` quando `match.moveCount` aumenta (usar um `useRef` para guardar o `moveCount` anterior; ignorar a primeira execução/montagem para não tocar som ao entrar na partida). Ex.:
  ```ts
  const prevMoveCount = useRef<number | null>(null);
  useEffect(() => {
    if (!match) return;
    if (prevMoveCount.current !== null && match.moveCount > prevMoveCount.current) {
      playSound('move');
    }
    prevMoveCount.current = match.moveCount;
  }, [match]);
  ```
- Cadeia online (para referência): clique → `src/store/match.ts:136-146` (`playMove`) → `src/lib/online/match.ts:290-323` (`submitMove`) → edge `supabase/functions/submit-move/index.ts:147`. Som NÃO deve ir no store/edge — apenas na UI (OnlineMatchScreen).

### 1b. Replay — adicionar som

Ficheiro: **`src/components/screens/ReplayScreen.tsx`**

- Tocar `playSound('move')` em: `handleStepFwd` (**:140-144**), auto-play tick do `useEffect` (**:120-126**) e `handleStepBack` (**:145-148**, opcional — pode usar `'click'`). Importar `playSound` de `@/lib/sound`.

---

## Tarefa 2 — Função "Tira o Coco do Meio"

### Requisito (pedido do utilizador)

> Quando um dos jogadores, ao jogar, estiver **no meio** e **escorado/encurralado**, sem mais jogadas a não ser **sair do meio**, ativar a função **"tira o coco do meio"** que sobe **alguns pop-ups animados** a dizer para tirar o coco do meio.

### Interpretação da condição (regra proposta — confirmar com o utilizador se em dúvida)

Casa central = **casa 5** (`SQUARE_COORDS` no engine, `packages/engine/src/index.ts:120-130`; `Board.tsx` trata `sq === 5` como `'centro'`).

Condição `isTrappedInMiddle(state)` (função pura, nova):

1. Jogo **não terminou** (`!isGameOver(state)`), **E**
2. O jogador da vez (`state.currentPlayer`) tem peça na **casa 5**, **E**
3. Existem movimentos legais (`getLegalMoves(state).length > 0`), **E**
4. **Todos** os movimentos legais têm `from === 5` — ou seja, a única jogada possível é tirar o coco do meio.

> Alternativa mais lata (se o utilizador quiser gatilho mais frequente): jogador com peça na casa 5 **e** todos os movimentos legais envolvem a casa 5 (`from === 5 || to === 5`). Começar pela regra 1-4 (mais fiel ao texto).

### Ficheiros a criar

#### 1. `src/lib/cocoDoMeio.ts` — detetor puro

```ts
import { getLegalMoves, isGameOver, type GameState } from '@tira/engine';

/** A casa 5 é o "meio" do tabuleiro. */
export const CENTER_SQUARE = 5;

/**
 * "Tira o Coco do Meio": o jogador da vez está com a peça no meio e
 * encurralado — todos os movimentos legais saem do meio (from === 5).
 */
export function isTrappedInMiddle(state: GameState): boolean {
  if (isGameOver(state)) return false;
  if (state.board[CENTER_SQUARE - 1] !== state.currentPlayer) return false;
  const moves = getLegalMoves(state);
  if (moves.length === 0) return false;
  return moves.every((m) => m.from === CENTER_SQUARE);
}
```

#### 2. `src/lib/cocoDomeio.test.ts` — testes vitest

- Montar `GameState` manualmente (copiar o helper `makePuzzleState` de `src/lib/puzzles.test.ts:12-24`).
- Casos: (a) posição onde só há jogadas de casa 5 → `true`; (b) peça no meio mas há jogadas de outras peças → `false`; (c) sem peça no meio → `false`; (d) jogo terminado → `false`; (e) sem movimentos legais → `false`.
- **Nota:** o vitest só inclui `src/lib/**/*.test.ts` — o ficheiro tem de ficar em `src/lib/`.

#### 3. `src/components/game/CocoDoMeioPopup.tsx` — pop-ups animados

Convenções a seguir (verificadas no repo):
- `'use client'`, `motion` + `AnimatePresence` de `framer-motion`.
- Respeitar `useSettings((s) => s.reduceMotion)` (padrão em `GameScreen.tsx:71`, `Board.tsx:52`) — com `reduceMotion`, usar só `opacity` (sem springs/scale).
- Overlay `pointer-events-none`, `aria-hidden`, estilo neon compatível com o design (bordas douradas/neon, `font-display`, `backdrop-blur`).

Comportamento proposto:
- Props: `active: boolean` (condição verdadeira) e opcional `moveCount: number` (para re-disparar a cada nova jogada).
- Quando `active` fica `true`: tocar **`playSound('coco')`** (novo evento) e mostrar **2-3 pop-ups em sequência** (stagger ~250ms), subindo de baixo (`y: 40 → 0`, spring), ex.:
  1. "🥥 Tira o coco do meio!"
  2. "Só te resta sair do meio!"
  3. "Tira o coco do meio, rápido!"
- Auto-ocultar após ~3.5s (`AnimatePresence` exit `opacity 0, y -20`).
- Não re-disparar enquanto a condição se mantiver na mesma jogada (dedup por `moveCount`).

#### 4. Som novo — `src/lib/sound/index.ts`

- Acrescentar `'coco'` à união `SoundEvent` (**:10-23**).
- Adicionar `case 'coco':` no switch de `playSound` (**:133+**) — sugerido: sequência urgente, ex.:
  ```ts
  case 'coco':
    playSequence([
      { freq: 660, dur: 0.09, type: 'square', vol: 0.14 },
      { freq: 880, dur: 0.09, type: 'square', vol: 0.14 },
      { freq: 660, dur: 0.09, type: 'square', vol: 0.14 },
      { freq: 1174, dur: 0.22, type: 'triangle', vol: 0.16 },
    ], 0.06);
    break;
  ```

### Onde montar o popup (4 ecrãs com tabuleiro jogável)

| Ecrã | Fonte do `state` | Onde montar |
|---|---|---|
| `src/components/screens/GameScreen.tsx` | `useGame()` → `state` (**:45-67**) | dentro do root `fixed inset-0 z-40` (**:169**), antes do `GameOverOverlay` (**:383**); esconder quando `gameOver` |
| `src/components/screens/OnlineMatchScreen.tsx` | `matchToGameState(match)` → `state` (**:81**) | antes do overlay de resultado (**:305**); esconder quando `finished` |
| `src/components/screens/TournamentPlayScreen.tsx` | `useGame()` → `game.state` | root `fixed inset-0 z-40` (**:121**), antes do `AnimatePresence` de resultado (**:183**) |
| `src/components/screens/CampaignPlayScreen.tsx` | `useGame()` → `game.state` | root `fixed inset-0 z-40` (**:141**), antes do overlay de resultado (**:255**) |

Padrão de uso em todos:

```tsx
const cocoActive = !isGameOver(state) && isTrappedInMiddle(state);
// ...
<CocoDoMeioPopup active={cocoActive} moveCount={state.moveCount} />
```

> Em `GameScreen`/`Tournament`/`Campaign` o estado já vem da loja `useGame` (que já toca `playSound('move')` no commit — `src/store/game.ts:154/:230`), por isso **só o online e o replay** carecem do Tarefa 1.

### Fora de âmbito (salvo pedido explícito)

- **App mobile** (`apps/mobile/`) — usa haptics em vez de som (`apps/mobile/src/app/watch.tsx:5`); não foi tocada.
- **Motor/edge** — `getLegalMoves` já existe (`packages/engine/src/index.ts:348-368`); não há alterações nem `sync:engine`.
- **i18n** — os ecrãs de jogo são hardcoded em PT (como os restantes); manter PT. (Dicionários em `src/lib/i18n/index.ts` só se pedirem EN/FR.)

---

## Ordem de execução sugerida

1. `src/lib/sound/index.ts` — evento `'coco'`.
2. `src/lib/cocoDoMeio.ts` + `src/lib/cocoDomeio.test.ts`.
3. `src/components/game/CocoDoMeioPopup.tsx`.
4. Som online: `OnlineMatchScreen.tsx` (`select`/`move` + efeito de `moveCount` do adversário).
5. Som replay: `ReplayScreen.tsx`.
6. Montar popup nos 4 ecrãs.
7. Correr `npm run typecheck`, `npm run lint`, `npm run test`.

## Comandos de verificação

```bash
npm run typecheck
npm run lint
npm run test
```
