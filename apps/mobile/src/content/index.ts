/**
 * `@/content` — ÚNICO ponto onde o app mobile acede aos dados partilhados
 * do protótipo web (árvore `src/` na raiz do monorepo).
 *
 * Todos os ecrãs mobile importam conteúdo partilhado daqui — NUNCA com
 * caminhos relativos para fora de `apps/mobile` (o padrão anterior em
 * `src/app/challenge.tsx`/`index.tsx`). Os tipos re-exportados são os
 * mesmos dos ficheiros de origem, pelo que nada muda para os consumidores.
 *
 * Regras: dados puros apenas (sem APIs DOM/browser), sem regras de jogo
 * (essas vivem em `@tira/engine`), sem rede.
 */
export {
  PUZZLES,
  PUZZLES as puzzles,
  getTodayPuzzle,
  getPuzzleByIndex,
  TOTAL_PUZZLES,
  type Puzzle,
} from '../../../../src/lib/puzzles';

export {
  CAMPAIGN_LEVELS,
  TOTAL_CAMPAIGN_LEVELS,
  getCampaignLevel,
  type CampaignLevel,
} from '../../../../src/lib/campaign';

export {
  commentOnMove,
  commentOnStart,
  type Commentary,
} from '../../../../src/lib/commentary';
