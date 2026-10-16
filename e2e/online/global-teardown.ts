/**
 * globalTeardown dos testes online: remove os utilizadores de teste.
 * O cascade da base de dados limpa perfis, filas e partidas associadas.
 */
import { deleteUser, getAdminEnv } from './admin';
import { clearState, readState } from './state';

export default async function globalTeardown(): Promise<void> {
  const env = getAdminEnv();
  const state = readState();
  if (env && state) {
    for (const id of state.ids) {
      try {
        await deleteUser(env, id);
      } catch (err) {
        // A limpeza não deve falhar a corrida de testes.
        console.warn(`[e2e online] falha ao remover utilizador ${id}:`, err);
      }
    }
  }
  clearState();
}
