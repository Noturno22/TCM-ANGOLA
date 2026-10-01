/**
 * Gerador de números pseudo-aleatórios determinístico (mulberry32).
 * Permite que a IA seja reprodutível a partir de uma seed.
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Devolve um inteiro aleatório em [0, n). */
export function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/** Escolhe um elemento aleatório de um array (não vazio). */
export function pick<T>(rng: () => number, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick: array vazio');
  return arr[randInt(rng, arr.length)];
}

/** Baralha um array (cópia) com Fisher-Yates. */
export function shuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
