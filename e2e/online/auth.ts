/**
 * Autenticação nos testes e2e online.
 *
 * Login email/password — a UI do formulário só aparece com
 * `NEXT_PUBLIC_E2E_AUTH=1` (invisível em produção).
 */
import { expect, type Page } from '@playwright/test';
import { gotoWelcome, resetStorage } from '../helpers';

/** Autentica um contexto via login email/password. */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await resetStorage(page);
  await gotoWelcome(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('main').getByRole('heading', { name: 'ENTRAR' })).toBeVisible();

  await page.getByLabel('Email (teste)').fill(email);
  await page.getByLabel('Password (teste)').fill(password);
  await page.getByRole('button', { name: 'Entrar com email' }).click();

  // Sessão ativa → volta a casa.
  await expect(page.getByRole('button', { name: /JOGAR OFFLINE/ })).toBeVisible({
    timeout: 30_000,
  });
}
