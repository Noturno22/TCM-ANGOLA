/**
 * Store de autenticação (Supabase Auth) — mobile.
 *
 * A web usa Google OAuth + telefone/OTP. No mobile a fatia vertical usa
 * email + password (sem deep links). Degrada de forma graciosa quando o
 * backend não está configurado.
 */
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

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
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

let authListenerBound = false;

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
