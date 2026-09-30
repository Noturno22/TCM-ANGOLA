/**
 * Store de jogo — gere a partida atual (offline).
 * Usa o motor puro (@/lib/engine) e a IA (@/lib/ai).
 */
import { create } from 'zustand';
import {
  applyMove,
  createGame,
  getLegalMoves,
  getThreats,
  getWinningMoves,
  isGameOver,
  positionKey,
  type GameState,
  type Move,
  type PlayerId,
  type Square,
} from '@/lib/engine';
import { chooseMove, type Difficulty } from '@/lib/ai';
import { useProfile, type MatchRecord } from './profile';
import { playSound } from '@/lib/sound';

export type GameMode = 'pvp' | 'pve' | 'cvc';

interface GameStore {
  state: GameState;
  mode: GameMode;
  difficulty: Difficulty;
  humanSide: PlayerId; // em pve, que lado o humano controla
  /** Tempo por turno em segundos (45 = normal, 15 = rápido, 0 = sem relógio) */
  timePerTurn: number;
  selectedSquare: Square | null;
  validTargets: Square[];
  lastMove: Move | null;
  winner: PlayerId | null;
  winningLine: readonly number[] | null;
  isAiThinking: boolean;
  startTime: number;
  moveCount: number;
  /** Histórico de estados para replay/undo dentro da partida */
  stateHistory: GameState[];
  /** Ameaças ativas do adversário (para modo tutorial) */
  currentThreats: ReturnType<typeof getThreats>;
  showThreats: boolean;

  startGame: (opts: {
    mode: GameMode;
    difficulty?: Difficulty;
    humanSide?: PlayerId;
    showThreats?: boolean;
    timePerTurn?: number;
  }) => void;
  selectSquare: (sq: Square) => void;
  attemptMove: (to: Square) => void;
  resign: () => void;
  restart: () => void;
  undo: () => void;
  toggleThreats: () => void;
  aiMove: () => void;
}

const emptyThreats: ReturnType<typeof getThreats> = [];

