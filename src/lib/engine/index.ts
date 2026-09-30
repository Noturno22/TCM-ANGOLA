/**
 * Tira o Cocó do Meio — Motor do jogo (game engine)
 *
 * Implementação pura, determinística, sem dependências runtime.
 * Sem `Date`, sem `Math.random`, sem I/O.
 *
 * Regras (fonte de verdade): docs/spec/especificacao.md + docs/PROMPT_AGENTS.md (Bloco 3)
 *
 * Decisões críticas:
 *  - D1: movementMode 'free-blocked' (omissão)
 *  - D2: vitória só verificada para o jogador que moveu (a posição inicial NÃO é vitória)
 *  - D3: empate por 3ª ocorrência da mesma posição + mesmo jogador
 *  - D4: em free-blocked é impossível não ter movimentos legais
 */

export type PlayerId = 'P1' | 'P2';
export type Square = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Cell = PlayerId | null;
export type Line = readonly [Square, Square, Square];
export type GameStatus =
  | 'READY'
  | 'PLAYER_1_TURN'
  | 'PLAYER_2_TURN'
  | 'WIN_P1'
  | 'WIN_P2'
  | 'DRAW';

export interface Move {
  from: Square;
  to: Square;
}

export type MovementMode = 'free-blocked' | 'lines-only' | 'adjacent-only';

export interface RulesConfig {
  movementMode: MovementMode;
  firstPlayer: PlayerId;
  homeLineCounts: boolean;
  repetitionLimit: number;
  maxPlies: number | null;
  noMovesOutcome: 'lose' | 'draw';
}

export interface GameState {
  /** length 9, index = casa - 1 */
  board: readonly Cell[];
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
  | 'GAME_OVER'
  | 'NOT_YOUR_TURN'
  | 'INVALID_SQUARE'
  | 'SAME_SQUARE'
  | 'NOT_YOUR_PIECE'
  | 'DESTINATION_OCCUPIED'
  | 'PATH_BLOCKED';

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: MoveErrorCode; message: string };

export interface Threat {
  player: PlayerId;
  from: Square;
  to: Square;
  line: Line;
}

export type GameEvent =
  | { type: 'MOVE_APPLIED'; move: Move }
  | { type: 'TURN_CHANGED'; player: PlayerId }
  | { type: 'THREAT_CREATED'; player: PlayerId; threats: Threat[] }
  | { type: 'WIN'; player: PlayerId; line: Line }
  | { type: 'DRAW_BY_REPETITION' }
  | { type: 'NO_MOVES'; outcome: 'lose' | 'draw' };

/** As 8 linhas vencedoras (especificação §8). */
export const WINNING_LINES: readonly Line[] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [1, 4, 7],
  [2, 5, 8],
  [3, 6, 9],
  [1, 5, 9],
  [3, 5, 7],
] as const;

export const DEFAULT_CONFIG: RulesConfig = {
  movementMode: 'free-blocked',
  firstPlayer: 'P1',
  homeLineCounts: true,
  repetitionLimit: 3,
  maxPlies: null,
  noMovesOutcome: 'lose',
};

export const MOVE_ERROR_MESSAGES: Record<MoveErrorCode, string> = {
  GAME_OVER: 'A partida já terminou.',
  NOT_YOUR_TURN: 'Ainda não é a tua vez.',
  INVALID_SQUARE: 'Posição inválida.',
  SAME_SQUARE: 'Escolhe uma casa diferente.',
  NOT_YOUR_PIECE: 'Essa peça não é tua.',
  DESTINATION_OCCUPIED: 'Essa casa está ocupada.',
  PATH_BLOCKED: 'Não podes saltar uma peça.',
};

/** Coordenadas (col, row) de cada casa para verificação de colinearidade. */
const SQUARE_COORDS: Record<Square, readonly [number, number]> = {
  1: [0, 0],
  2: [1, 0],
  3: [2, 0],
  4: [0, 1],
  5: [1, 1],
  6: [2, 1],
  7: [0, 2],
  8: [1, 2],
  9: [2, 2],
};

/**
 * Pares de casas colineares (mesma linha/coluna/diagonal pelo centro)
 * e as casas intermédias que têm de estar vazias.
 */
