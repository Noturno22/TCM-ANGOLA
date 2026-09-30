/**
 * Solver — análise do espaço de estados de Tira o Cocó do Meio.
 *
 * Espaço: C(9,3)·C(6,3)·2 = 3 360 estados (board, currentPlayer).
 *
 * Algoritmo: análise retrógrada (BFS a partir dos estados terminais).
 *  - Estado terminal LOSS para o jogador atual: o adversário tem uma linha vencedora
 *    (considerando homeLineCounts), com exceção da posição inicial (D2: a posição
 *    inicial NÃO é vitória para ninguém).
 *  - Um estado é WIN se algum movimento leva a um estado LOSS (para o adversário).
 *  - Um estado é LOSS se TODOS os movimentos levam a estados WIN (para o adversário).
 *  - Caso contrário DRAW (ciclos onde ninguém força vitória).
 *
 * Referência (Prompt Bloco 6.2): free-blocked, regras por omissão:
 *   3 360 estados; 0 sem movimentos; 2 416 vitórias / 288 derrotas / 656 empates
 *   (do ponto de vista de quem joga).
 */

import {
  applyMove,
  createGame,
  getLegalMoves,
  isGameOver,
  type Cell,
  type GameState,
  type Line,
  type Move,
  type PlayerId,
  WINNING_LINES,
  type RulesConfig,
} from '@/lib/engine';

export type Outcome = 'WIN' | 'LOSS' | 'DRAW';

export interface SolvedState {
  outcome: Outcome;
  /** Distância até ao terminal (em plies). -1 se DRAW. */
  distance: number;
}

const DEFAULT_SOLVER_CONFIG: RulesConfig = {
  movementMode: 'free-blocked',
  firstPlayer: 'P1',
  homeLineCounts: true,
  repetitionLimit: 3,
  maxPlies: null,
  noMovesOutcome: 'lose',
};

/** Posição inicial: P1={1,2,3}, P2={7,8,9}. */
const INITIAL_BOARD: readonly Cell[] = [
  'P1',
  'P1',
  'P1',
  null,
  null,
  null,
  'P2',
  'P2',
  'P2',
];

function boardKey(board: readonly Cell[], player: PlayerId): string {
  return board.map((c) => (c === null ? '.' : c)).join('') + '|' + player;
}

/** Verifica se um jogador tem uma linha vencedora no tabuleiro (considerando homeLineCounts). */
function hasWinningLine(
  board: readonly Cell[],
  player: PlayerId,
  homeLineCounts: boolean,
): Line | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (
      board[a - 1] === player &&
      board[b - 1] === player &&
      board[c - 1] === player
    ) {
      if (!homeLineCounts) {
        if (player === 'P1' && line[0] === 1 && line[1] === 2 && line[2] === 3) continue;
        if (player === 'P2' && line[0] === 7 && line[1] === 8 && line[2] === 9) continue;
      }
      return line;
    }
  }
  return null;
}

/** É a posição inicial (P1={1,2,3}, P2={7,8,9})? */
function isInitialBoard(board: readonly Cell[]): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[i] !== INITIAL_BOARD[i]) return false;
  }
  return true;
}

/** Gera todas as formas de escolher k elementos de arr. */
function combinations<T>(arr: readonly T[], k: number): T[][] {
  const result: T[][] = [];
  const combo: T[] = [];
  function helper(start: number) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1);
      combo.pop();
    }
  }
  helper(0);
  return result;
}

/** Enumera todos os estados (board, currentPlayer) válidos. */
function enumerateAllStates(config: RulesConfig): { board: Cell[]; player: PlayerId }[] {
  const squares = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const states: { board: Cell[]; player: PlayerId }[] = [];
  const p1Choices = combinations(squares, 3);
  for (const p1 of p1Choices) {
    const remaining = squares.filter((s) => !p1.includes(s));
    const p2Choices = combinations(remaining, 3);
    for (const p2 of p2Choices) {
      const board: Cell[] = Array(9).fill(null);
      for (const s of p1) board[s - 1] = 'P1';
      for (const s of p2) board[s - 1] = 'P2';
      states.push({ board, player: 'P1' });
      states.push({ board, player: 'P2' });
    }
  }
  return states;
}

interface SolverResult {
  table: Map<string, SolvedState>;
  counts: { win: number; loss: number; draw: number; total: number };
}

let cachedResult: SolverResult | null = null;

/**
 * Executa a análise retrógrada completa. Resultado memoizado.
 */
