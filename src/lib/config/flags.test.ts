import { describe, expect, it } from 'vitest';
import { resolveRealMoneyFlags } from './flags';

describe('resolveRealMoneyFlags', () => {
  it('desliga tudo por omissão (sem variáveis)', () => {
    expect(resolveRealMoneyFlags({})).toEqual({
      realMoneyEnabled: false,
      payoutsEnabled: false,
    });
  });

  it('só aceita a string exata "true" para a chave-mestra', () => {
    for (const value of ['1', 'yes', 'TRUE', 'True', ' true', '', undefined]) {
      expect(resolveRealMoneyFlags({ realMoney: value }).realMoneyEnabled).toBe(false);
    }
    expect(resolveRealMoneyFlags({ realMoney: 'true' }).realMoneyEnabled).toBe(true);
  });

  it('não ativa levantamentos com a chave-mestra desligada', () => {
    expect(
      resolveRealMoneyFlags({ realMoney: 'false', payouts: 'true' }).payoutsEnabled,
    ).toBe(false);
  });

  it('ativa levantamentos apenas com a chave-mestra ligada', () => {
    expect(
      resolveRealMoneyFlags({ realMoney: 'true', payouts: 'true' }).payoutsEnabled,
    ).toBe(true);
    expect(
      resolveRealMoneyFlags({ realMoney: 'true', payouts: 'false' }).payoutsEnabled,
    ).toBe(false);
  });
});
