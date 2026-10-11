/**
 * Lógica pura do fluxo de jogo offline — SEM React / React Native.
 *
 * Tudo aqui são funções puras sobre dados:
 *  - criação da partida e seleção de casas;
 *  - aplicação de jogadas legais via @tira/engine (createGame/applyMove/
 *    getLegalMoves/getThreats/isGameOver) — as regras vivem SÓ no motor;
 *  - respostas da IA via @tira/ai (`chooseMove` com dificuldade + seed);
 *  - resignação, undo e fluxo de turnos (PvE vs IA, PvP local, Treino).
 *
 * O wiring para React vive em `./useGame`; o estado persistido vive em
 * `@/store/game`. Estritamente offline — sem rede.
 */
import { chooseMove, type Difficulty } from '@tira/ai';
import {
  applyMove,
  createGame,
  getLegalMoves,
  getThreats,
  isGameOver,
  type GameState,
  type Line,
  type Move,
  type PlayerId,
  type Square,
  type Threat,
} from '@tira/engine';

/** Modos de jogo suportados: PvP local, PvE vs IA e Treino Livre. */
export type GameMode = 'pvp' | 'pve' | 'practice';

export interface StartGameOptions {
  mode: GameMode;
  difficulty?: Difficulty;
  humanSide?: PlayerId;
  showThreats?: boolean;
  timePerTurn?: number;
}

/**
 * Fatia de dados da partida (estado + opções).
 * O `GameStore` estende esta interface e acrescenta campos/ações de UI.
 */
export interface MatchSnapshot {
  state: GameState;
  mode: GameMode;
  difficulty: Difficulty;
  humanSide: PlayerId; // em pve/treino, que lado o humano controla
  timePerTurn: number;
  selectedSquare: Square | null;
  validTargets: Square[];
  lastMove: Move | null;
  winner: PlayerId | null;
  winningLine: Line | null;
  moveCount: number;
  /** Histórico de estados para replay/undo dentro da partida */
  stateHistory: GameState[];
  /** Ameaças ativas do adversário (para modo tutorial) */
  currentThreats: Threat[];
  showThreats: boolean;
}

/**
 * Ameaças ativas do adversário — movimentos vencedores de quem NÃO joga
 * (o jogador que acabou de mover), para o feed do modo tutorial.
 */
export function activeThreats(state: GameState): Threat[] {
  const threatOwner: PlayerId = state.currentPlayer === 'P1' ? 'P2' : 'P1';
  return getThreats(state, threatOwner);
}

/** Cria uma nova partida a partir das opções (omissões iguais à web). */
export function createMatch(opts: StartGameOptions): MatchSnapshot {
  const {
    mode,
    difficulty = 'medium',
    humanSide = 'P1',
    showThreats = false,
    timePerTurn = 45,
  } = opts;
  const state = createGame();
  return {
    state,
    mode,
    difficulty,
    humanSide,
    timePerTurn,
    selectedSquare: null,
    validTargets: [],
    lastMove: null,
    winner: null,
    winningLine: null,
    moveCount: 0,
    stateHistory: [state],
    currentThreats: activeThreats(state),
    showThreats,
  };
}

/**
 * Alvos legais ao selecionar uma casa, ou `null` se a casa NÃO pode ser
 * selecionada (jogo terminado, vez da IA, peça que não é do jogador atual).
 */
export function selectableTargets(match: MatchSnapshot, sq: Square): Square[] | null {
  const { state, mode, humanSide } = match;
  if (isGameOver(state)) return null;
  if (mode !== 'pvp' && state.currentPlayer !== humanSide) return null;
  if (state.board[sq - 1] !== state.currentPlayer) return null;
  return getLegalMoves(state, state.currentPlayer)
    .filter((m) => m.from === sq)
    .map((m) => m.to);
}

/** Aplica um movimento já aceite pelo motor e devolve a nova fatia. */
function commitMove(match: MatchSnapshot, move: Move, next: GameState): MatchSnapshot {
  return {
    ...match,
    state: next,
    selectedSquare: null,
    validTargets: [],
    lastMove: move,
    moveCount: next.moveCount,
    winner: next.winner,
    winningLine: next.winningLine,
    stateHistory: [...match.stateHistory, next],
    currentThreats: activeThreats(next),
  };
}

/**
 * Aplica a jogada do humano a partir da casa selecionada (`selectedSquare`).
 * Devolve `null` se a jogada for inválida — nesse caso nada muda.
 */
export function applyHumanMove(match: MatchSnapshot, to: Square): MatchSnapshot | null {
  const { state, selectedSquare, mode, humanSide } = match;
  if (!selectedSquare) return null;
  if (mode !== 'pvp' && state.currentPlayer !== humanSide) return null;
  if (isGameOver(state)) return null;
  const move: Move = { from: selectedSquare, to };
  try {
    const { state: next } = applyMove(state, move);
    return commitMove(match, move, next);
  } catch {
    return null;
  }
}

/** É a vez da IA? (pve/treino, com o humano do outro lado — nunca em pvp) */
export function isAiTurn(match: MatchSnapshot): boolean {
  if (match.mode === 'pvp') return false;
  if (isGameOver(match.state)) return false;
  return match.state.currentPlayer !== match.humanSide;
}

/**
 * Seed determinístico para a IA (mesma fórmula da web).
 * Puro: o chamador fornece o relógio (`Date.now()`).
 */
export function aiSeed(now: number, moveCount: number): number {
  return (now + moveCount * 7919) | 0;
}

/**
 * Calcula e aplica a resposta da IA com `chooseMove` (@tira/ai).
 * Devolve `null` se não for vez da IA ou se a IA não tiver jogada.
 */
export function applyAiMove(match: MatchSnapshot, seed: number): MatchSnapshot | null {
  if (!isAiTurn(match)) return null;
  const move = chooseMove(match.state, match.difficulty, seed);
  if (!move) return null;
  try {
    const { state: next } = applyMove(match.state, move);
    return commitMove(match, move, next);
  } catch {
    return null;
  }
}

/** Desistência do humano → o adversário vence (`null` se o jogo já terminou). */
export function applyResign(match: MatchSnapshot): MatchSnapshot | null {
  if (isGameOver(match.state)) return null;
  const winner: PlayerId = match.humanSide === 'P1' ? 'P2' : 'P1';
  const next: GameState = {
    ...match.state,
    status: winner === 'P1' ? 'WIN_P1' : 'WIN_P2',
    winner,
    winningLine: null,
  };
  return { ...match, state: next, winner };
}

/**
 * Nº de plies a anular no undo:
 * Treino Livre = 1 (controlo total); PvE = 2 (humano + IA) quando há
 * histórico suficiente; PvP = 1.
 */
export function undoSteps(mode: GameMode, historyLength: number): number {
  if (historyLength < 2) return 0;
  if (mode === 'practice') return 1;
  if (mode === 'pve' && historyLength >= 3) return 2;
  return 1;
}

/** Anula jogadas do histórico; devolve `null` se não houver o que anular. */
export function applyUndo(match: MatchSnapshot): MatchSnapshot | null {
  const steps = undoSteps(match.mode, match.stateHistory.length);
  if (steps <= 0) return null;
  const history = match.stateHistory.slice(0, match.stateHistory.length - steps);
  const restored = history[history.length - 1];
  if (!restored) return null;
  return {
    ...match,
    state: restored,
    stateHistory: history,
    selectedSquare: null,
    validTargets: [],
    lastMove: restored.history.length > 0 ? restored.history[restored.history.length - 1] : null,
    winner: restored.winner,
    winningLine: restored.winningLine,
    moveCount: restored.moveCount,
  };
}
