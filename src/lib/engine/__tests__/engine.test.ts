import { describe, it, expect } from 'vitest';
import {
  applyMove,
  createGame,
  getLegalMoves,
  getThreats,
  getWinningMoves,
  isGameOver,
  positionKey,
  replayFrom,
  serialize,
  deserialize,
  validateMove,
  WINNING_LINES,
  DEFAULT_CONFIG,
  type Square,
  type Move,
} from '@/lib/engine';

describe('Motor — Inicialização', () => {
  it('posição inicial: P1={1,2,3}, P2={7,8,9}, vazias={4,5,6}', () => {
    const g = createGame();
    expect(g.board[0]).toBe('P1');
    expect(g.board[1]).toBe('P1');
    expect(g.board[2]).toBe('P1');
    expect(g.board[3]).toBeNull();
    expect(g.board[4]).toBeNull();
    expect(g.board[5]).toBeNull();
    expect(g.board[6]).toBe('P2');
    expect(g.board[7]).toBe('P2');
    expect(g.board[8]).toBe('P2');
    expect(g.currentPlayer).toBe('P1');
    expect(g.status).toBe('PLAYER_1_TURN');
    expect(g.winner).toBeNull();
    expect(g.moveCount).toBe(0);
    expect(g.history).toHaveLength(0);
  });

  it('posição inicial NÃO é vitória para ninguém (D2)', () => {
    const g = createGame();
    expect(g.winner).toBeNull();
    expect(g.status).toBe('PLAYER_1_TURN');
  });
});

describe('Motor — Armadilha D2 (CRÍTICA)', () => {
  it('após a 1ª jogada de P1, o jogo continua (P2 NÃO ganha por 7-8-9)', () => {
    const g = createGame();
    const { state } = applyMove(g, { from: 1, to: 4 });
    expect(state.status).toBe('PLAYER_2_TURN');
    expect(state.winner).toBeNull();
    expect(state.currentPlayer).toBe('P2');
  });

  it('P1 pode sair da linha de casa e voltar para ganhar', () => {
    const g = createGame();
    let { state } = applyMove(g, { from: 1, to: 4 });
    expect(state.winner).toBeNull();
    state = applyMove(state, { from: 9, to: 6 }).state;
    expect(state.currentPlayer).toBe('P1');
    state = applyMove(state, { from: 4, to: 1 }).state;
    expect(state.status).toBe('WIN_P1');
    expect(state.winner).toBe('P1');
    expect(state.winningLine).toEqual([1, 2, 3]);
  });
});

