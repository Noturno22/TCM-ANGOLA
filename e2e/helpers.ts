import { expect, type Page } from '@playwright/test';

/**
 * Limpa o localStorage antes de cada teste para garantir que a app arranca
 * com valores por defeito (o perfil/definições são persistidos; a navegação não).
 */
export async function resetStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ambiente sem localStorage */
    }
  });
}

/** Espera que o splash avance para o ecrã de boas-vindas. */
export async function gotoWelcome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Continuar como convidado' }),
  ).toBeVisible({ timeout: 30_000 });
}

/** Entra como convidado e chega ao ecrã inicial (home). */
export async function enterAsGuest(page: Page): Promise<void> {
  await gotoWelcome(page);
  await page.getByRole('button', { name: 'Continuar como convidado' }).click();
  await expect(page.getByRole('button', { name: /JOGAR OFFLINE/ })).toBeVisible({
    timeout: 30_000,
  });
}

/** Inicia uma partida offline de 2 Jogadores (pvp) e espera pelo tabuleiro. */
export async function startOfflinePvp(
  page: Page,
  opts: { timeMode?: 'Rápida' | 'Sem relógio' } = {},
): Promise<void> {
  await page.getByRole('button', { name: /JOGAR OFFLINE/ }).click();
  await expect(
    page.getByRole('main').getByRole('heading', { name: 'MODO DE JOGO' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /2 Jogadores/ }).click();
  if (opts.timeMode) {
    await page.getByRole('button', { name: new RegExp(opts.timeMode) }).click();
  }
  await page.getByRole('button', { name: /COMEÇAR PARTIDA/ }).click();
  await expect(page.getByRole('grid', { name: /Tabuleiro/ })).toBeVisible();
}

/** Atalho para clicar numa casa do tabuleiro pelo seus aria-label. */
export function cell(page: Page, name: string) {
  return page.getByRole('gridcell', { name });
}

/** Coordenadas reais de cidades do globo (ver `Globe3D`/`globe.svg`). */
export const GLOBE_CITY = {
  lisboa: { lon: -9.1, lat: 38.7 },
  luanda: { lon: 13.2, lat: -8.8 },
} as const;

export type GlobeCity = keyof typeof GLOBE_CITY;

/**
 * Abre a sala de uma cidade "clicando" no globo 3D.
 *
 * O globo vive num iframe sandboxed e comunica com a app por `postMessage`; a
 * app valida `event.source === iframe.contentWindow`, por isso replicamos a
 * mensagem a partir do próprio iframe (não dá para a sintetizar no parent).
 */
export async function openGlobeRoom(page: Page, city: GlobeCity = 'lisboa'): Promise<void> {
  const globe = page.locator('iframe[title="Globo interativo com jogadores online"]');
  await expect(globe).toBeVisible();

  let frame = page.frames().find((f) => f.url().includes('globe.svg'));
  for (let i = 0; i < 25 && !frame; i++) {
    await page.waitForTimeout(100);
    frame = page.frames().find((f) => f.url().includes('globe.svg'));
  }
  if (!frame) throw new Error('iframe do globo não encontrado');

  const { lon, lat } = GLOBE_CITY[city];
  await frame.evaluate(
    ({ lon, lat }) => {
      window.parent.postMessage({ type: 'globe:location', lon, lat, players: 10 }, '*');
    },
    { lon, lat },
  );
}
