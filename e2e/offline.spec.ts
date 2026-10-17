import { expect, test } from '@playwright/test';
import { cell, enterAsGuest, resetStorage, startOfflinePvp } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetStorage(page);
});

test.describe('Offline — 2 Jogadores', () => {
  test('vitória do Jogador 1 ao completar a linha do meio', async ({ page }) => {
    await enterAsGuest(page);
    await startOfflinePvp(page);

    // 1. P1: 1 -> 4
    await cell(page, 'casa 1, Jogador 1').click();
    await cell(page, 'casa 4, vazia, destino válido').click();
    // 2. P2: 9 -> 6
    await cell(page, 'casa 9, Jogador 2').click();
    await cell(page, 'casa 6, vazia, destino válido').click();
    // 3. P1: 2 -> centro (5)
    await cell(page, 'casa 2, Jogador 1').click();
    await cell(page, 'centro, vazia, destino válido').click();
    // 4. P2: 6 -> 9
    await cell(page, 'casa 6, Jogador 2').click();
    await cell(page, 'casa 9, vazia, destino válido').click();
    // 5. P1: 3 -> 6  => linha 4-5-6 completa
    await cell(page, 'casa 3, Jogador 1').click();
    await cell(page, 'casa 6, vazia, destino válido').click();

    await expect(
      page.getByRole('heading', { name: 'Jogador 1 venceu!' }),
    ).toBeVisible();
  });

  test('empate por repetição tripla da posição', async ({ page }) => {
    await enterAsGuest(page);
    await startOfflinePvp(page);

    // Ciclo de 4 jogadas que regressa à posição inicial (mesmo jogador a jogar).
    const cycle = async () => {
      await cell(page, 'casa 1, Jogador 1').click();
      await cell(page, 'casa 4, vazia, destino válido').click();
      await cell(page, 'casa 7, Jogador 2').click();
      await cell(page, 'centro, vazia, destino válido').click();
      await cell(page, 'casa 4, Jogador 1').click();
      await cell(page, 'casa 1, vazia, destino válido').click();
      await cell(page, 'centro, Jogador 2').click();
      await cell(page, 'casa 7, vazia, destino válido').click();
    };

    await cycle();
    await cycle();

    await expect(page.getByRole('heading', { name: 'Empate!' })).toBeVisible();
  });

  test('tentativa de salto inválida não move a peça', async ({ page }) => {
    await enterAsGuest(page);
    await startOfflinePvp(page);

    await cell(page, 'casa 1, Jogador 1').click();

    // A casa 6 não é vizinha da casa 1: nunca deve ser destino válido.
    await expect(
      page.getByRole('gridcell', { name: 'casa 6, vazia, destino válido' }),
    ).toHaveCount(0);

    // Tentar mover (salto) para a casa 6 não deve fazer nada.
    await cell(page, 'casa 6, vazia').click();

    await expect(
      cell(page, 'casa 1, Jogador 1, selecionada'),
    ).toBeVisible();
    await expect(page.getByText('A tua vez. Escolhe uma peça.')).toBeVisible();
    await expect(page.getByRole('heading', { name: /venceu!/ })).toHaveCount(0);
  });
});
