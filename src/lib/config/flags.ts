/**
 * Flags de funcionalidade — ponto ÚNICO de verdade no cliente (D6).
 *
 * `REAL_MONEY_ENABLED` é a chave-mestra do subsistema de dinheiro real
 * (depósitos, KYC, levantamentos). Por omissão é `false` e, nesse estado,
 * NENHUM caminho de dinheiro real fica ativo: a UI mostra apenas um aviso
 * "em breve" e as chamadas ao backend são bloqueadas antes de saírem.
 *
 * Nomes das variáveis de ambiente:
 *   * `NEXT_PUBLIC_REAL_MONEY_ENABLED` — chave-mestra (cliente). Default: `false`.
 *   * `NEXT_PUBLIC_PAYOUTS_ENABLED`    — sub-flag dos levantamentos na UI.
 *     Só conta se a chave-mestra estiver ligada.
 */

export interface RealMoneyFlags {
  /** Chave-mestra do dinheiro real. */
  realMoneyEnabled: boolean;
  /** Levantamentos visíveis na UI (requer a chave-mestra ligada). */
  payoutsEnabled: boolean;
}

/**
 * Resolve as flags a partir de valores explícitos (função pura, para testes).
 * Considera `true` apenas a string exata `"true"`.
 */
export function resolveRealMoneyFlags(input: {
  realMoney?: string | undefined;
  payouts?: string | undefined;
}): RealMoneyFlags {
  const realMoneyEnabled = input.realMoney === 'true';
  return {
    realMoneyEnabled,
    payoutsEnabled: realMoneyEnabled && input.payouts === 'true',
  };
}

// As referências literais a `process.env.NEXT_PUBLIC_*` permitem ao Next.js
// inlinar os valores em tempo de build no bundle do browser.
export const REAL_MONEY_FLAGS = resolveRealMoneyFlags({
  realMoney: process.env.NEXT_PUBLIC_REAL_MONEY_ENABLED,
  payouts: process.env.NEXT_PUBLIC_PAYOUTS_ENABLED,
});

/** Chave-mestra do dinheiro real (default `false`). */
export const REAL_MONEY_ENABLED = REAL_MONEY_FLAGS.realMoneyEnabled;

/** Levantamentos visíveis na UI (chave-mestra + sub-flag). */
export const PAYOUTS_UI_ENABLED = REAL_MONEY_FLAGS.payoutsEnabled;

/** Erro devolvido quando se tenta usar dinheiro real com a flag desligada. */
export const REAL_MONEY_DISABLED_ERROR = 'dinheiro_real_desativado';
