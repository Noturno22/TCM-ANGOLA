/**
 * `@/content` — fachada de dados partilhados do app.
 *
 * Todos os ecrãs mobile importam conteúdo partilhado daqui. As cópias locais
 * em `src/lib/` são sincronizadas com o protótipo web (`src/lib/` na raiz do
 * monorepo) — sem caminhos relativos para fora de `apps/mobile`.
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
} from '@/lib/puzzles';

export {
  CAMPAIGN_LEVELS,
  TOTAL_CAMPAIGN_LEVELS,
  getCampaignLevel,
  type CampaignLevel,
} from '@/lib/campaign';

export {
  commentOnMove,
  commentOnStart,
  type Commentary,
} from '@/lib/commentary';
