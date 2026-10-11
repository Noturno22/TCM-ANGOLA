/**
 * Storage helper para os stores zustand.
 *
 * O Expo/RN não tem `localStorage` — usamos o AsyncStorage como backend do
 * `createJSONStorage` do zustand `persist`, com chaves namespaced (`tira:...`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type PersistStorage } from 'zustand/middleware';

/**
 * Cria um persist storage JSON (zustand) sobre o AsyncStorage.
 *
 * Uso em cada store:
 * ```ts
 * persist(fn, { name: 'tira:game', storage: createAsyncStorage<GameStore>() })
 * ```
 *
 * Equivale a `createJSONStorage(() => AsyncStorage)`, tipado para o estado
 * concreto de cada store.
 */
export function createAsyncStorage<S>(): PersistStorage<S> | undefined {
  return createJSONStorage<S>(() => AsyncStorage);
}
