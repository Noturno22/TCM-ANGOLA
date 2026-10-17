/**
 * Provisão de utilizadores de teste via Supabase Admin API.
 *
 * Os testes online precisam de sessões autenticadas reais. Como o projeto tem
 * `mailer_autoconfirm=false`, criamos estes utilizadores já confirmados com a
 * chave de serviço (service role) — NUNCA a partir do browser.
 *
 * A chave vive apenas em `.env.e2e` (ignorada pelo git) e nunca é commitada.
 */

export interface AdminEnv {
  url: string;
  serviceRoleKey: string;
}

/** Lê o ambiente de admin; devolve `null` quando não configurado. */
export function getAdminEnv(): AdminEnv | null {
  const url = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ''), serviceRoleKey };
}

function headers(env: AdminEnv): Record<string, string> {
  return {
    apikey: env.serviceRoleKey,
    Authorization: `Bearer ${env.serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
}

interface AdminUser {
  id: string;
  email?: string;
}

/** Lista todos os utilizadores (pagina até encontrar o email, se pedido). */
async function listUsers(env: AdminEnv, email?: string): Promise<AdminUser[]> {
  const found: AdminUser[] = [];
  const perPage = 100;
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${env.url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: headers(env),
    });
    if (!res.ok) {
      throw new Error(`admin list users falhou (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as unknown;
    const users: AdminUser[] = Array.isArray(body)
      ? (body as AdminUser[])
      : ((body as { users?: AdminUser[] }).users ?? []);
    if (users.length === 0) break;
    for (const u of users) {
      if (!email || u.email?.toLowerCase() === email.toLowerCase()) found.push(u);
    }
    if (email && found.length > 0) return found;
    if (users.length < perPage) break;
  }
  return found;
}

/** Encontra um utilizador pelo email; `null` se não existir. */
export async function findUserByEmail(env: AdminEnv, email: string): Promise<AdminUser | null> {
  const users = await listUsers(env, email);
  return users[0] ?? null;
}

/** Cria um utilizador já confirmado. Lança se já existir. */
export async function createConfirmedUser(
  env: AdminEnv,
  email: string,
  password: string,
): Promise<AdminUser> {
  const res = await fetch(`${env.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) {
    throw new Error(`admin create user falhou (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as AdminUser;
}

/** DELETE best-effort no PostgREST (service role ignora RLS). */
async function deleteWhere(env: AdminEnv, table: string, query: string): Promise<void> {
  try {
    const res = await fetch(`${env.url}/rest/v1/${table}?${query}`, {
      method: 'DELETE',
      headers: { ...headers(env), Prefer: 'return=minimal' },
    });
    if (!res.ok && res.status !== 404) {
      console.warn(`[e2e online] purge ${table} (${res.status}): ${await res.text()}`);
    }
  } catch (err) {
    console.warn(`[e2e online] purge ${table} falhou:`, err);
  }
}

/** SELECT de ids best-effort no PostgREST. */
async function selectIds(env: AdminEnv, table: string, query: string): Promise<string[]> {
  try {
    const res = await fetch(`${env.url}/rest/v1/${table}?${query}&select=id`, {
      headers: headers(env),
    });
    if (!res.ok) return [];
    return ((await res.json()) as { id: string }[]).map((r) => r.id);
  } catch {
    return [];
  }
}

/** Remove os comprovativos de um utilizador do bucket (pasta `<userId>/`). */
export async function purgeUserStorage(
  env: AdminEnv,
  bucket: string,
  userId: string,
): Promise<void> {
  try {
    const listRes = await fetch(`${env.url}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { ...headers(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: userId, limit: 100, offset: 0 }),
    });
    if (!listRes.ok) return;
    const items = (await listRes.json()) as { name: string }[];
    if (!items.length) return;
    const prefixes = items.map((i) => (i.name.startsWith(`${userId}/`) ? i.name : `${userId}/${i.name}`));
    const delRes = await fetch(`${env.url}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: { ...headers(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes }),
    });
    if (!delRes.ok) {
      console.warn(`[e2e online] purge storage (${delRes.status}): ${await delRes.text()}`);
    }
  } catch (err) {
    console.warn('[e2e online] purge storage falhou:', err);
  }
}

/**
 * Remove os artefactos que referenciam `auth.users` com ON DELETE RESTRICT
 * (contas/KYC) ou que não caem em cascade (notificações do admin, ficheiros no
 * storage). Best-effort: nunca falha a corrida de testes.
 */
async function purgeUserArtifacts(env: AdminEnv, id: string): Promise<void> {
  const key = encodeURIComponent(id);

  // accounts.* e kyc_records.* apontam para auth.users com RESTRICT.
  await deleteWhere(env, 'kyc_records', `user_id=eq.${key}`);
  await deleteWhere(env, 'accounts', `user_id=eq.${key}`);

  // Notificações do admin ligadas a comprovativos/pedidos deste utilizador
  // (não têm FK; ficariam órfãs após o cascade).
  const receiptIds = await selectIds(env, 'payment_receipts', `user_id=eq.${key}`);
  const withdrawalIds = await selectIds(env, 'withdrawal_requests', `user_id=eq.${key}`);
  const entityIds = [...receiptIds, ...withdrawalIds];
  if (entityIds.length) {
    await deleteWhere(env, 'admin_notifications', `entity_id=in.(${entityIds.join(',')})`);
  }

  // Comprovativos no storage (não caem em cascade).
  await purgeUserStorage(env, 'payment-proofs', id);
}

/** Remove um utilizador (purgando antes as linhas RESTRICT; cascade no resto). */
export async function deleteUser(env: AdminEnv, id: string): Promise<void> {
  await purgeUserArtifacts(env, id);

  const res = await fetch(`${env.url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: headers(env),
  });
  // 404 = já não existe: idempotente.
  if (!res.ok && res.status !== 404) {
    throw new Error(`admin delete user falhou (${res.status}): ${await res.text()}`);
  }
}

/** Remove todos os utilizadores com um dado email (idempotente). */
export async function deleteUserByEmail(env: AdminEnv, email: string): Promise<void> {
  const users = await listUsers(env, email);
  for (const u of users) await deleteUser(env, u.id);
}

/** Garante um utilizador confirmado com a password dada (recria se necessário). */
export async function ensureConfirmedUser(
  env: AdminEnv,
  email: string,
  password: string,
): Promise<AdminUser> {
  await deleteUserByEmail(env, email);
  return createConfirmedUser(env, email, password);
}
