/**
 * Elo e progressão — lógica pura (espelha a liquidação em
 * `supabase/migrations/0006_online_match.sql` → `_settle_match`).
 *
 * Usada no cliente para pré-visualização (ex.: mostrar ganho/perda de Elo
 * esperado). A verdade é sempre o resultado devolvido pelo servidor.
 */

/** Probabilidade esperada de vitória de A sobre B (fórmula Elo). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Variação de Elo de A, dado o resultado `score` (1 vitória, 0.5 empate,
 * 0 derrota). B varia simétrico (-delta).
 */
export function eloDelta(ratingA: number, ratingB: number, score: number, k = 32): number {
  return Math.round(k * (score - expectedScore(ratingA, ratingB)));
}

/** Novo Elo com piso mínimo de 100 (igual ao servidor). */
export function nextElo(rating: number, delta: number): number {
  return Math.max(100, rating + delta);
}

/** Nível a partir do XP (1 + XP/100), como no servidor. */
export function levelFromXp(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / 100);
}

export type MatchOutcome = 'P1' | 'P2' | 'draw';

/** XP atribuído por resultado (espelha o servidor). */
export function xpForOutcome(outcome: MatchOutcome): { p1: number; p2: number } {
  if (outcome === 'draw') return { p1: 15, p2: 15 };
  if (outcome === 'P1') return { p1: 40, p2: 10 };
  return { p1: 10, p2: 40 };
}

/** Moedas virtuais ganhas por resultado (espelha o servidor). */
export function coinsForOutcome(outcome: MatchOutcome, stake: number): { p1: number; p2: number } {
  if (outcome === 'P1') return { p1: stake, p2: 0 };
  if (outcome === 'P2') return { p1: 0, p2: stake };
  return { p1: 0, p2: 0 };
}

/**
 * Calcula a variação de Elo para o resultado, dado o Elo de ambos.
 * Devolve `{ p1, p2 }` (p2 = -p1, zero-sum).
 */
export function eloChangeForOutcome(
  elo1: number,
  elo2: number,
  outcome: MatchOutcome,
  k = 32,
): { p1: number; p2: number } {
  const score = outcome === 'draw' ? 0.5 : outcome === 'P1' ? 1 : 0;
  const delta = eloDelta(elo1, elo2, score, k);
  return { p1: delta, p2: delta === 0 ? 0 : -delta };
}
