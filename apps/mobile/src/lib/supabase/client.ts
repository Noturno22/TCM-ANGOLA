/**
 * Shim de compatibilidade — espelha `@/lib/supabase/client` do web.
 *
 * O cliente mobile vive em `@/lib/supabase` (`getSupabase`), com sessão em
 * AsyncStorage; a assinatura `createClient(): SupabaseClient | null` é a
 * mesma, pelo que os stores copiados do web funcionam sem alterações.
 */
export { isSupabaseConfigured, getSupabase as createClient } from '@/lib/supabase';
