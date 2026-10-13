/**
 * Cliente Supabase para o servidor (Server Components e Route Handlers).
 *
 * Lê e escreve a sessão nos cookies do pedido. O refresh do token é
 * assegurado pelo `src/proxy.ts`.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/**
 * Cria um cliente Supabase do servidor ligado aos cookies do pedido.
 * Lança se o projeto Supabase não estiver configurado.
 */
export async function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase não configurado: define NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Chamado a partir de um Server Component: os cookies são só de
          // leitura. É seguro ignorar porque o proxy trata do refresh.
        }
      },
    },
  });
}
