// Flags de servidor (Edge Functions) — ponto ÚNICO de verdade (D6).
//
// `REAL_MONEY_ENABLED` é a chave-mestra do subsistema de dinheiro real
// (depósitos, KYC, levantamentos). Por omissão é `false`; nesse estado,
// TODAS as funções de pagamento respondem 403 `real_money_disabled` antes de
// tocar em qualquer tabela ou chamar um PSP.
//
// Segredos das funções:
//   supabase secrets set --project-ref <REF> \
//     REAL_MONEY_ENABLED=false \
//     PAYOUTS_ENABLED=false

/** Chave-mestra do dinheiro real (default `false`). */
export function realMoneyEnabled(env: (key: string) => string | undefined = Deno.env.get): boolean {
  return env('REAL_MONEY_ENABLED') === 'true';
}

/**
 * Levantamentos: requerem a chave-mestra ligada E `PAYOUTS_ENABLED=true`.
 * O enquadramento legal (BNA, contrato PSP, KYC/AML) tem de estar resolvido.
 */
export function payoutsEnabled(env: (key: string) => string | undefined = Deno.env.get): boolean {
  return realMoneyEnabled(env) && env('PAYOUTS_ENABLED') === 'true';
}