const COLLINEAR_PATHS: Readonly<Record<string, Square[]>> = (() => {
  const squares = [1, 2, 3, 4, 5, 6, 7, 8, 9] as Square[];
  const map: Record<string, Square[]> = {};
  for (const a of squares) {
    for (const b of squares) {
      if (a === b) continue;
      const [ax, ay] = SQUARE_COORDS[a];
      const [bx, by] = SQUARE_COORDS[b];
      const dx = bx - ax;
      const dy = by - ay;
      const sameRow = dy === 0;
      const sameCol = dx === 0;
      const sameDiag = Math.abs(dx) === Math.abs(dy) && dx !== 0;
      if (!sameRow && !sameCol && !sameDiag) continue;
      // Determina as casas intermédias
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      const ux = dx / steps;
      const uy = dy / steps;
      const between: Square[] = [];
      for (let i = 1; i < steps; i++) {
        const cx = ax + ux * i;
        const cy = ay + uy * i;
        // Encontrar a casa correspondente
        const sq = squares.find((s) => {
          const [sx, sy] = SQUARE_COORDS[s];
          return sx === cx && sy === cy;
        });
        if (sq) between.push(sq);
      }
      if (between.length > 0) {
        map[`${a}->${b}`] = between;
      }
    }
  }
  return map;
})();

function isSquare(n: number): n is Square {
  return n >= 1 && n <= 9 && Number.isInteger(n);
}

function otherPlayer(p: PlayerId): PlayerId {
  return p === 'P1' ? 'P2' : 'P1';
}

function statusForPlayer(p: PlayerId): GameStatus {
  return p === 'P1' ? 'PLAYER_1_TURN' : 'PLAYER_2_TURN';
}

function winStatusForPlayer(p: PlayerId): GameStatus {
  return p === 'P1' ? 'WIN_P1' : 'WIN_P2';
}

/**
 * Cria um novo jogo com a posição inicial fixa.
 * P1 ocupa 1,2,3 (topo); P2 ocupa 7,8,9 (base); 4,5,6 vazias.
 */
