/**
 * Cliente Supabase para o browser.
 *
 * Devolve `null` quando as variáveis de ambiente não estão configuradas,
 * para que a app continue a funcionar (modo convidado) sem backend.
 */
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True quando a app tem um projeto Supabase configurado. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let browserClient: SupabaseClient | null = null;

/**
 * Cria (ou reutiliza) o cliente Supabase do browser.
 * A sessão vive em cookies geridos pelo `@supabase/ssr`.
 */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL!, SUPABASE_KEY!);
  }
  return browserClient;
}