describe('Motor — Validação de movimentos', () => {
  it('destino ocupado → DESTINATION_OCCUPIED', () => {
    const g = createGame();
    const r = validateMove(g, { from: 1, to: 7 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DESTINATION_OCCUPIED');
  });

  it('mesma casa → SAME_SQUARE', () => {
    const g = createGame();
    const r = validateMove(g, { from: 1, to: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('SAME_SQUARE');
  });

  it('peça do adversário → NOT_YOUR_PIECE', () => {
    const g = createGame();
    const r = validateMove(g, { from: 7, to: 4 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NOT_YOUR_PIECE');
  });

  it('fora do turno → NOT_YOUR_TURN', () => {
    const g = createGame();
    const r = validateMove(g, { from: 7, to: 4 }, 'P2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NOT_YOUR_TURN');
  });

  it('caminho bloqueado colinear 1→3 (2 ocupada, 3 vazia) → PATH_BLOCKED', () => {
    // Construir: P1 tem peça em 1 e 2, casa 3 vazia. 1→3 bloqueado por 2.
    const g = createGame();
    let s = applyMove(g, { from: 3, to: 6 }).state; // P1: 3→6 (liberta casa 3)
    s = applyMove(s, { from: 9, to: 4 }).state; // P2: 9→4 (qualquer)
    // Agora P1 pode tentar 1→3: 3 está vazia, mas 2 (intermédio) tem P1. BLOCKED.
    const r = validateMove(s, { from: 1, to: 3 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PATH_BLOCKED');
  });

  it('caminho bloqueado colinear 1→9 (5 ocupada) → PATH_BLOCKED', () => {
    const g = createGame();
    let s = applyMove(g, { from: 1, to: 4 }).state;
    s = applyMove(s, { from: 9, to: 6 }).state;
    s = applyMove(s, { from: 2, to: 5 }).state; // P1 em 5
    const r = validateMove(s, { from: 8, to: 2 }); // 8→2 passa por 5 (ocupada)
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PATH_BLOCKED');
  });

  it('movimento não-colinear permitido: 1→6', () => {
    const g = createGame();
    const r = validateMove(g, { from: 1, to: 6 });
    expect(r.ok).toBe(true);
  });

  it('movimento não-colinear permitido: 2→4', () => {
    const g = createGame();
    const r = validateMove(g, { from: 2, to: 4 });
    expect(r.ok).toBe(true);
  });

  it('movimento não-colinear permitido: 3→4', () => {
    const g = createGame();
    // 3=(2,0), 4=(0,1): dx=-2, dy=1 → não colinear. 4 vazia.
    const r = validateMove(g, { from: 3, to: 4 });
    expect(r.ok).toBe(true);
  });
});

describe('Motor — Turnos e fim de jogo', () => {
  it('turnos alternam P1 → P2 → P1 → P2', () => {
    const g = createGame();
    let s = g;
    expect(s.currentPlayer).toBe('P1');
    s = applyMove(s, { from: 1, to: 4 }).state;
    expect(s.currentPlayer).toBe('P2');
    s = applyMove(s, { from: 9, to: 6 }).state;
    expect(s.currentPlayer).toBe('P1');
    s = applyMove(s, { from: 2, to: 5 }).state;
    expect(s.currentPlayer).toBe('P2');
  });

  it('nenhum movimento após vitória', () => {
    const g = createGame();
    let s = applyMove(g, { from: 1, to: 4 }).state;
    s = applyMove(s, { from: 9, to: 6 }).state;
    s = applyMove(s, { from: 4, to: 1 }).state;
    expect(s.winner).toBe('P1');
    expect(() => applyMove(s, { from: 9, to: 4 })).toThrow();
  });
});

describe('Motor — Empate por repetição (D3)', () => {
  it('maxPlies atingido → DRAW', () => {
    // Configurar com maxPlies=2: após 2 jogadas, empate.
    const g = createGame({ maxPlies: 2 });
    let s = applyMove(g, { from: 1, to: 4 }).state;
    expect(s.status).not.toBe('DRAW'); // ainda não
    s = applyMove(s, { from: 9, to: 6 }).state;
    expect(s.status).toBe('DRAW');
    expect(s.winner).toBeNull();
  });

  it('positionKey distingue posições por jogador atual', () => {
    const g = createGame();
    const keyP1 = positionKey(g); // P1 a jogar
    // Simular estado com P2 a jogar (mesmo tabuleiro)
    const stateP2 = { ...g, currentPlayer: 'P2' as const };
    const keyP2 = positionKey(stateP2);
    expect(keyP1).not.toBe(keyP2);
  });

  it('positionCounts incrementa após cada jogada', () => {
    const g = createGame();
    const initialCount = Object.keys(g.positionCounts).length;
    let s = applyMove(g, { from: 1, to: 4 }).state;
    expect(Object.keys(s.positionCounts).length).toBe(initialCount + 1);
    s = applyMove(s, { from: 9, to: 6 }).state;
    expect(Object.keys(s.positionCounts).length).toBe(initialCount + 2);
  });
});

describe('Motor — Imutabilidade e serialização', () => {
  it('applyMove não muta o estado original', () => {
    const g = createGame();
    const originalBoard = [...g.board];
    const originalHistory = [...g.history];
    applyMove(g, { from: 1, to: 4 });
    expect([...g.board]).toEqual(originalBoard);
    expect([...g.history]).toEqual(originalHistory);
  });

  it('serialize/deserialize é idempotente', () => {
    const g = createGame();
    let s = applyMove(g, { from: 1, to: 4 }).state;
    s = applyMove(s, { from: 9, to: 6 }).state;
    const str = serialize(s);
    const restored = deserialize(str);
    expect(restored.board).toEqual(s.board);
    expect(restored.currentPlayer).toBe(s.currentPlayer);
    expect(restored.status).toBe(s.status);
    expect(restored.history).toEqual(s.history);
    expect(serialize(restored)).toBe(str);
  });
});

describe('Motor — getLegalMoves e validateMove', () => {
  it('todos os movimentos legais validam ok', () => {
    const g = createGame();
    let s = applyMove(g, { from: 1, to: 4 }).state;
    s = applyMove(s, { from: 9, to: 6 }).state;
    const legal = getLegalMoves(s);
    expect(legal.length).toBeGreaterThan(0);
    for (const mv of legal) {
      const r = validateMove(s, mv);
      expect(r.ok).toBe(true);
    }
  });

  it('movimentos ilegais não estão em getLegalMoves', () => {
    const g = createGame();
    const legal = getLegalMoves(g);
    expect(legal.find((m) => m.from === 1 && m.to === 7)).toBeUndefined();
    expect(legal.find((m) => m.from === 1 && m.to === 3)).toBeUndefined();
  });
});

describe('Motor — replay', () => {
  it('replayFrom reproduz a sequência de estados', () => {
    const moves: Move[] = [
      { from: 1, to: 4 },
      { from: 9, to: 6 },
      { from: 4, to: 1 },
    ];
    const states = replayFrom(moves);
    expect(states).toHaveLength(4);
    expect(states[0].moveCount).toBe(0);
    expect(states[3].status).toBe('WIN_P1');
  });
});

describe('Motor — getWinningMoves e getThreats', () => {
  it('deteta vitória imediata disponível', () => {
    const g = createGame();
    let s = applyMove(g, { from: 1, to: 4 }).state;
    s = applyMove(s, { from: 9, to: 6 }).state;
    const wins = getWinningMoves(s, 'P1');
    expect(wins.length).toBeGreaterThan(0);
    expect(wins.some((m) => m.from === 4 && m.to === 1)).toBe(true);
  });

  it('getThreats retorna array', () => {
    const g = createGame();
    const threats = getThreats(g, 'P2');
    expect(Array.isArray(threats)).toBe(true);
  });
});

describe('Motor — Linhas vencedoras', () => {
  it('existem 8 linhas vencedoras', () => {
    expect(WINNING_LINES).toHaveLength(8);
  });
});
