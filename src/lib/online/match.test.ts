import { describe, expect, it } from 'vitest';
import {
  mapMatchRow,
  matchToGameState,
  normalizeBoard,
  parseErrorCode,
  potForStake,
  sideForUser,
  timeLeftSeconds,
  toCells,
  type OnlineMatch,
} from './match';

const row: Record<string, unknown> = {
  id: 'm1',
  room_id: 'luanda',
  stake: 100,
  status: 'active',
  p1_id: 'u1',
  p2_id: 'u2',
  turn: 'P1',
  board: [1, 1, 1, 0, 0, 0, -1, -1, -1],
  move_count: 0,
  winner: null,
  win_line: null,
  time_per_turn: 45,
  turn_started_at: '2026-10-15T10:00:00.000Z',
  settled: false,
  created_at: '2026-10-15T10:00:00.000Z',
  updated_at: '2026-10-15T10:00:00.000Z',
};

describe('normalizeBoard', () => {
  it('aceita array de números', () => {
    expect(normalizeBoard([1, 0, -1])).toEqual([1, 0, -1]);
  });
  it('aceita a string do Postgres', () => {
    expect(normalizeBoard('{1,1,1,0,0,0,-1,-1,-1}')).toEqual([
      1, 1, 1, 0, 0, 0, -1, -1, -1,
    ]);
  });
  it('devolve [] para entrada inválida', () => {
    expect(normalizeBoard(null)).toEqual([]);
    expect(normalizeBoard(42)).toEqual([]);
  });
});

describe('toCells', () => {
  it('mapeia 1→P1, -1→P2, 0→null', () => {
    expect(toCells([1, 0, -1, 0, 0, 0, 0, 0, 0])).toEqual([
      'P1',
      null,
      'P2',
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
  it('preenche com null até 9', () => {
    expect(toCells([1])).toHaveLength(9);
  });
});

describe('mapMatchRow', () => {
  it('converte a linha para OnlineMatch', () => {
    const m = mapMatchRow(row);
    expect(m.id).toBe('m1');
    expect(m.roomId).toBe('luanda');
    expect(m.stake).toBe(100);
    expect(m.turn).toBe('P1');
    expect(m.board).toEqual([1, 1, 1, 0, 0, 0, -1, -1, -1]);
    expect(m.winner).toBeNull();
    expect(m.winLine).toBeNull();
  });
});

describe('matchToGameState', () => {
  const base = mapMatchRow(row);

  it('estado ativo reflete o turno', () => {
    const s = matchToGameState(base);
    expect(s.status).toBe('PLAYER_1_TURN');
    expect(s.currentPlayer).toBe('P1');
    expect(s.winner).toBeNull();
  });

  it('vitória de P1', () => {
    const s = matchToGameState({ ...base, status: 'finished', winner: 'P1', winLine: [1, 5, 9] });
    expect(s.status).toBe('WIN_P1');
    expect(s.winner).toBe('P1');
    expect(s.winningLine).toEqual([1, 5, 9]);
  });

  it('empate', () => {
    const s = matchToGameState({ ...base, status: 'finished', winner: 'draw' });
    expect(s.status).toBe('DRAW');
    expect(s.winner).toBeNull();
  });
});

describe('sideForUser', () => {
  const m = mapMatchRow(row);
  it('identifica o lado', () => {
    expect(sideForUser(m, 'u1')).toBe('P1');
    expect(sideForUser(m, 'u2')).toBe('P2');
    expect(sideForUser(m, 'x')).toBeNull();
    expect(sideForUser(m, null)).toBeNull();
  });
});

describe('timeLeftSeconds', () => {
  const m = mapMatchRow(row) as OnlineMatch;
  const start = Date.parse('2026-10-15T10:00:00.000Z');

  it('conta o tempo restante', () => {
    expect(timeLeftSeconds(m, start)).toBe(45);
    expect(timeLeftSeconds(m, start + 10_000)).toBe(35);
  });
  it('nunca é negativo', () => {
    expect(timeLeftSeconds(m, start + 90_000)).toBe(0);
  });
  it('0 = sem limite de tempo', () => {
    expect(timeLeftSeconds({ ...m, timePerTurn: 0 }, start)).toBe(0);
  });
});

describe('parseErrorCode', () => {
  it('reconhece códigos conhecidos', () => {
    expect(parseErrorCode('not_your_turn')).toBe('not_your_turn');
    expect(parseErrorCode('ERROR: path_blocked (SQLSTATE 22023)')).toBe('path_blocked');
  });
  it('reconhece os códigos das apostas', () => {
    expect(parseErrorCode('not_enough_coins')).toBe('not_enough_coins');
    expect(parseErrorCode('unknown_room')).toBe('unknown_room');
  });
  it('devolve null para desconhecidos', () => {
    expect(parseErrorCode('boom')).toBeNull();
    expect(parseErrorCode(null)).toBeNull();
  });
});

describe('potForStake', () => {
  it('duplica a aposta (pot = 2×stake)', () => {
    expect(potForStake(100)).toBe(200);
    expect(potForStake(25)).toBe(50);
  });
  it('0 sem aposta', () => {
    expect(potForStake(0)).toBe(0);
    expect(potForStake(-5)).toBe(0);
  });
});
