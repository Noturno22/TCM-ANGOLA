/**
 * Cliente Supabase para React Native (Expo).
 *
 * Devolve `null` quando as variáveis de ambiente não estão configuradas,
 * para que a app continue a funcionar (modo convidado/offline) sem backend.
 *
 * Diferenças face à web: a sessão vive no AsyncStorage (não em cookies) e o
 * refresh do token faz-se no ciclo de vida da app (AppState) em vez de cookies.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) as string | undefined;

/** True quando a app tem um projeto Supabase configurado. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;
let appStateBound = false;

/** Cria (ou reutiliza) o cliente Supabase. `null` sem configuração. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL as string, SUPABASE_KEY as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  // Mantém o token fresco apenas com a app em primeiro plano (padrão RN).
  if (!appStateBound) {
    appStateBound = true;
    AppState.addEventListener('change', (state) => {
      if (!client) return;
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
  }

  return client;
}
