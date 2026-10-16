/** Utilizadores de teste (efémeros) usados nos testes e2e online. */

export const TEST_USER_1 = {
  email: process.env.E2E_USER1_EMAIL ?? 'e2e-player-1@tira.test',
  password: process.env.E2E_TEST_PASSWORD ?? 'E2e-Test-Passw0rd!',
};

export const TEST_USER_2 = {
  email: process.env.E2E_USER2_EMAIL ?? 'e2e-player-2@tira.test',
  password: process.env.E2E_TEST_PASSWORD ?? 'E2e-Test-Passw0rd!',
};

export const TEST_USERS = [TEST_USER_1, TEST_USER_2];
