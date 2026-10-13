/**
 * Proxy do Next.js 16 (antigo `middleware.ts`).
 *
 * Faz o refresh da sessão Supabase a cada pedido e reescreve os cookies
 * atualizados. Ver: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request: NextRequest) {
  // Sem projeto configurado não há sessão para refrescar.
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANTE: não remover. Sem esta chamada, os utilizadores podem ser
  // deslogados aleatoriamente em renderização server-side.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Tudo excepto ficheiros estáticos/ícones e o service worker.
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
