/**
 * globalSetup dos testes online: cria (ou recria) utilizadores de teste
 * confirmados via Admin API. Requer `.env.e2e` com a chave de serviço.
 */
import { ensureConfirmedUser, getAdminEnv } from './admin';
import { TEST_USERS } from './users';
import { writeState } from './state';

export default async function globalSetup(): Promise<void> {
  const env = getAdminEnv();
  if (!env) {
    throw new Error(
      'e2e online: faltam E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY. ' +
        'Cria um `.env.e2e` (ignorado pelo git) a partir de `.env.e2e.example`.',
    );
  }

  const ids: string[] = [];
  for (const user of TEST_USERS) {
    const created = await ensureConfirmedUser(env, user.email, user.password);
    ids.push(created.id);
  }
  writeState({ ids });
}
