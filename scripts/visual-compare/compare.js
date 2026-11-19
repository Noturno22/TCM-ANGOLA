/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * Compara web (Next :3000) vs expo web (Metro :8081).
 * Screenshots: home + ecrã de jogo (tabuleiro + seleção) + overlay de fim
 * de jogo (partida CvC corre automaticamente até terminar).
 */
const { chromium } = require('@playwright/test');

const OUT = 'C:/Users/Nortuno/AppData/Local/Temp/opencode';
const TO = 45000;

async function snap(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
}

async function clickAndGo(page, selector, label) {
  const loc = page.getByText(selector).first();
  await loc.waitFor({ state: 'visible', timeout: TO });
  await loc.click();
  console.log('clicked', label);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
  ctx.setDefaultTimeout(TO);

  // ---------- WEB (referência) ----------
  const web = await ctx.newPage();
  const consoleMsgs = [];
  const onConsole = (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      const loc = msg.location();
      consoleMsgs.push(`[${type}] ${msg.text()} @ ${loc.url || ''}`);
    }
  };
  web.on('console', onConsole);
  try {
    await web.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await clickAndGo(web, 'Continuar como convidado', 'guest');
    await web.waitForTimeout(900);
    await snap(web, 'cmp-web-home');

    await clickAndGo(web, 'JOGAR OFFLINE', 'offline');
    await web.waitForTimeout(700);
    await clickAndGo(web, 'Contra o Computador', 'mode');
    await web.waitForTimeout(400);
    await clickAndGo(web, /COME.*R PARTIDA/, 'start');
    await web.waitForTimeout(1400);
    await snap(web, 'cmp-web-game');

    const board = web.getByLabel(/Tabuleiro/).first();
    if (await board.count()) {
      await board.screenshot({ path: `${OUT}/cmp-web-board.png` });
      console.log('saved cmp-web-board');
    } else {
      console.log('web board aria-label not found');
    }

    // Interação: selecionar casa 2 (peça verde P1, centro-inferior)
    try {
      const cell = web.getByLabel('casa 2, Jogador 1').first();
      await cell.waitFor({ state: 'visible', timeout: TO });
      await cell.click();
      console.log('clicked web cell casa 2');
      await web.waitForTimeout(500);
      await snap(web, 'cmp-web-board-selected');
    } catch (e) {
      console.log('web cell select FAILED:', e.message);
      await web.screenshot({ path: `${OUT}/cmp-web-cell-error.png` }).catch(() => {});
    }
  } catch (e) {
    console.error('WEB ERROR:', e.message);
    await web.screenshot({ path: `${OUT}/cmp-web-error.png` }).catch(() => {});
  }

  // ---------- EXPO WEB ----------
  const app = await ctx.newPage();
  app.on('console', onConsole);
  try {
    await app.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
    await app.waitForTimeout(7000); // bundle metro
    await snap(app, 'cmp-app-home');

    await app.goto('http://localhost:8081/offline', { waitUntil: 'domcontentloaded' });
    await app.waitForTimeout(4500);
    await clickAndGo(app, 'Contra o Computador', 'mode');
    await app.waitForTimeout(500);
    await snap(app, 'cmp-app-offline');
    await clickAndGo(app, /COME.*R PARTIDA/, 'start');
    await app.waitForTimeout(4500); // rota /game + bundle lazy
    await snap(app, 'cmp-app-game');

    const board = app.getByLabel(/Tabuleiro/).first();
    if (await board.count()) {
      await board.screenshot({ path: `${OUT}/cmp-app-board.png` });
      console.log('saved cmp-app-board');
    } else {
      console.log('app board aria-label not found');
    }

    // Interação: selecionar casa 2 (peça verde P1, centro-inferior)
    try {
      const cell = app.getByLabel('casa 2, Jogador 1').first();
      await cell.waitFor({ state: 'visible', timeout: TO });
      await cell.click();
      console.log('clicked app cell casa 2');
      await app.waitForTimeout(500);
      await snap(app, 'cmp-app-board-selected');
    } catch (e) {
      console.log('app cell select FAILED:', e.message);
      await app.screenshot({ path: `${OUT}/cmp-app-cell-error.png` }).catch(() => {});
    }
  } catch (e) {
    console.error('APP ERROR:', e.message);
    await app.screenshot({ path: `${OUT}/cmp-app-error.png` }).catch(() => {});
  }

  // ---------- OVERLAY DE FIM DE JOGO (CvC — a IA joga sozinha até terminar) ----------
  // Nota: no app, "Desistir"/"Sair" usam RN Alert (no-op no expo web), por
  // isso o fim de jogo é alcançado com uma partida CvC automática.
  async function waitForGameOver(page, prefix) {
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      const n = await page.getByText(/Posi..o final|Como foi a vi..ria/).count();
      if (n > 0) return true;
      await page.waitForTimeout(1000);
    }
    console.log(prefix, 'game-over TIMEOUT');
    return false;
  }

  async function gameoverCvc(page, prefix) {
    try {
      await page.getByLabel('Voltar').first().click();
      console.log(prefix, 'clicked Voltar');
      await page.waitForTimeout(1500);
      await clickAndGo(page, 'Computador vs Computador', prefix + ' cvc-mode');
      await page.waitForTimeout(500);
      await clickAndGo(page, /COME.*R PARTIDA/, prefix + ' start-cvc');
      const ok = await waitForGameOver(page, prefix);
      await page.waitForTimeout(600); // fade-in do overlay
      await snap(page, ok ? `cmp-${prefix}-gameover` : `cmp-${prefix}-gameover-timeout`);
    } catch (e) {
      console.error(prefix + ' GAMEOVER ERROR:', e.message);
      await page.screenshot({ path: `${OUT}/cmp-${prefix}-gameover-error.png` }).catch(() => {});
    }
  }

  await gameoverCvc(web, 'web');
  await gameoverCvc(app, 'app');

  await browser.close();
  console.log('--- console warnings/errors (' + consoleMsgs.length + ') ---');
  const seen = new Set();
  for (const m of consoleMsgs) {
    const key = m.slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(m.slice(0, 400));
  }
})();
