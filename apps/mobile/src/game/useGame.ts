/**
 * useGame — driver da partida offline para React/Expo.
 *
 * Liga o store persistido (@/store/game) ao React e agenda as respostas
 * da IA (@tira/ai) quando chega a vez dela — incluindo quando a IA começa
 * a partida (pve/treino com humanSide 'P2'). Toda a lógica de fluxo pura
 * vive em ./matchLogic (sem React/RN); este ficheiro só faz o wiring.
 *
 * Modos: pvp (dois humanos no mesmo dispositivo) e pve/practice (humano
 * vs IA com dificuldade selecionável). Estritamente offline — sem Supabase
 * ou qualquer rede.
 */
import { useEffect } from 'react';
import { isAiTurn, type GameMode, type StartGameOptions } from './matchLogic';
import { useGameStore, type GameStore } from '@/store/game';

export type { GameMode, StartGameOptions };
export type { GameStore };

/**
 * Agenda a jogada da IA com um breve atraso humano (500–900 ms).
 * Limpa o timeout e liberta `isAiThinking` se a partida mudar/terminar
 * antes de a IA jogar (restart, resign, desmontagem, StrictMode).
 */
function useAiScheduler(match: GameStore): void {
  const { state, mode, humanSide } = match;

  useEffect(() => {
    const current = useGameStore.getState();
    if (current.isAiThinking || !isAiTurn(current)) return;
    useGameStore.setState({ isAiThinking: true });
    const timer = setTimeout(() => {
      useGameStore.getState().aiMove();
    }, 500 + Math.random() * 400);
    return () => {
      clearTimeout(timer);
      if (useGameStore.getState().isAiThinking) {
        useGameStore.setState({ isAiThinking: false });
      }
    };
  }, [state, mode, humanSide]);
}

/**
 * Estado + ações da partida atual (mesma superfície do store da web):
 * `state`, `mode`, `difficulty`, `humanSide`, `timePerTurn`,
 * `selectedSquare`, `validTargets`, `lastMove`, `winner`, `winningLine`,
 * `isAiThinking`, `startTime`, `moveCount`, `stateHistory`,
 * `currentThreats`, `showThreats` + ações (`startGame`, `selectSquare`,
 * `attemptMove`, `resign`, `restart`, `undo`, `toggleThreats`, `aiMove`).
 *
 * Sem parâmetros — subscreve o store completo (paridade com a web).
 */
export function useGame(): GameStore {
  const store = useGameStore();
  useAiScheduler(store);
  return store;
}
