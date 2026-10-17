import { expect, test } from '@playwright/test';
import { enterAsGuest, gotoWelcome, openGlobeRoom, resetStorage, startOfflinePvp } from './helpers';

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

  // Abre a sala de Lisboa (Portugal) a partir do globo e entra.
  await openGlobeRoom(page, 'lisboa');
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

test('globo das salas: aproximar, afastar e repor o zoom', async ({ page }) => {
  test.setTimeout(90_000);
  await enterAsGuest(page);
  await page.getByRole('button', { name: /JOGAR ONLINE/ }).click();
  await expect(
    page.getByRole('main').getByRole('heading', { name: 'SALAS' }),
  ).toBeVisible();

  let frame = page.frames().find((f) => f.url().includes('globe.svg'));
  for (let i = 0; i < 25 && !frame; i++) {
    await page.waitForTimeout(100);
    frame = page.frames().find((f) => f.url().includes('globe.svg'));
  }
  if (!frame) throw new Error('iframe do globo não encontrado');
  const globe = frame;

  const state = () =>
    globe.evaluate(() => {
      const g = (window as unknown as { Globo?: { estado(): { z: number } } }).Globo;
      const svg = document.querySelector('svg');
      return { z: g ? g.estado().z : -1, viewBox: svg?.getAttribute('viewBox') ?? '' };
    });

  await expect.poll(async () => (await state()).z).toBe(1);

  // Botões do parent (postMessage) aproximam e alteram o viewBox.
  await page.getByRole('button', { name: 'Aproximar' }).click();
  await expect.poll(async () => (await state()).z).toBeGreaterThan(1);
  expect((await state()).viewBox).not.toBe('0 0 400 400');

  // O scroll dentro do iframe (sandboxed) também aproxima.
  const beforeWheel = (await state()).z;
  await globe.evaluate(() => {
    document.documentElement.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -120,
        clientX: 120,
        clientY: 140,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect.poll(async () => (await state()).z).toBeGreaterThan(beforeWheel);

  // "Repor zoom" volta ao estado inicial.
  await page.getByRole('button', { name: 'Repor zoom' }).click();
  await expect.poll(async () => (await state()).z).toBe(1);
  expect((await state()).viewBox).toBe('0 0 400 400');
});
