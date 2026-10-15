import { describe, expect, it } from 'vitest';
import {
  advanceMatch,
  createTournament,
  getEntrant,
  getFirstHumanMatchId,
  getHumanMatchIds,
  type TournamentBracket,
} from './tournament';

describe('createTournament', () => {
  it('cria uma chave de 8 jogadores e 7 partidas', () => {
    const br = createTournament();
    expect(br.entrants).toHaveLength(8);
    expect(br.matchOrder).toHaveLength(7);
    expect(Object.keys(br.matches)).toHaveLength(7);
    expect(br.status).toBe('open');
    expect(br.entrants.filter((e) => e.isHuman)).toHaveLength(1);
  });

  it('começa com as quartas-de-final preenchidas', () => {
    const br = createTournament();
    for (const id of ['r1-1', 'r1-2', 'r1-3', 'r1-4']) {
      expect(br.matches[id].p1Id).toBeTruthy();
      expect(br.matches[id].p2Id).toBeTruthy();
    }
    expect(br.matches['r2-f'].p1Id).toBeNull();
    expect(br.matches.r3.p1Id).toBeNull();
  });

  it('inclui sempre o humano na primeira partida', () => {
    const br = createTournament();
    const press = br.matchOrder.filter(
      (id) => br.matches[id].p1Id === 'human' || br.matches[id].p2Id === 'human',
    );
    expect(press.length).toBeGreaterThanOrEqual(1);
    expect(press.some((id) => br.matches[id].round === 1)).toBe(true);
  });
});

describe('getHumanMatchIds / getFirstHumanMatchId', () => {
  it('devolve a partida pendente do humano', () => {
    const br = createTournament();
    const id = getFirstHumanMatchId(br);
    const m = br.matches[id!];
    expect(m.p1Id === 'human' || m.p2Id === 'human').toBe(true);
    expect(m.winnerId).toBeNull();
  });

  it('deixa de listar a partida após ser decidida', () => {
    const br = createTournament();
    const id = getFirstHumanMatchId(br)!;
    const next = advanceMatch(br, id, 'human');
    expect(getHumanMatchIds(next)).not.toContain(id);
  });
});

describe('advanceMatch', () => {
  it('regista o vencedor e propaga para a ronda seguinte', () => {
    const br = createTournament();
    const humanMatch = getFirstHumanMatchId(br)!;
    const next = advanceMatch(br, humanMatch, 'human');
    expect(next.matches[humanMatch].winnerId).toBe('human');
    const target = next.matches[humanMatch].nextMatchId!;
    const slot = next.matches[humanMatch].nextSlot!;
    const propagated = slot === 'top' ? next.matches[target].p1Id : next.matches[target].p2Id;
    expect(propagated).toBe('human');
  });

  it('não muta a chave original (imutável)', () => {
    const br = createTournament();
    const humanMatch = getFirstHumanMatchId(br)!;
    advanceMatch(br, humanMatch, 'human');
    expect(br.matches[humanMatch].winnerId).toBeNull();
  });

  it('é no-op quando a partida já tem vencedor', () => {
    const br = createTournament();
    const id = getFirstHumanMatchId(br)!;
    const once = advanceMatch(br, id, 'human');
    const twice = advanceMatch(once, id, 'bot1');
    expect(twice.matches[id].winnerId).toBe('human');
  });

  it('marca o torneio como completo quando todas as partidas terminam', () => {
    let br: TournamentBracket = createTournament();
    for (const id of br.matchOrder) {
      const winner = br.matches[id].p1Id!;
      br = advanceMatch(br, id, winner);
    }
    expect(br.status).toBe('completed');
    expect(br.matches[br.finalMatchId].winnerId).toBeTruthy();
  });
});

describe('getEntrant', () => {
  it('resolve um participante pelo id e devolve null para desconhecidos', () => {
    const br = createTournament();
    expect(getEntrant(br, 'human')?.name).toBe('Tu');
    expect(getEntrant(br, 'missing')).toBeNull();
    expect(getEntrant(null, 'human')).toBeNull();
    expect(getEntrant(br, null)).toBeNull();
  });
});
