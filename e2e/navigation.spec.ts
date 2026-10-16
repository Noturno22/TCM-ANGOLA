import { expect, test } from '@playwright/test';
import { enterAsGuest, gotoWelcome, resetStorage, startOfflinePvp } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetStorage(page);
});

test('fluxo de conta: boas-vindas -> Entrar -> voltar como convidado', async ({ page }) => {
  await gotoWelcome(page);

  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('main').getByRole('heading', { name: 'ENTRAR' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Continuar como convidado' }).click();
  await expect(page.getByRole('button', { name: /JOGAR OFFLINE/ })).toBeVisible();
});

test('sala -> partida (fallback offline sem sessão)', async ({ page }) => {
  await enterAsGuest(page);

  await page.getByRole('button', { name: /JOGAR ONLINE/ }).click();
  await expect(
    page.getByRole('main').getByRole('heading', { name: 'SALAS' }),
  ).toBeVisible();

  // Abre a sala em destaque e entra.
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();

  // Sem sessão online ativa, cai no seletor offline.
  await expect(
    page.getByRole('main').getByRole('heading', { name: 'MODO DE JOGO' }),
  ).toBeVisible();
});

test('desistir termina a partida com vitória do adversário', async ({ page }) => {
  await enterAsGuest(page);
  await startOfflinePvp(page);

  await page.getByRole('button', { name: /Desistir/ }).click();
  await page.getByRole('button', { name: 'Sim, desistir' }).click();

  await expect(
    page.getByRole('heading', { name: 'Jogador 2 venceu!' }),
  ).toBeVisible();
});

test('tempo esgotado resulta em derrota do jogador com o relógio', async ({ page }) => {
  test.setTimeout(90_000);
  await enterAsGuest(page);
  await startOfflinePvp(page, { timeMode: 'Rápida' });

  await expect(
    page.getByRole('heading', { name: 'Jogador 2 venceu!' }),
  ).toBeVisible({ timeout: 40_000 });
});