export const useGame = create<GameStore>((set, get) => ({
  state: createGame(),
  mode: 'pve',
  difficulty: 'medium',
  humanSide: 'P1',
  timePerTurn: 45,
  selectedSquare: null,
  validTargets: [],
  lastMove: null,
  winner: null,
  winningLine: null,
  isAiThinking: false,
  startTime: 0,
  moveCount: 0,
  stateHistory: [],
  currentThreats: emptyThreats,
  showThreats: false,

  startGame: ({ mode, difficulty = 'medium', humanSide = 'P1', showThreats = false, timePerTurn = 45 }) => {
    const state = createGame();
    set({
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
      isAiThinking: false,
      startTime: Date.now(),
      moveCount: 0,
      stateHistory: [state],
      currentThreats: getThreats(state, state.currentPlayer === 'P1' ? 'P2' : 'P1'),
      showThreats,
    });
    playSound('start');
    // Se a IA joga primeiro (cvc, ou pve com humanSide=P2)
    if (mode === 'cvc' || (mode === 'pve' && humanSide === 'P2')) {
      setTimeout(() => get().aiMove(), 500);
    }
  },

  selectSquare: (sq) => {
    const { state, mode, humanSide } = get();
    // Só permite selecionar em modo humano
    if (mode === 'cvc') return;
    if (mode === 'pve' && state.currentPlayer !== humanSide) return;
    if (isGameOver(state)) return;
    const piece = state.board[sq - 1];
    if (piece !== state.currentPlayer) return;
    const legalMoves = getLegalMoves(state, state.currentPlayer);
    const targets = legalMoves
      .filter((m) => m.from === sq)
      .map((m) => m.to);
    set({ selectedSquare: sq, validTargets: targets });
    playSound('select');
  },

  attemptMove: (to) => {
    const { state, selectedSquare, mode, humanSide } = get();
    if (!selectedSquare) return;
    if (mode === 'cvc') return;
    if (mode === 'pve' && state.currentPlayer !== humanSide) return;
    if (isGameOver(state)) return;
    const move: Move = { from: selectedSquare, to };
    try {
      const { state: newState } = applyMove(state, move);
      const threats = newState.winner
        ? emptyThreats
        : getThreats(newState, newState.currentPlayer === 'P1' ? 'P2' : 'P1');
      set({
        state: newState,
        selectedSquare: null,
        validTargets: [],
        lastMove: move,
        moveCount: newState.moveCount,
        winner: newState.winner,
        winningLine: newState.winningLine,
        stateHistory: [...get().stateHistory, newState],
        currentThreats: threats,
      });
      playSound('move');
      // Sons de fim de jogo / ameaça
      if (isGameOver(newState)) {
        if (newState.winner) playSound('win');
        else playSound('draw');
        recordCurrentMatch(get(), newState);
      } else if (threats.length > 0) {
        playSound('threat');
      }
      // Se o jogo continua e é a vez da IA
      if (!isGameOver(newState)) {
        if (mode === 'pve' && newState.currentPlayer !== humanSide) {
          set({ isAiThinking: true });
          setTimeout(() => get().aiMove(), 500 + Math.random() * 400);
        } else if (mode === 'cvc') {
          setTimeout(() => get().aiMove(), 400);
        }
      }
    } catch (e) {
      playSound('error');
      console.warn('Movimento inválido:', e);
    }
  },

  aiMove: () => {
    const { state, mode, difficulty, humanSide } = get();
    if (isGameOver(state)) {
      set({ isAiThinking: false });
      return;
    }
    // Determinar se é a vez da IA
    const aiTurn =
      mode === 'cvc' ||
      (mode === 'pve' && state.currentPlayer !== humanSide);
    if (!aiTurn) {
      set({ isAiThinking: false });
      return;
    }
    const seed = (Date.now() + state.moveCount * 7919) | 0;
    const move = chooseMove(state, difficulty, seed);
    if (!move) {
      set({ isAiThinking: false });
      return;
    }
    const { state: newState } = applyMove(state, move);
    const threats = newState.winner
      ? emptyThreats
      : getThreats(newState, newState.currentPlayer === 'P1' ? 'P2' : 'P1');
    set({
      state: newState,
      selectedSquare: null,
      validTargets: [],
      lastMove: move,
      moveCount: newState.moveCount,
      winner: newState.winner,
      winningLine: newState.winningLine,
      isAiThinking: false,
      stateHistory: [...get().stateHistory, newState],
      currentThreats: threats,
    });
    playSound('move');
    if (isGameOver(newState)) {
      if (newState.winner) playSound('win');
      else playSound('draw');
      recordCurrentMatch(get(), newState);
    } else if (threats.length > 0) {
      playSound('threat');
    }
    if (!isGameOver(newState)) {
      if (mode === 'cvc') {
        setTimeout(() => get().aiMove(), 500);
      } else if (mode === 'pve' && newState.currentPlayer !== humanSide) {
        set({ isAiThinking: true });
        setTimeout(() => get().aiMove(), 500 + Math.random() * 400);
      }
    }
  },

  resign: () => {
    const { state, mode, humanSide } = get();
    if (isGameOver(state)) return;
    // O humano desiste → adversário ganha
    const winner: PlayerId = humanSide === 'P1' ? 'P2' : 'P1';
    const newState: GameState = {
      ...state,
      status: winner === 'P1' ? 'WIN_P1' : 'WIN_P2',
      winner,
      winningLine: null,
    };
    set({ state: newState, winner, isAiThinking: false });
    recordCurrentMatch(get(), newState, 'RESIGN');
  },

  restart: () => {
    const { mode, difficulty, humanSide, showThreats, timePerTurn } = get();
    get().startGame({ mode, difficulty, humanSide, showThreats, timePerTurn });
  },

  undo: () => {
    const { stateHistory, mode } = get();
    // Undo só em pvp ou pve (desfaz 2 plies: humano + IA)
    if (mode === 'cvc') return;
    if (stateHistory.length < 2) return;
    const steps = mode === 'pve' && stateHistory.length >= 3 ? 2 : 1;
    const newHistory = stateHistory.slice(0, stateHistory.length - steps);
    const restored = newHistory[newHistory.length - 1];
    set({
      state: restored,
      stateHistory: newHistory,
      selectedSquare: null,
      validTargets: [],
      lastMove: restored.history.length > 0 ? restored.history[restored.history.length - 1] : null,
      winner: restored.winner,
      winningLine: restored.winningLine,
      isAiThinking: false,
      moveCount: restored.moveCount,
    });
  },

  toggleThreats: () => set((s) => ({ showThreats: !s.showThreats })),
}));

/** Regista a partida no perfil. */
function recordCurrentMatch(
  store: GameStore,
  finalState: GameState,
  reason?: MatchRecord['reason'],
) {
  const { mode, difficulty, humanSide, startTime } = store;
  const profile = useProfile.getState();
  const opponent =
    mode === 'pve'
      ? `IA ${difficulty === 'easy' ? 'Fácil' : difficulty === 'medium' ? 'Média' : difficulty === 'hard' ? 'Difícil' : 'Perfeita'}`
      : mode === 'cvc'
        ? `IA vs IA`
        : 'Jogador 2';
  profile.recordMatch({
    mode,
    difficulty,
    result: finalState.winner ?? 'DRAW',
    playerSide: mode === 'cvc' ? undefined : humanSide,
    opponent,
    moves: [...finalState.history],
    moveCount: finalState.moveCount,
    durationSec: Math.round((Date.now() - startTime) / 1000),
    reason: reason ?? (finalState.status === 'DRAW' ? 'REPETITION' : 'LINE'),
  });
}
