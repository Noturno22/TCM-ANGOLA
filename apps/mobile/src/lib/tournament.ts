/**
 * Lógica do Torneio Semanal — eliminatória simples (8 jogadores).
 * Funções puras para facilitar testes.
 */

export type TournamentEntrant = {
  id: string;
  name: string;
  level: number;
  elo: number;
  isHuman: boolean;
};

export type TournamentMatch = {
  id: string;
  round: 1 | 2 | 3;
  p1Id: string | null;
  p2Id: string | null;
  winnerId: string | null;
  nextMatchId: string | null;
  nextSlot: 'top' | 'bottom' | null;
};

export type TournamentBracket = {
  entrants: TournamentEntrant[];
  matches: Record<string, TournamentMatch>;
  matchOrder: string[];
  finalMatchId: string;
  status: 'open' | 'in_progress' | 'completed';
  prize: number;
  entryFee: number;
};

const BOT_NAMES = [
  'Timbaleiro',
  'Kimbundu AI',
  'Kizomba AI',
  'Semba AI',
  'Cavalo do Cuanza',
  'Mulemba AI',
  'Kufika AI',
];

function makeMatch(
  id: string,
  round: 1 | 2 | 3,
  p1Id: string | null,
  p2Id: string | null,
  nextMatchId: string | null,
  nextSlot: 'top' | 'bottom' | null,
): TournamentMatch {
  return { id, round, p1Id, p2Id, winnerId: null, nextMatchId, nextSlot };
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Cria uma chave de 8 jogadores: o humano + 7 bots baralhados.
 */
export function createTournament(
  params: { prize: number; entryFee: number } = { prize: 50000, entryFee: 0 },
): TournamentBracket {
  const human: TournamentEntrant = {
    id: 'human',
    name: 'Tu',
    level: 10,
    elo: 1300,
    isHuman: true,
  };
  const bots: TournamentEntrant[] = BOT_NAMES.map((name, i) => ({
    id: `bot${i + 1}`,
    name,
    level: 8 + i,
    elo: 1200 + i * 25,
    isHuman: false,
  }));

  const players = [human, ...shuffle(bots)];

  const matches: Record<string, TournamentMatch> = {
    'r1-1': makeMatch('r1-1', 1, players[0].id, players[1].id, 'r2-f', 'top'),
    'r1-2': makeMatch('r1-2', 1, players[2].id, players[3].id, 'r2-f', 'bottom'),
    'r1-3': makeMatch('r1-3', 1, players[4].id, players[5].id, 'r2-s', 'top'),
    'r1-4': makeMatch('r1-4', 1, players[6].id, players[7].id, 'r2-s', 'bottom'),
    'r2-f': makeMatch('r2-f', 2, null, null, 'r3', 'top'),
    'r2-s': makeMatch('r2-s', 2, null, null, 'r3', 'bottom'),
    r3: makeMatch('r3', 3, null, null, null, null),
  };

  return {
    entrants: players,
    matches,
    matchOrder: ['r1-1', 'r1-2', 'r1-3', 'r1-4', 'r2-f', 'r2-s', 'r3'],
    finalMatchId: 'r3',
    status: 'open',
    prize: params.prize,
    entryFee: params.entryFee,
  };
}

/** IDs das partidas por decidir em que o humano participa. */
export function getHumanMatchIds(br: TournamentBracket): string[] {
  return br.matchOrder.filter((id) => {
    const m = br.matches[id];
    return !!m && (m.p1Id === 'human' || m.p2Id === 'human') && !m.winnerId;
  });
}

/** Próxima partida do humano (ou null se não há nenhuma pendente). */
export function getFirstHumanMatchId(br: TournamentBracket): string | null {
  return getHumanMatchIds(br)[0] ?? null;
}

/**
 * Regista o vencedor de uma partida e propaga-o para a ronda seguinte.
 * Devolve uma nova chave (imutável). Se a partida já tiver vencedor, é no-op.
 */
export function advanceMatch(
  br: TournamentBracket,
  matchId: string,
  winnerId: string,
): TournamentBracket {
  const next: TournamentBracket = JSON.parse(JSON.stringify(br)) as TournamentBracket;
  const m = next.matches[matchId];
  if (!m || m.winnerId) return next;

  m.winnerId = winnerId;
  if (m.nextMatchId && m.nextSlot) {
    const nm = next.matches[m.nextMatchId];
    if (nm) {
      if (m.nextSlot === 'top') nm.p1Id = winnerId;
      if (m.nextSlot === 'bottom') nm.p2Id = winnerId;
    }
  }

  const finalM = next.matches[next.finalMatchId];
  if (finalM?.p1Id && finalM?.p2Id) next.status = 'in_progress';
  if (next.matchOrder.every((id) => next.matches[id]?.winnerId)) {
    next.status = 'completed';
  }
  return next;
}

/** Resolve um participante pelo id. */
export function getEntrant(
  br: TournamentBracket | null,
  id: string | null | undefined,
): TournamentEntrant | null {
  if (!br || !id) return null;
  return br.entrants.find((e) => e.id === id) ?? null;
}