export function createGame(config?: Partial<RulesConfig>): GameState {
  const cfg: RulesConfig = { ...DEFAULT_CONFIG, ...config };
  const board: Cell[] = [
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
  const state: GameState = {
    board,
    currentPlayer: cfg.firstPlayer,
    status: statusForPlayer(cfg.firstPlayer),
    winner: null,
    winningLine: null,
    moveCount: 0,
    history: [],
    positionCounts: {},
    config: cfg,
  };
  // Conta a posição inicial como 1ª ocorrência (D3)
  const key = positionKey(state);
  state.positionCounts = { [key]: 1 };
  return state;
}

/**
 * Verifica se um movimento é válido, devolvendo um código de erro legível.
 */
export function validateMove(
  state: GameState,
  move: Move,
  player: PlayerId = state.currentPlayer,
): ValidationResult {
  // 6. O jogo já terminou?
  if (
    state.status === 'WIN_P1' ||
    state.status === 'WIN_P2' ||
    state.status === 'DRAW'
  ) {
    return { ok: false, code: 'GAME_OVER', message: MOVE_ERROR_MESSAGES.GAME_OVER };
  }
  // 1. É o turno do jogador?
  if (state.currentPlayer !== player) {
    return { ok: false, code: 'NOT_YOUR_TURN', message: MOVE_ERROR_MESSAGES.NOT_YOUR_TURN };
  }
  // 4. Origem e destino são posições válidas?
  if (!isSquare(move.from) || !isSquare(move.to)) {
    return { ok: false, code: 'INVALID_SQUARE', message: MOVE_ERROR_MESSAGES.INVALID_SQUARE };
  }
  // Same square
  if (move.from === move.to) {
    return { ok: false, code: 'SAME_SQUARE', message: MOVE_ERROR_MESSAGES.SAME_SQUARE };
  }
  // 2. A origem contém uma peça do jogador?
  const fromIdx = move.from - 1;
  const toIdx = move.to - 1;
  if (state.board[fromIdx] !== player) {
    return { ok: false, code: 'NOT_YOUR_PIECE', message: MOVE_ERROR_MESSAGES.NOT_YOUR_PIECE };
  }
  // 3. O destino está vazio?
  if (state.board[toIdx] !== null) {
    return {
      ok: false,
      code: 'DESTINATION_OCCUPIED',
      message: MOVE_ERROR_MESSAGES.DESTINATION_OCCUPIED,
    };
  }
  // 5. O caminho está livre? (conforme movementMode)
  const pathError = checkPath(state, move);
  if (pathError) {
    return {
      ok: false,
      code: pathError,
      message: MOVE_ERROR_MESSAGES[pathError],
    };
  }
  return { ok: true };
}

function checkPath(
  state: GameState,
  move: Move,
): MoveErrorCode | null {
  const mode = state.config.movementMode;
  if (mode === 'free-blocked') {
    // Apenas impede saltos em retas colineares
    const key = `${move.from}->${move.to}`;
    const between = COLLINEAR_PATHS[key];
    if (between && between.length > 0) {
      for (const sq of between) {
        if (state.board[sq - 1] !== null) {
          return 'PATH_BLOCKED';
        }
      }
    }
    return null;
  }
  if (mode === 'lines-only') {
    // Só permitido mover ao longo de retas, com caminho livre
    const key = `${move.from}->${move.to}`;
    const between = COLLINEAR_PATHS[key];
    // Se não há entrada nem colinearidade direta, verificar se são colineares adjacentes
    const [ax, ay] = SQUARE_COORDS[move.from];
    const [bx, by] = SQUARE_COORDS[move.to];
    const dx = bx - ax;
    const dy = by - ay;
    const sameRow = dy === 0 && dx !== 0;
    const sameCol = dx === 0 && dy !== 0;
    const sameDiag = Math.abs(dx) === Math.abs(dy) && dx !== 0;
    if (!sameRow && !sameCol && !sameDiag) {
      return 'PATH_BLOCKED'; // não está em nenhuma reta
    }
    if (between && between.length > 0) {
      for (const sq of between) {
        if (state.board[sq - 1] !== null) {
          return 'PATH_BLOCKED';
        }
      }
    }
    return null;
  }
  // adjacent-only: só para casas vizinhas (1 passo em reta)
  const [ax, ay] = SQUARE_COORDS[move.from];
  const [bx, by] = SQUARE_COORDS[move.to];
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  const isAdjacent =
    (dx === 1 && dy === 0) ||
    (dx === 0 && dy === 1) ||
    (dx === 1 && dy === 1);
  if (!isAdjacent) {
    return 'PATH_BLOCKED';
  }
  return null;
}

/**
 * Devolve todos os movimentos legais para o jogador (omissão: jogador atual).
 */
export function getLegalMoves(state: GameState, player: PlayerId = state.currentPlayer): Move[] {
  if (
    state.status === 'WIN_P1' ||
    state.status === 'WIN_P2' ||
    state.status === 'DRAW'
  ) {
    return [];
  }
  if (state.currentPlayer !== player) return [];
  const moves: Move[] = [];
  for (let sq = 1; sq <= 9; sq++) {
    if (state.board[sq - 1] !== player) continue;
    for (let dest = 1; dest <= 9; dest++) {
      if (dest === sq) continue;
      if (state.board[dest - 1] !== null) continue;
      const r = validateMove(state, { from: sq as Square, to: dest as Square }, player);
      if (r.ok) moves.push({ from: sq as Square, to: dest as Square });
    }
  }
  return moves;
}

/**
 * Encontra a linha vencedora para um jogador (ou null).
 * Procura apenas nas linhas onde TODAS as 3 casas pertencem ao jogador.
 */
function findWinningLineFor(state: GameState, player: PlayerId): Line | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (
      state.board[a - 1] === player &&
      state.board[b - 1] === player &&
      state.board[c - 1] === player
    ) {
      // Considerar homeLineCounts: se falso, ignorar a linha de casa do jogador
      if (!state.config.homeLineCounts) {
        // 1-2-3 é a linha de casa do P1; 7-8-9 é a linha de casa do P2
        if (player === 'P1' && line[0] === 1 && line[1] === 2 && line[2] === 3) continue;
        if (player === 'P2' && line[0] === 7 && line[1] === 8 && line[2] === 9) continue;
      }
      return line;
    }
  }
  return null;
}

/**
 * Aplica um movimento de forma IMUTÁVEL. Devolve o novo estado + eventos.
 * @throws Error se o movimento for ilegal. O chamador deve validar primeiro com validateMove().
 */