export function solve(): SolverResult {
  if (cachedResult) return cachedResult;

  const config = DEFAULT_SOLVER_CONFIG;
  const allStates = enumerateAllStates(config);

  // Tabela de resultados
  const table = new Map<string, SolvedState>();
  // Mapa de chave → estado (para consultar children)
  const stateByKey = new Map<string, { board: Cell[]; player: PlayerId }>();
  // Para cada estado, lista de chaves dos filhos (estados resultantes dos movimentos legais)
  const children = new Map<string, string[]>();
  // Para cada estado, contador de filhos ainda "não resolvidos como WIN para o adversário"
  // (usado para determinar quando todos os filhos são WIN → este é LOSS)
  const remainingChildren = new Map<string, number>();
  // Reversos: para cada estado S, quais estados podem mover para S
  const predecessors = new Map<string, string[]>();

  // 1. Identificar terminais e inicializar estruturas
  const queue: { key: string; outcome: Outcome; distance: number }[] = [];

  for (const st of allStates) {
    const key = boardKey(st.board, st.player);
    stateByKey.set(key, st);

    const opponent: PlayerId = st.player === 'P1' ? 'P2' : 'P1';
    const oppLine = hasWinningLine(st.board, opponent, config.homeLineCounts);
    // Exceção D2: a posição inicial com P1 a jogar NÃO é terminal
    const isInitialP1 = isInitialBoard(st.board) && st.player === 'P1';

    if (oppLine && !isInitialP1) {
      // Terminal LOSS para o jogador atual
      table.set(key, { outcome: 'LOSS', distance: 0 });
      queue.push({ key, outcome: 'LOSS', distance: 0 });
      children.set(key, []);
      remainingChildren.set(key, 0);
      continue;
    }

    // Também verificar: o jogador atual tem uma linha vencedora?
    // (Isto não deveria acontecer em jogo normal, mas pode em estados enumerados.)
    // Se o jogador atual tem linha vencedora (e não é a posição inicial), também é estranho.
    // Tratamos como não-terminal e deixamos a análise seguir.

    // Calcular filhos
    const probeState: GameState = {
      board: st.board,
      currentPlayer: st.player,
      status: st.player === 'P1' ? 'PLAYER_1_TURN' : 'PLAYER_2_TURN',
      winner: null,
      winningLine: null,
      moveCount: 0,
      history: [],
      positionCounts: {},
      config,
    };
    const moves = getLegalMoves(probeState, st.player);
    const childKeys: string[] = [];
    for (const mv of moves) {
      try {
        const { state: childState } = applyMove(probeState, mv);
        // CORREÇÃO: para estados de vitória, o childState.currentPlayer é o vencedor (mover).
        // Mas para o solver, precisamos que o child tenha currentPlayer = oponente (de quem seria a vez),
        // para que a deteção de terminal (oponente tem linha vencedora) funcione.
        const childPlayer: PlayerId = isGameOver(childState)
          ? (st.player === 'P1' ? 'P2' : 'P1')
          : childState.currentPlayer;
        const ck = boardKey(childState.board, childPlayer);
        childKeys.push(ck);
      } catch {
        // movimento inválido (não deveria acontecer)
      }
    }
    children.set(key, childKeys);
    remainingChildren.set(key, childKeys.length);
  }

  // Inicializar predecessores
  for (const key of stateByKey.keys()) {
    predecessors.set(key, []);
  }
  for (const [key, childKeys] of children.entries()) {
    for (const ck of childKeys) {
      predecessors.get(ck)!.push(key);
    }
  }

  // 2. BFS retrógrada
  while (queue.length > 0) {
    const { key, outcome, distance } = queue.shift()!;
    // `outcome` é o resultado para o jogador atual de `key`.
    // Para cada predecessor P (que pode mover para `key`):
    //   - O jogador de P moveu para `key`, por isso `key`.currentPlayer = oponente de P.currentPlayer.
    //   - Se `key` é LOSS (para o seu jogador = oponente de P), então P é WIN.
    //   - Se `key` é WIN (para o seu jogador = oponente de P), então P tem um filho que é WIN para o adversário;
    //     decrementar remainingChildren[P]; se chegar a 0, P é LOSS.
    const preds = predecessors.get(key) ?? [];
    for (const pk of preds) {
      if (table.has(pk)) continue; // já resolvido
      if (outcome === 'LOSS') {
        // P pode mover para um LOSS (do adversário) → P é WIN
        table.set(pk, { outcome: 'WIN', distance: distance + 1 });
        queue.push({ key: pk, outcome: 'WIN', distance: distance + 1 });
      } else if (outcome === 'WIN') {
        // Mais um filho de P é WIN (para o adversário); P só é LOSS quando todos os filhos são WIN
        const rem = (remainingChildren.get(pk) ?? 0) - 1;
        remainingChildren.set(pk, rem);
        if (rem === 0) {
          table.set(pk, { outcome: 'LOSS', distance: distance + 1 });
          queue.push({ key: pk, outcome: 'LOSS', distance: distance + 1 });
        }
      }
    }
  }

  // 3. Estados não resolvidos → DRAW
  let win = 0,
    loss = 0,
    draw = 0;
  for (const key of stateByKey.keys()) {
    if (!table.has(key)) {
      table.set(key, { outcome: 'DRAW', distance: -1 });
      draw++;
    } else {
      const o = table.get(key)!.outcome;
      if (o === 'WIN') win++;
      else if (o === 'LOSS') loss++;
      else draw++;
    }
  }

  cachedResult = {
    table,
    counts: { win, loss, draw, total: allStates.length },
  };
  return cachedResult;
}

/**
 * Consulta o resultado resolvido de um estado.
 */
export function solvePosition(state: GameState): SolvedState {
  const { table } = solve();
  const key = boardKey(state.board, state.currentPlayer);
  return table.get(key) ?? { outcome: 'DRAW', distance: -1 };
}

/** Estatísticas do solver (para testes/relatório). */
export function solverStats() {
  return solve().counts;
}

/** Reseta o cache (para testes com configs diferentes). */
export function resetSolverCache(): void {
  cachedResult = null;
}
