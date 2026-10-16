'use client';

/**
 * Store de autenticação (Supabase Auth).
 *
 * Métodos suportados: Google (OAuth) e telefone/WhatsApp (OTP por SMS).
 * Degrada de forma graciosa quando o backend não está configurado.
 */
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/** Traduz os erros mais comuns do Supabase Auth para português. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('provider is not enabled')) return 'Este método de login não está ativo no projeto.';
  if (m.includes('invalid phone number')) return 'Número de telefone inválido.';
  if (m.includes('token has expired') || m.includes('invalid otp') || m.includes('invalid token')) {
    return 'Código inválido ou expirado. Pede um novo.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados pedidos de código. Tenta mais tarde.';
  }
  if (m.includes('signups not allowed')) return 'Registos desativados no projeto.';
  if (m.includes('invalid login credentials')) return 'Email ou palavra-passe inválidos.';
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
  initialized: boolean;

  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  /** Login por email/password (usado em testes e2e; UI gated por NEXT_PUBLIC_E2E_AUTH). */
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  sendPhoneOtp: (phone: string) => Promise<boolean>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

let authListenerBound = false;

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  pending: false,
  error: null,
  initialized: false,

  initialize: async () => {
    const supabase = createClient();
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

  signInWithGoogle: async () => {
    const supabase = createClient();
    if (!supabase) {
      set({ error: translateAuthError('supabase não configurado') });
      return false;
    }
    set({ pending: true, error: null });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    // Em caso de sucesso o browser é redirecionado; só há erro imediato.
    set({ pending: false, error: error ? translateAuthError(error.message) : null });
    return !error;
  },

  signInWithEmail: async (email, password) => {
    const supabase = createClient();
    if (!supabase) {
      set({ error: translateAuthError('supabase não configurado') });
      return false;
    }
    set({ pending: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ pending: false, error: error ? translateAuthError(error.message) : null });
    return !error;
  },

  sendPhoneOtp: async (phone) => {
    const supabase = createClient();
    if (!supabase) {
      set({ error: translateAuthError('supabase não configurado') });
      return false;
    }
    set({ pending: true, error: null });
    const { error } = await supabase.auth.signInWithOtp({ phone });
    set({ pending: false, error: error ? translateAuthError(error.message) : null });
    return !error;
  },

  verifyPhoneOtp: async (phone, token) => {
    const supabase = createClient();
    if (!supabase) {
      set({ error: translateAuthError('supabase não configurado') });
      return false;
    }
    set({ pending: true, error: null });
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    set({ pending: false, error: error ? translateAuthError(error.message) : null });
    return !error;
  },

  signOut: async () => {
    const supabase = createClient();
    if (!supabase) return;
    set({ pending: true });
    await supabase.auth.signOut();
    set({ pending: false, user: null });
  },

  clearError: () => set({ error: null }),
}));
