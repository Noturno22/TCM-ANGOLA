# Ecrã de Game Premium — fiel a `public/TelaGame.png`

> Documento de continuidade. Objetivo: seguir fielmente a referência
> `public/TelaGame.png` (narrativa de game premium, muito SVG + 3D).

## Objetivo

Recriar o ecrã de partida da referência `public/TelaGame.png` com fidelidade:
fundo de arena neon, avatares robot em SVG, tabuleiro com moldura dourada 3D,
peças glossy e botões neon — tudo em SVG/CSS 3D, sem novas dependências.

## Anatomia da referência (imagem → componente)

| Zona | Detalhes da referência |
|---|---|
| Header | Botão circular «voltar» (esq.), centro `VS IA · FÁCIL` + `Partida #0`, botão circular chat (dir.) |
| Cards de jogador | Avatar robot em SVG, nome, relógio `mm:ss`, ponto ativo no canto, `SUA VEZ` (verde) / `A PENSAR…` |
| Badge | `VS` grande, branco com glow verde, entre os cards |
| Banner de estado | Painel hexagonal com borda neon verde e texto verde: «A tua vez. Escolhe uma peça.» |
| Tabuleiro 3D | Moldura dourada com setas angulares laterais, anéis neon verdes atrás, linhas metálicas prateadas, flare quente ao centro, peças glossy (▲ verde em baixo / ■ vermelho em cima) |
| Estatísticas | Chips escuros: 🏆 `JOGADAS` · 🏆 dourado `HISTÓRICO` |
| Ações | Neon: `Anular` · `Ameaças` · `Reiniciar`; `Desistir` (vermelho) · `Sair` (neon) |
| Fundo | Escuro com raios diagonais verdes, estrelas cintilantes, painéis tech e chevron dourado na base |

## Feito

- `src/components/game/ArenaBackground.tsx` (novo) — fundo arena SVG:
  raios diagonais neon, brilhos radiais, painéis tech, estrelas cintilantes
  (`arena-star-animated`), chevron dourado na base, vinheta.
- `src/components/game/RobotAvatar.tsx` (novo) — avatares SVG:
  `human` (robot branco, olhos verdes) e `ai` (robot escuro, olhos vermelhos).
- `src/components/game/Board.tsx` (reescrito visual, API igual) —
  aresta escura + banda dourada metálica + acentos (setas laterais e chanfros),
  interior com cosmético e reflexo de topo, linhas metálicas (gradiente prata +
  contorno escuro) quando `line_solid`, flare central pulsante (`board-flare`),
  anéis neon atrás (`BoardRings`), chão de brilho verde, peças glossy com
  glow da cor, símbolos ▲ (P1) / ■ arredondado (P2).
  Hit-test: camadas decorativas com `pointer-events-none`, grelha com `z-10`,
  sem `preserve-3d`/`translateZ` nos botões (evita cliques perdidos no e2e).
- `src/app/globals.css` — keyframes `arena-twinkle`, `arena-spin`,
  `board-flare-pulse`.
- `src/components/screens/GameScreen.tsx` — layout fiel completo
  (header flutuante, `PlayerCard` com robot + anéis, badge `VS`, banner
  hexagonal, chips `JOGADAS`/`HISTÓRICO`, botões neon, fundo `ArenaBackground`);
  lógica preservada (relógios, dialogs, overlay de fim de jogo).
- `src/lib/cosmetics.ts` — fundo «Arena Neon» (`bg_arena`, preço 0) e
  `FREE_BACKGROUND_ID = 'bg_arena'`.
- `src/store/settings.ts` — migração (persist v1): `bg_white` → `bg_arena`
  + adicionar `bg_arena` a `ownedCosmetics`.

## Pendente

- Verificação visual da tela face a `public/TelaGame.png` (revisão humana).
- (opcional) alinhar `OnlineMatchScreen` ao mesmo padrão visual.

## Contratos a preservar

- **e2e**: `role="grid"` com aria «Tabuleiro de Tira o Cocó do Meio…»;
  `gridcell` labels (`casa N, Jogador X`, `centro, vazia, destino válido`,
  `…, selecionada`); texto exato «A tua vez. Escolhe uma peça.»; botões
  «Desistir» + «Sim, desistir»; headings «Jogador N venceu!»/«Empate!».
- **Cosméticos**: fundo/linha/peça continuam aplicados (loja funciona).
- **Acessibilidade**: `reduceMotion` desliga cintilação/animações;
  foco visível, labels aria nos botões redondos do header.
- **Stack**: React 19 + Tailwind v4 + framer-motion; sem dependências novas.

## Comandos de verificação

```bash
bun run typecheck
bun run lint
bun run test
bun run e2e
```
