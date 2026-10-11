/**
 * Store de jogo — gere a partida atual (offline).
 * Usa o motor puro (@tira/engine) e a IA (@tira/ai) através de funções
 * puras em @/game/matchLogic — as regras vivem SÓ no motor.
 * Persistido em AsyncStorage (`tira:game`).
 *
 * Port do protótipo web (`src/store/game.ts`) com os modos live:
 * pvp (local, 2 humanos), pve (vs IA) e practice (Treino Livre).
 * O agendamento da jogada da IA vive no hook @/game/useGame.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createGame, isGameOver, type GameState, type Square } from '@tira/engine';
import { createAsyncStorage } from '@/lib/storage';
import {
  aiSeed,
  applyAiMove,
  applyHumanMove,
  applyResign,
  applyUndo,
  createMatch,
  isAiTurn,
  selectableTargets,
  type GameMode,
  type MatchSnapshot,
  type StartGameOptions,
} from '@/game/matchLogic';
import { useProfile, type MatchRecord } from './profile';

export type { GameMode, StartGameOptions };

export interface GameStore extends MatchSnapshot {
  isAiThinking: boolean;
  /** Momento (ms) em que a partida começou — para a duração no histórico */
  startTime: number;

  startGame: (opts: StartGameOptions) => void;
  selectSquare: (sq: Square) => void;
  attemptMove: (to: Square) => void;
  resign: () => void;
  restart: () => void;
  undo: () => void;
  toggleThreats: () => void;
  aiMove: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
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
      currentThreats: [],
      showThreats: false,

      startGame: (opts) => {
        const match = createMatch(opts);
        set({ ...match, isAiThinking: false, startTime: Date.now() });
      },

      selectSquare: (sq) => {
        const targets = selectableTargets(get(), sq);
        if (targets === null) return;
        set({ selectedSquare: sq, validTargets: targets });
      },

      attemptMove: (to) => {
        const next = applyHumanMove(get(), to);
        if (!next) return;
        set({ ...next });
        if (isGameOver(next.state)) {
          recordCurrentMatch(get(), next.state);
        }
      },

      aiMove: () => {
        const current = get();
        const next = isAiTurn(current)
          ? applyAiMove(current, aiSeed(Date.now(), current.state.moveCount))
          : null;
        if (next) {
          set({ ...next, isAiThinking: false });
          if (isGameOver(next.state)) {
            recordCurrentMatch(get(), next.state);
          }
          return;
        }
        if (current.isAiThinking) set({ isAiThinking: false });
      },

      resign: () => {
        const next = applyResign(get());
        if (!next) return;
        set({ ...next, isAiThinking: false });
        recordCurrentMatch(get(), next.state, 'RESIGN');
      },

      restart: () => {
        const { mode, difficulty, humanSide, showThreats, timePerTurn } = get();
        get().startGame({ mode, difficulty, humanSide, showThreats, timePerTurn });
      },

      undo: () => {
        const next = applyUndo(get());
        if (!next) return;
        set({ ...next, isAiThinking: false });
      },

      toggleThreats: () => set((s) => ({ showThreats: !s.showThreats })),
    }),
    {
      name: 'tira:game',
      storage: createAsyncStorage<GameStore>(),
    },
  ),
);

/** Regista a partida no perfil. */
function recordCurrentMatch(
  store: GameStore,
  finalState: GameState,
  reason?: MatchRecord['reason'],
): void {
  const { mode, difficulty, humanSide, startTime } = store;
  // Modo Treino Livre: não regista no perfil nem afeta estatísticas
  if (mode === 'practice') return;
  const profile = useProfile.getState();
  const opponent =
    mode === 'pve'
      ? `IA ${difficulty === 'easy' ? 'Fácil' : difficulty === 'medium' ? 'Média' : difficulty === 'hard' ? 'Difícil' : 'Perfeita'}`
      : 'Jogador 2';
  profile.recordMatch({
    mode,
    difficulty,
    result: finalState.winner ?? 'DRAW',
    playerSide: humanSide,
    opponent,
    moves: [...finalState.history],
    moveCount: finalState.moveCount,
    durationSec: Math.round((Date.now() - startTime) / 1000),
    reason: reason ?? (finalState.status === 'DRAW' ? 'REPETITION' : 'LINE'),
  });
}
