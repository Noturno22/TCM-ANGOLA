import { describe, expect, it } from 'vitest';
import {
  bracketMatchStatusLabel,
  bracketRoundCount,
  findMyOpenMatch,
  groupMatchesByRound,
  mapBracketMatchRow,
  mapTournamentEntryRow,
  mapTournamentRow,
  parseTournamentErrorCode,
  roundLabel,
  tournamentStatusLabel,
  type BracketMatch,
} from './tournaments';

function match(round: number, slot: number, extra: Partial<BracketMatch> = {}): BracketMatch {
  return {
    id: `m-${round}-${slot}`,
    tournamentId: 't-1',
    round,
    slot,
    p1Id: null,
    p2Id: null,
    winnerId: null,
    matchId: null,
    status: 'pending',
    ...extra,
  };
}

describe('mapTournamentRow', () => {
  it('mapeia todos os campos com valores por omissão', () => {
    const t = mapTournamentRow({
      id: 't1',
      name: 'Copa Kwanza',
      max_players: 8,
      entry_fee: 100,
      prize: 5000,
      pot: 0,
      room_id: 'global',
      time_per_turn: 45,
      status: 'open',
      created_at: '2026-10-15T10:00:00.000Z',
    });
    expect(t.id).toBe('t1');
    expect(t.name).toBe('Copa Kwanza');
    expect(t.description).toBe('');
    expect(t.format).toBe('single_elim');
    expect(t.maxPlayers).toBe(8);
    expect(t.entryFee).toBe(100);
    expect(t.prize).toBe(5000);
    expect(t.roomId).toBe('global');
    expect(t.status).toBe('open');
    expect(t.championId).toBeNull();
    expect(t.updatedAt).toBe('2026-10-15T10:00:00.000Z');
  });
});

describe('mapBracketMatchRow', () => {
  it('mapeia ids opcionais como null', () => {
    const m = mapBracketMatchRow({
      id: 'bm1',
      tournament_id: 't1',
      round: 2,
      slot: 1,
      status: 'ready',
    });
    expect(m.round).toBe(2);
    expect(m.slot).toBe(1);
    expect(m.p1Id).toBeNull();
    expect(m.p2Id).toBeNull();
    expect(m.winnerId).toBeNull();
    expect(m.matchId).toBeNull();
    expect(m.status).toBe('ready');
  });
});

describe('mapTournamentEntryRow', () => {
  it('assume active sem status', () => {
    const e = mapTournamentEntryRow({
      id: 'e1',
      tournament_id: 't1',
      user_id: 'u1',
      created_at: '2026-10-15T10:00:00.000Z',
    });
    expect(e.userId).toBe('u1');
    expect(e.status).toBe('active');
  });
});

describe('groupMatchesByRound', () => {
  it('agrupa por ronda e ordena por slot', () => {
    const groups = groupMatchesByRound([
      match(2, 1),
      match(1, 3),
      match(1, 1),
      match(3, 1),
      match(1, 2),
    ]);
    expect(groups.map((g) => g.round)).toEqual([1, 2, 3]);
    expect(groups[0].matches.map((m) => m.slot)).toEqual([1, 2, 3]);
  });

  it('devolve [] sem jogos', () => {
    expect(groupMatchesByRound([])).toEqual([]);
  });
});

describe('bracketRoundCount', () => {
  it('devolve a maior ronda', () => {
    expect(bracketRoundCount([match(1, 1), match(3, 1), match(2, 1)])).toBe(3);
  });

  it('devolve 0 sem jogos', () => {
    expect(bracketRoundCount([])).toBe(0);
  });
});

describe('roundLabel', () => {
  it('etiqueta as rondas finais', () => {
    expect(roundLabel(3, 3)).toBe('Final');
    expect(roundLabel(2, 3)).toBe('Meias-finais');
    expect(roundLabel(1, 3)).toBe('Quartas de final');
    expect(roundLabel(1, 4)).toBe('Oitavas de final');
  });

  it('usa um rótulo genérico para rondas iniciais', () => {
    expect(roundLabel(1, 5)).toBe('Ronda 1');
  });
});

describe('tournamentStatusLabel', () => {
  it('traduz os estados', () => {
    expect(tournamentStatusLabel('open')).toBe('Inscrições abertas');
    expect(tournamentStatusLabel('in_progress')).toBe('Em curso');
    expect(tournamentStatusLabel('completed')).toBe('Terminado');
    expect(tournamentStatusLabel('cancelled')).toBe('Cancelado');
  });
});

describe('bracketMatchStatusLabel', () => {
  it('traduz os estados de jogo', () => {
    expect(bracketMatchStatusLabel('pending')).toBe('Por definir');
    expect(bracketMatchStatusLabel('ready')).toBe('Pronto');
    expect(bracketMatchStatusLabel('playing')).toBe('Em jogo');
    expect(bracketMatchStatusLabel('finished')).toBe('Terminado');
    expect(bracketMatchStatusLabel('bye')).toBe('Passa');
  });
});

describe('findMyOpenMatch', () => {
  const ME = 'me-1';

  it('prefere um jogo em curso a um pronto', () => {
    const ready = match(1, 1, { p1Id: ME, p2Id: 'x', status: 'ready' });
    const playing = match(2, 1, { p1Id: ME, p2Id: 'y', status: 'playing', matchId: 'mm' });
    expect(findMyOpenMatch([ready, playing], ME)?.id).toBe(playing.id);
  });

  it('devolve um jogo pronto quando não há em curso', () => {
    const ready = match(1, 1, { p1Id: ME, p2Id: 'x', status: 'ready' });
    expect(findMyOpenMatch([ready], ME)?.id).toBe(ready.id);
  });

  it('ignora jogos decididos e jogos de outros', () => {
    const won = match(1, 1, { p1Id: ME, p2Id: 'x', status: 'finished', winnerId: ME });
    const other = match(1, 2, { p1Id: 'a', p2Id: 'b', status: 'ready' });
    expect(findMyOpenMatch([won, other], ME)).toBeNull();
  });

  it('devolve null sem utilizador', () => {
    expect(findMyOpenMatch([match(1, 1, { p1Id: ME, p2Id: 'x', status: 'ready' })], null)).toBeNull();
  });
});

describe('parseTournamentErrorCode', () => {
  it('reconhece códigos conhecidos', () => {
    expect(parseTournamentErrorCode('tournament_full')).toBe('tournament_full');
    expect(parseTournamentErrorCode('ERROR: not_enough_coins')).toBe('not_enough_coins');
    expect(parseTournamentErrorCode('not_authenticated')).toBe('not_authenticated');
    expect(parseTournamentErrorCode('ERROR: invalid_name')).toBe('invalid_name');
    expect(parseTournamentErrorCode('too_many_invites')).toBe('too_many_invites');
    expect(parseTournamentErrorCode('not_tournament_owner')).toBe('not_tournament_owner');
  });

  it('devolve null para desconhecido ou vazio', () => {
    expect(parseTournamentErrorCode('boom')).toBeNull();
    expect(parseTournamentErrorCode(null)).toBeNull();
    expect(parseTournamentErrorCode('')).toBeNull();
  });
});
