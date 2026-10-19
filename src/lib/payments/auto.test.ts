import { describe, expect, it } from 'vitest';
import { autoErrorMessage, normalizeAutoPhone, parseCheckoutUrl } from './auto';

describe('normalizeAutoPhone', () => {
  it('aceita 9 dígitos começados por 9', () => {
    expect(normalizeAutoPhone('923456789')).toBe('923456789');
  });

  it('remove espaços, traços e prefixo +244', () => {
    expect(normalizeAutoPhone('923 456 789')).toBe('923456789');
    expect(normalizeAutoPhone('+244 923 456 789')).toBe('244923456789');
  });

  it('rejeita números inválidos', () => {
    expect(normalizeAutoPhone('')).toBeNull();
    expect(normalizeAutoPhone('123456789')).toBeNull();
    expect(normalizeAutoPhone('92345678')).toBeNull();
    expect(normalizeAutoPhone('9234567890')).toBeNull();
    expect(normalizeAutoPhone('abc')).toBeNull();
  });
});

describe('parseCheckoutUrl', () => {
  it('lê referência (ref) com entidade', () => {
    const url =
      'https://tcm.app/?deposit=return&psp=appypay&intent=uuid-1&method=ref&entity=00512&reference=212345678';
    expect(parseCheckoutUrl(url)).toEqual({
      intentId: 'uuid-1',
      method: 'ref',
      entity: '00512',
      reference: '212345678',
      phoneMasked: null,
    });
  });

  it('lê Multicaixa Express (gpo) com telefone mascarado', () => {
    const url = '/?psp=appypay&intent=uuid-2&method=gpo&phone_masked=923*****89';
    expect(parseCheckoutUrl(url)).toEqual({
      intentId: 'uuid-2',
      method: 'gpo',
      entity: null,
      reference: null,
      phoneMasked: '923*****89',
    });
  });

  it('ignora URLs sem âncora appypay ou malformados', () => {
    expect(parseCheckoutUrl(null)).toBeNull();
    expect(parseCheckoutUrl('')).toBeNull();
    expect(parseCheckoutUrl('https://tcm.app/?deposit=return')).toBeNull();
    expect(parseCheckoutUrl('https://tcm.app/?psp=appypay&intent=uuid-3')).toBeNull();
    expect(parseCheckoutUrl('https://tcm.app/?psp=appypay&method=ref')).toBeNull();
    expect(parseCheckoutUrl('não é um url ::::')).toBeNull();
  });
});

describe('autoErrorMessage', () => {
  it('traduz códigos conhecidos para português', () => {
    expect(autoErrorMessage(new Error('appypay_not_configured'))).toMatch(/credenciais/);
    expect(autoErrorMessage(new Error('phone_invalid: x'))).toMatch(/Telemóvel inválido/);
    expect(autoErrorMessage(new Error('checkout_failed: detail do PSP'))).toMatch(/recusou/);
  });

  it('cai para mensagem genérica em erros desconhecidos', () => {
    expect(autoErrorMessage(new Error('algo_estranho'))).toBe('Falha ao iniciar o pagamento.');
    expect(autoErrorMessage('boom')).toBe('Falha ao iniciar o pagamento.');
  });
});
