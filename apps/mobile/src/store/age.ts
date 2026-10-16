/**
 * Store do gate 18+ (mobile) — salas com aposta.
 *
 * Port de `src/store/age.ts` (web). A verdade está no servidor (`my_age_gate`);
 * este store apenas a espelha para a UI decidir quando abrir o diálogo.
 * Sem backend/sessão, `enabled` é `false` e a UI não bloqueia nada.
 */
import { create } from 'zustand';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { fetchMyAgeGate, saveBirthdate } from '@/lib/online/age';

interface AgeStore {
  enabled: boolean;
  /** Já consultámos o servidor (ou não há sessão). */
  loaded: boolean;
  loading: boolean;
  hasBirthdate: boolean;
  birthdate: string | null;
  isAdult: boolean;

  /** Consulta o gate do próprio (idempotente). */
  load: () => Promise<void>;
  /** Guarda a data de nascimento; devolve `true` se ficou adulto. */
  save: (birthdate: string) => Promise<boolean>;
  /** Limpa o estado (ex.: logout). */
  reset: () => void;
}

export const useAge = create<AgeStore>((set, get) => ({
  enabled: isSupabaseConfigured,
  loaded: false,
  loading: false,
  hasBirthdate: false,
  birthdate: null,
  isAdult: false,

  load: async () => {
    if (!isSupabaseConfigured) {
      set({ loaded: true });
      return;
    }
    const uid = useAuth.getState().user?.id ?? null;
    if (!uid) {
      set({ loaded: true, hasBirthdate: false, birthdate: null, isAdult: false });
      return;
    }
    if (get().loading) return;
    set({ loading: true });
    const gate = await fetchMyAgeGate();
    if (!gate) {
      // Servidor indisponível: não bloquear (o servidor volta a validar).
      set({ loading: false, loaded: true });
      return;
    }
    set({
      loading: false,
      loaded: true,
      hasBirthdate: gate.hasBirthdate,
      birthdate: gate.birthdate,
      isAdult: gate.isAdult,
    });
  },

  save: async (birthdate) => {
    const gate = await saveBirthdate(birthdate);
    if (!gate) return false;
    set({
      loaded: true,
      hasBirthdate: gate.hasBirthdate,
      birthdate: gate.birthdate,
      isAdult: gate.isAdult,
    });
    return gate.isAdult;
  },

  reset: () =>
    set({ loaded: false, loading: false, hasBirthdate: false, birthdate: null, isAdult: false }),
}));
