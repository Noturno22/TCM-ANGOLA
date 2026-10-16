/**
 * e2e online — partida real entre 2 contextos de browser.
 *
 * Pré-requisitos: backend Supabase configurado e utilizadores de teste criados
 * pelo `globalSetup` (ver `playwright.online.config.ts` e `.env.e2e`).
 */
import { expect, test, type Page } from '@playwright/test';
import { cell, gotoWelcome, resetStorage } from '../helpers';
import { TEST_USER_1, TEST_USER_2 } from './users';

/** Autentica um contexto via login email/password (UI gated por NEXT_PUBLIC_E2E_AUTH). */
async function signIn(page: Page, email: string, password: string): Promise<void> {
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

/** Entra na sala gratuita "Global (Free)" e inicia a fila de matchmaking. */
async function joinFreeRoom(page: Page): Promise<void> {
  await page.getByRole('button', { name: /JOGAR ONLINE/ }).click();
  await expect(page.getByRole('main').getByRole('heading', { name: 'SALAS' })).toBeVisible();
  await page.getByRole('button', { name: 'Entrar na sala Global (Free)' }).click();
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
}

test.describe('Online — partida entre 2 contextos', () => {
  test('matchmaking, jogada em tempo real e desistência', async ({ browser }) => {
    test.setTimeout(150_000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const a = await contextA.newPage();
    const b = await contextB.newPage();

    try {
      // Jogador A entra na fila e espera.
      await signIn(a, TEST_USER_1.email, TEST_USER_1.password);
      await joinFreeRoom(a);
      await expect(a.getByText('À procura de adversário…')).toBeVisible({ timeout: 30_000 });

      // Jogador B entra na fila → emparelhamento imediato.
      await signIn(b, TEST_USER_2.email, TEST_USER_2.password);
      await joinFreeRoom(b);

      // Ambos chegam ao tabuleiro online.
      await expect(b.getByRole('grid', { name: /Tabuleiro/ })).toBeVisible({ timeout: 30_000 });
      await expect(a.getByRole('grid', { name: /Tabuleiro/ })).toBeVisible({ timeout: 30_000 });

      // A é o primeiro da fila (P1) e joga 1 -> 4.
      await cell(a, 'casa 1, Jogador 1').click();
      await cell(a, 'casa 4, vazia, destino válido').click();

      // A jogada propaga por Realtime para o adversário.
      await expect(cell(b, 'casa 4, Jogador 1')).toBeVisible({ timeout: 30_000 });

      // B (P2) desiste → A vence.
      await b.getByRole('button', { name: 'Desistir' }).click();
      await expect(b.getByRole('heading', { name: 'PERDESTE' })).toBeVisible({ timeout: 30_000 });
      await expect(a.getByRole('heading', { name: 'GANHASTE!' })).toBeVisible({ timeout: 30_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