export function applyMove(
  state: GameState,
  move: Move,
): { state: GameState; events: GameEvent[] } {
  const validation = validateMove(state, move);
  if (!validation.ok) {
    throw new Error(`Movimento inválido: ${validation.code} — ${validation.message}`);
  }

  const events: GameEvent[] = [];
  const mover = state.currentPlayer;
  const opponent = otherPlayer(mover);
  const fromIdx = move.from - 1;
  const toIdx = move.to - 1;

  // Novo tabuleiro (cópia)
  const newBoard: Cell[] = [...state.board];
  newBoard[fromIdx] = null;
  newBoard[toIdx] = mover;

  const newHistory: Move[] = [...state.history, move];
  const newMoveCount = state.moveCount + 1;

  // Calcular positionCounts para a NOVA posição (com opponent a jogar)
  // Nota: a chave inclui o jogador atual, por isso usamos opponent.
  const newKey = `${p1Squares(newBoard).join(',')}|${p2Squares(newBoard).join(',')}|${opponent}`;
  const newCounts: Record<string, number> = { ...state.positionCounts };
  newCounts[newKey] = (newCounts[newKey] ?? 0) + 1;

  // Estado "intermédio" para consultas (vitória, ameaças, movimentos legais)
  const probe: GameState = {
    ...state,
    board: newBoard,
    currentPlayer: opponent,
    status: statusForPlayer(opponent),
    history: newHistory,
    moveCount: newMoveCount,
    positionCounts: newCounts,
  };

  let newStatus: GameStatus;
  let newWinner: PlayerId | null = null;
  let newWinningLine: Line | null = null;
  let nextPlayer: PlayerId = mover; // se vitória, fica o vencedor

  // D2: verificar vitória APENAS para o jogador que moveu
  const winLine = findWinningLineFor(probe, mover);
  if (winLine) {
    newStatus = winStatusForPlayer(mover);
    newWinner = mover;
    newWinningLine = winLine;
    nextPlayer = mover;
    events.push({ type: 'WIN', player: mover, line: winLine });
  } else if (newCounts[newKey] >= state.config.repetitionLimit) {
    // D3: empate por repetição
    newStatus = 'DRAW';
    nextPlayer = opponent;
    events.push({ type: 'DRAW_BY_REPETITION' });
  } else if (state.config.maxPlies !== null && newMoveCount >= state.config.maxPlies) {
    newStatus = 'DRAW';
    nextPlayer = opponent;
    events.push({ type: 'DRAW_BY_REPETITION' });
  } else {
    // Verificar se o adversário tem movimentos legais (outros modos)
    const opponentMoves = getLegalMoves(probe, opponent);
    if (opponentMoves.length === 0) {
      if (state.config.noMovesOutcome === 'lose') {
        newStatus = winStatusForPlayer(mover);
        newWinner = mover;
        nextPlayer = mover;
        events.push({ type: 'NO_MOVES', outcome: 'lose' });
      } else {
        newStatus = 'DRAW';
        nextPlayer = opponent;
        events.push({ type: 'NO_MOVES', outcome: 'draw' });
      }
    } else {
      // Continua o jogo
      newStatus = statusForPlayer(opponent);
      nextPlayer = opponent;
      events.push({ type: 'TURN_CHANGED', player: opponent });
      // Detetar ameaças do adversário (para feedback/tutorial)
      const opponentThreats = getThreats(probe, opponent);
      if (opponentThreats.length > 0) {
        events.push({
          type: 'THREAT_CREATED',
          player: opponent,
          threats: opponentThreats,
        });
      }
    }
  }

  events.unshift({ type: 'MOVE_APPLIED', move });

  const newState: GameState = {
    board: newBoard,
    currentPlayer: nextPlayer,
    status: newStatus,
    winner: newWinner,
    winningLine: newWinningLine,
    moveCount: newMoveCount,
    history: newHistory,
    positionCounts: newCounts,
    config: state.config,
  };

  return { state: newState, events };
}

/** Helpers para extrair casas de cada jogador (ordenadas). */
function p1Squares(board: readonly Cell[]): number[] {
  const r: number[] = [];
  for (let i = 0; i < 9; i++) if (board[i] === 'P1') r.push(i + 1);
  r.sort((a, b) => a - b);
  return r;
}
function p2Squares(board: readonly Cell[]): number[] {
  const r: number[] = [];
  for (let i = 0; i < 9; i++) if (board[i] === 'P2') r.push(i + 1);
  r.sort((a, b) => a - b);
  return r;
}

/**
 * Movimentos que completam uma linha imediatamente para o jogador.
 */
