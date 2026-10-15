import { describe, expect, it } from 'vitest';
import {
  coinsForOutcome,
  eloChangeForOutcome,
  eloDelta,
  expectedScore,
  levelFromXp,
  nextElo,
  xpForOutcome,
} from './elo';

describe('expectedScore', () => {
  it('é 0.5 entre ratings iguais', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
  });

  it('favorece o rating mais alto', () => {
    expect(expectedScore(1400, 1000)).toBeGreaterThan(0.9);
    expect(expectedScore(1000, 1400)).toBeLessThan(0.1);
  });

  it('é simétrico: e(a,b) + e(b,a) = 1', () => {
    expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(1, 10);
  });
});

describe('eloDelta', () => {
  it('dá ±16 entre iguais (k=32)', () => {
    expect(eloDelta(1000, 1000, 1)).toBe(16);
    expect(eloDelta(1000, 1000, 0)).toBe(-16);
    expect(eloDelta(1000, 1000, 0.5)).toBe(0);
  });

  it('o favorito ganha menos e o azarão ganha mais', () => {
    expect(eloDelta(1400, 1000, 1)).toBeLessThan(16);
    expect(eloDelta(1000, 1400, 1)).toBeGreaterThan(16);
  });
});

describe('nextElo', () => {
  it('aplica o delta', () => {
    expect(nextElo(1000, 16)).toBe(1016);
    expect(nextElo(1000, -16)).toBe(984);
  });

  it('nunca desce abaixo de 100', () => {
    expect(nextElo(105, -50)).toBe(100);
  });
});

describe('levelFromXp', () => {
  it('segue 1 + floor(xp/100)', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(250)).toBe(3);
  });
});

describe('recompensas por resultado', () => {
  it('XP', () => {
    expect(xpForOutcome('P1')).toEqual({ p1: 40, p2: 10 });
    expect(xpForOutcome('P2')).toEqual({ p1: 10, p2: 40 });
    expect(xpForOutcome('draw')).toEqual({ p1: 15, p2: 15 });
  });

  it('moedas', () => {
    expect(coinsForOutcome('P1', 100)).toEqual({ p1: 100, p2: 0 });
    expect(coinsForOutcome('P2', 50)).toEqual({ p1: 0, p2: 50 });
    expect(coinsForOutcome('draw', 100)).toEqual({ p1: 0, p2: 0 });
  });
});

describe('eloChangeForOutcome', () => {
  it('é zero-sum', () => {
    const c = eloChangeForOutcome(1200, 900, 'P2');
    expect(c.p1).toBe(-c.p2);
  });

  it('empate entre iguais não altera Elo', () => {
    expect(eloChangeForOutcome(1000, 1000, 'draw')).toEqual({ p1: 0, p2: 0 });
  });
});
