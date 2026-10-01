/**
 * Store de navegação da app — como só há uma rota `/`,
 * a navegação entre ecrãs faz-se por estado.
 */
import { create } from 'zustand';

export type Screen =
  | 'splash'
  | 'welcome'
  | 'home'
  | 'offline-select'
  | 'game'
  | 'tutorial'
  | 'how-to-play'
  | 'about'
  | 'profile'
  | 'rankings'
  | 'settings'
  | 'rooms'
  | 'wallet'
  | 'replay'
  | 'achievements'
  | 'challenge'
  | 'stats'
  | 'share'
  | 'import-match'
  | 'practice'
  | 'lightning'
  | 'watch';

interface AppState {
  screen: Screen;
  history: Screen[];
  /** Dados para o ecrã de replay (partida selecionada do histórico) */
  replayMatchId: string | null;
  /** Código de partida partilhada para importar */
  shareCode: string | null;

  navigate: (screen: Screen) => void;
  back: () => void;
  canGoBack: () => boolean;
  setReplayMatchId: (id: string | null) => void;
  setShareCode: (code: string | null) => void;
}

export const useApp = create<AppState>((set, get) => ({
  screen: 'splash',
  history: [],
  replayMatchId: null,
  shareCode: null,

  navigate: (screen) =>
    set((s) => ({
      screen,
      history: [...s.history, s.screen],
    })),

  back: () => {
    const { history } = get();
    if (history.length === 0) {
      set({ screen: 'home' });
      return;
    }
    const prev = history[history.length - 1];
    set({
      screen: prev,
      history: history.slice(0, -1),
    });
  },

  canGoBack: () => get().history.length > 0,

  setReplayMatchId: (id) => set({ replayMatchId: id }),
  setShareCode: (code) => set({ shareCode: code }),
}));
