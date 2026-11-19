/**
 * Store de autenticação (Supabase Auth) — mobile.
 *
 * Login por email/password e por conta Google (ID token nativo). Degrada de
 * forma graciosa quando o backend ou o Google não estão configurados.
 */
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { getSupabase, GOOGLE_WEB_CLIENT_ID, isGoogleSignInConfigured } from '@/lib/supabase';

/** Traduz os erros mais comuns do Supabase Auth para português. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou palavra-passe incorretos.';
  if (m.includes('email not confirmed')) return 'Confirma o teu email antes de entrar.';
  if (m.includes('user already registered')) return 'Já existe uma conta com esse email.';
  if (m.includes('password should be at least'))
    return 'A palavra-passe é demasiado curta (mínimo 6 caracteres).';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Email inválido.';
  if (m.includes('signups not allowed')) return 'Registos desativados no projeto.';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados pedidos. Tenta mais tarde.';
  }
  if (m.includes('supabase não configurado')) return 'Backend não configurado.';
  return message;
}

interface AuthState {
  user: User | null;
  /** Carregamento inicial da sessão. */
  loading: boolean;
  /** Operação em curso. */
  pending: boolean;
  error: string | null;
  /** Mensagem informativa (ex.: confirmação de email enviada). */
  info: string | null;
  initialized: boolean;

  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

let authListenerBound = false;
let googleConfigured = false;

function configureGoogle(): void {
  if (googleConfigured || !GOOGLE_WEB_CLIENT_ID) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  googleConfigured = true;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  pending: false,
  error: null,
  info: null,
  initialized: false,

  initialize: async () => {
    const supabase = getSupabase();
    if (!supabase) {
      set({ loading: false, initialized: true });
      return;
    }

    if (!authListenerBound) {
      authListenerBound = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });
    }

    const { data } = await supabase.auth.getSession();
    set({ user: data.session?.user ?? null, loading: false, initialized: true });
  },

  signInWithEmail: async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) {
      set({ error: translateAuthError('supabase não configurado') });
      return false;
    }
    set({ pending: true, error: null, info: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ pending: false, error: error ? translateAuthError(error.message) : null });
    return !error;
  },

  signInWithGoogle: async () => {
    const supabase = getSupabase();
    if (!supabase) {
      set({ error: translateAuthError('supabase não configurado') });
      return false;
    }
    if (!isGoogleSignInConfigured) {
      set({ error: 'Login Google não configurado nesta app.' });
      return false;
    }
    set({ pending: true, error: null, info: null });
    try {
      configureGoogle();
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        set({ pending: false });
        return false;
      }
      const idToken = response.data.idToken;
      if (!idToken) {
        set({ pending: false, error: 'Não foi possível obter o token do Google.' });
        return false;
      }
      const tokens = await GoogleSignin.getTokens().catch(() => null);
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        access_token: tokens?.accessToken,
      });
      set({ pending: false, error: error ? translateAuthError(error.message) : null });
      return !error;
    } catch (err) {
      set({
        pending: false,
        error: translateAuthError(
          err instanceof Error ? err.message : 'Não foi possível entrar com o Google.',
        ),
      });
      return false;
    }
  },

  signUpWithEmail: async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) {
      set({ error: translateAuthError('supabase não configurado') });
      return false;
    }
    set({ pending: true, error: null, info: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ pending: false, error: translateAuthError(error.message) });
      return false;
    }
    // Com confirmação de email ativa, signUp devolve user sem sessão.
    const needsConfirm = Boolean(data.user) && !data.session;
    set({
      pending: false,
      error: null,
      info: needsConfirm ? 'Enviámos um email de confirmação. Confirma para entrar.' : null,
    });
    return needsConfirm ? false : true;
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    set({ pending: true });
    await supabase.auth.signOut();
    set({ pending: false, user: null, error: null, info: null });
  },

  clearError: () => set({ error: null, info: null }),
}));
