/**
 * Online — gate 18+ para salas/torneios com aposta (moeda virtual KZ).
 *
 * A data de nascimento é PII: vive na tabela privada `profile_private`
 * (inacessível ao cliente). Aqui só se fala com as RPCs `my_age_gate` e
 * `set_birthdate`, e com funções puras testáveis.
 *
 * Degradação graciosa: sem backend/sessão, tudo devolve `null`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

/** Idade mínima para apostar moeda virtual. */
export const MIN_BET_AGE = 18;

export interface AgeGate {
  /** O utilizador já definiu a data de nascimento. */
  hasBirthdate: boolean;
  /** Data de nascimento (ISO `YYYY-MM-DD`) ou `null`. */
  birthdate: string | null;
  /** Tem 18+ anos (calculado no servidor). */
  isAdult: boolean;
}

function client(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient();
}

/** Converte a resposta da RPC `my_age_gate` num `AgeGate`. Função pura. */
export function mapAgeGate(row: Record<string, unknown>): AgeGate {
  const birthdate = (row.birthdate as string | null) ?? null;
  return {
    hasBirthdate: Boolean(row.has_birthdate) && birthdate !== null,
    birthdate,
    isAdult: Boolean(row.is_adult),
  };
}

/** Idade em anos completos hoje (usa UTC). -1 se a data for inválida. */
export function ageFromBirthdate(birthdate: string | null | undefined, now: Date = new Date()): number {
  if (!birthdate) return -1;
  const b = new Date(`${birthdate}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return -1;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - b.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/** É adulto (>= MIN_BET_AGE)? Função pura. */
export function isAdultBirthdate(
  birthdate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const age = ageFromBirthdate(birthdate, now);
  return age >= MIN_BET_AGE;
}

/** Data máxima aceite como nascimento de um adulto (hoje - 18 anos). */
export function maxBirthdateForAdult(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear() - MIN_BET_AGE, now.getUTCMonth(), now.getUTCDate()),
  );
  return d.toISOString().slice(0, 10);
}

/** Estado do gate do próprio. `null` em erro/sem backend. */
export async function fetchMyAgeGate(): Promise<AgeGate | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb.rpc('my_age_gate');
  if (error || !data) return null;
  return mapAgeGate(data as Record<string, unknown>);
}

/**
 * Guarda a data de nascimento do próprio e devolve o novo estado do gate.
 * `null` em erro (ex.: data inválida, sem sessão).
 */
export async function saveBirthdate(birthdate: string): Promise<AgeGate | null> {
  const sb = client();
  if (!sb) return null;
  const { data, error } = await sb.rpc('set_birthdate', { p_birthdate: birthdate });
  if (error || !data) return null;
  return mapAgeGate({
    has_birthdate: true,
    birthdate,
    is_adult: (data as { is_adult?: boolean }).is_adult ?? false,
  });
}
