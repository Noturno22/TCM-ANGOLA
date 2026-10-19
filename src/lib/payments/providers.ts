/**
 * Catálogo de providers do lado cliente (APENAS apresentação).
 *
 * A criação real do checkout e a verificação de webhooks acontecem
 * exclusivamente nas Edge Functions (`create-deposit-intent` / `psp-webhook`).
 * Este ficheiro só diz à UI que métodos mostrar e se estão disponíveis.
 *
 * Que providers ficam ativos é controlado por
 * `NEXT_PUBLIC_PAYMENTS_ENABLED_PROVIDERS` (lista separada por vírgulas).
 * Por omissão só o `mock` (sandbox) está ativo — nunca ativar `mock` em produção.
 */
import { REAL_MONEY_ENABLED } from '@/lib/config/flags';
import type { Currency, PaymentProviderId } from './types';

export interface ProviderInfo {
  id: PaymentProviderId;
  label: string;
  description: string;
  currencies: Currency[];
  /** `false` = aparece na UI mas desativado (sem credenciais/contrato). */
  enabled: boolean;
}

const ENABLED_IDS: string[] = (process.env.NEXT_PUBLIC_PAYMENTS_ENABLED_PROVIDERS ?? 'mock')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isEnabled(id: PaymentProviderId): boolean {
  return ENABLED_IDS.includes(id);
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'wipay',
    label: 'WiPay',
    description: 'Multicaixa Express, Referência, é-Kwanza, PayPay, Unitel Money, Afrimoney.',
    currencies: ['AOA'],
    enabled: isEnabled('wipay'),
  },
  {
    id: 'appypay',
    label: 'AppyPay',
    description: 'Multicaixa Express, Referência e carteiras móveis.',
    currencies: ['AOA'],
    enabled: isEnabled('appypay'),
  },
  {
    id: 'bitpay',
    label: 'BitPay',
    description: 'Referência Multicaixa e Multicaixa Express — sandbox até à certificação EMIS.',
    currencies: ['AOA'],
    enabled: isEnabled('bitpay'),
  },
  {
    id: 'stripe',
    label: 'Cartão internacional (Stripe)',
    description: 'Visa/Mastercard internacionais — requer entidade fora de Angola.',
    currencies: ['USD'],
    enabled: isEnabled('stripe'),
  },
  {
    id: 'mock',
    label: 'Sandbox (teste)',
    description: 'Provider de teste — não move dinheiro real.',
    currencies: ['AOA'],
    enabled: isEnabled('mock'),
  },
];

/** Devolve o catálogo de providers que suportam a moeda indicada. */
export function providersForCurrency(currency: Currency): ProviderInfo[] {
  return PROVIDERS.filter((p) => p.currencies.includes(currency));
}

/**
 * Providers utilizáveis agora (suportam a moeda E estão ativos).
 *
 * Devolve sempre `[]` enquanto a chave-mestra `REAL_MONEY_ENABLED` estiver
 * desligada (D6) — nenhum provider de dinheiro real fica disponível.
 */
export function enabledProvidersForCurrency(currency: Currency): ProviderInfo[] {
  if (!REAL_MONEY_ENABLED) return [];
  return providersForCurrency(currency).filter((p) => p.enabled);
}

export function getProviderInfo(id: PaymentProviderId): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