export function getWinningMoves(state: GameState, player: PlayerId): Move[] {
  const legal = getLegalMoves(state, player);
  const wins: Move[] = [];
  for (const move of legal) {
    // Simular sem alterar o estado real
    const simBoard: Cell[] = [...state.board];
    simBoard[move.from - 1] = null;
    simBoard[move.to - 1] = player;
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (
        simBoard[a - 1] === player &&
        simBoard[b - 1] === player &&
        simBoard[c - 1] === player
      ) {
        if (!state.config.homeLineCounts) {
          if (player === 'P1' && line[0] === 1 && line[1] === 2 && line[2] === 3) continue;
          if (player === 'P2' && line[0] === 7 && line[1] === 8 && line[2] === 9) continue;
        }
        wins.push(move);
        break;
      }
    }
  }
  return wins;
}

/**
 * Ameaças: movimentos legais do jogador que completariam uma linha.
 * (Equivalente a getWinningMoves, mas expresso como Threats.)
 */
export function getThreats(state: GameState, player: PlayerId): Threat[] {
  const winningMoves = getWinningMoves(state, player);
  const threats: Threat[] = [];
  for (const move of winningMoves) {
    // Encontrar a linha que seria completada
    const simBoard: Cell[] = [...state.board];
    simBoard[move.from - 1] = null;
    simBoard[move.to - 1] = player;
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (
        simBoard[a - 1] === player &&
        simBoard[b - 1] === player &&
        simBoard[c - 1] === player
      ) {
        if (!state.config.homeLineCounts) {
          if (player === 'P1' && line[0] === 1 && line[1] === 2 && line[2] === 3) continue;
          if (player === 'P2' && line[0] === 7 && line[1] === 8 && line[2] === 9) continue;
        }
        threats.push({ player, from: move.from, to: move.to, line });
        break;
      }
    }
  }
  return threats;
}

/**
 * Chave de posição para deteção de repetição (D3).
 * Formato: "<casas P1 ordenadas>|<casas P2 ordenadas>|<jogador atual>"
 */
export function positionKey(state: GameState): string {
  const p1: number[] = [];
  const p2: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (state.board[i] === 'P1') p1.push(i + 1);
    else if (state.board[i] === 'P2') p2.push(i + 1);
  }
  p1.sort((a, b) => a - b);
  p2.sort((a, b) => a - b);
  return `${p1.join(',')}|${p2.join(',')}|${state.currentPlayer}`;
}

/**
 * Reproduz uma sequência de movimentos a partir do estado inicial.
 * Devolve a lista de estados [estado0, estado1, ..., estadoN].
 */
export function replayFrom(
  moves: Move[],
  config?: Partial<RulesConfig>,
): GameState[] {
  const states: GameState[] = [createGame(config)];
  for (const move of moves) {
    const last = states[states.length - 1];
    try {
      const { state } = applyMove(last, move);
      states.push(state);
    } catch {
      // movimento inválido no replay — parar
      break;
    }
  }
  return states;
}

/**
 * Serializa o estado para string JSON compacta.
 */
export function serialize(state: GameState): string {
  return JSON.stringify({
    b: state.board,
    cp: state.currentPlayer,
    st: state.status,
    w: state.winner,
    wl: state.winningLine,
    mc: state.moveCount,
    h: state.history,
    pc: state.positionCounts,
    c: state.config,
  });
}

export function deserialize(s: string): GameState {
  const o = JSON.parse(s);
  return {
    board: o.b,
    currentPlayer: o.cp,
    status: o.st,
    winner: o.w,
    winningLine: o.wl,
    moveCount: o.mc,
    history: o.h,
    positionCounts: o.pc,
    config: o.c,
  };
}

/** Utilitário: conta peças de um jogador. */
export function countPieces(state: GameState, player: PlayerId): number {
  let n = 0;
  for (const c of state.board) if (c === player) n++;
  return n;
}

/** Utilitário: o jogo terminou? */
export function isGameOver(state: GameState): boolean {
  return (
    state.status === 'WIN_P1' ||
    state.status === 'WIN_P2' ||
    state.status === 'DRAW'
  );
}

/** Utilitário: de quem é a vez (ou null se terminou). */
export function turnPlayer(state: GameState): PlayerId | null {
  if (isGameOver(state)) return null;
  return state.currentPlayer;
}
