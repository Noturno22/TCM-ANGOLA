/**
 * e2e online — depósitos e levantamentos manuais (fluxo do utilizador).
 *
 * Pré-requisitos: `REAL_MONEY_ENABLED` ligado no backend e utilizadores de
 * teste criados pelo `globalSetup` (ver `playwright.online.config.ts`).
 */
import { expect, test, type Page } from '@playwright/test';
import { signIn } from './auth';
import { TEST_USER_1 } from './users';

/** PNG 1×1 válido (mínimo para o upload do comprovativo). */
const PROOF_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Abre o ecrã de dinheiro real, na tab pedida, a partir do Início. */
async function openMoney(page: Page, which: 'deposit' | 'withdraw'): Promise<void> {
  await page.getByRole('button', { name: 'Apostas' }).click();
  await expect(page.getByRole('heading', { name: 'Dinheiro real' })).toBeVisible();

  const label = which === 'deposit' ? 'Depositar dinheiro real' : 'Levantar dinheiro real';
  await page.getByRole('button', { name: label }).click();

  const tab = which === 'deposit' ? 'Depositar' : 'Levantar';
  await expect(page.getByRole('tab', { name: tab })).toBeVisible();
}

test.describe('Dinheiro real — fluxo manual', () => {
  test('depósito com comprovativo fica pendente de revisão', async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
    await openMoney(page, 'deposit');

    // Método padrão é Rodotpay (AOA); valor mínimo AOA = 5000.
    await page.getByLabel('Valor a depositar').fill('5000');
    await page.getByRole('button', { name: 'Continuar para envio de comprovativo' }).click();

    // Modal de pagamento → escolher e submeter o comprovativo.
    await expect(page.getByRole('dialog').getByText('Submeter comprovativo')).toBeVisible();
    await page.setInputFiles('#proof-input', {
      name: 'proof.png',
      mimeType: 'image/png',
      buffer: PROOF_PNG,
    });
    await page.getByRole('button', { name: 'Submeter comprovativo' }).click();

    // Confirmação.
    await expect(page.getByRole('heading', { name: 'Comprovativo enviado!' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Entendi' }).click();

    // Movimento pendente no histórico.
    await expect(page.getByText('Pendente', { exact: true })).toBeVisible();
    await expect(page.getByText(/Depósito · rodotpay/)).toBeVisible();
  });

  test('levantamento valida saldo insuficiente', async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page, TEST_USER_1.email, TEST_USER_1.password);
    await openMoney(page, 'withdraw');

    // Utilizador novo: saldo real 0. 6000 AOA está dentro dos limites mas acima do saldo.
    await page.getByLabel('Valor a levantar').fill('6000');
    await expect(page.getByText(/Saldo insuficiente/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pedir levantamento' })).toBeDisabled();
  });
});
