/**
 * e2e online — partida real entre 2 contextos de browser.
 *
 * Pré-requisitos: backend Supabase configurado e utilizadores de teste criados
 * pelo `globalSetup` (ver `playwright.online.config.ts` e `.env.e2e`).
 */
import { expect, test, type Page } from '@playwright/test';
import { cell, openGlobeRoom } from '../helpers';
import { signIn } from './auth';
import { TEST_USER_1, TEST_USER_2 } from './users';

/** Entra na sala de Lisboa (Portugal) e inicia a fila de matchmaking. */
async function joinRoom(page: Page): Promise<void> {
  await page.getByRole('button', { name: /JOGAR ONLINE/ }).click();
  await expect(page.getByRole('main').getByRole('heading', { name: 'SALAS' })).toBeVisible();

  // A única forma de escolher sala é clicar numa cidade real do globo.
  await openGlobeRoom(page, 'lisboa');
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();

  // Sala com aposta (100 KZ) exige 18+: completa a verificação se for pedida.
  const ageDialog = page.getByRole('dialog').filter({ hasText: 'Verificação de idade' });
  const requested = await ageDialog
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (requested) {
    await page.getByLabel('Data de nascimento').fill('1990-01-01');
    await page.getByRole('button', { name: 'Confirmar' }).click();
  }
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
      await joinRoom(a);
      await expect(a.getByText('À procura de adversário…')).toBeVisible({ timeout: 30_000 });

      // Jogador B entra na fila → emparelhamento imediato.
      await signIn(b, TEST_USER_2.email, TEST_USER_2.password);
      await joinRoom(b);

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
