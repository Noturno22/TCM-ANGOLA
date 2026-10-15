import { describe, expect, it } from 'vitest';
import {
  ageFromBirthdate,
  isAdultBirthdate,
  mapAgeGate,
  maxBirthdateForAdult,
  MIN_BET_AGE,
} from './age';

const NOW = new Date('2026-10-15T00:00:00Z');

describe('ageFromBirthdate', () => {
  it('conta anos completos', () => {
    expect(ageFromBirthdate('2000-10-15', NOW)).toBe(26);
    expect(ageFromBirthdate('1996-10-15', NOW)).toBe(30);
  });

  it('não conta o ano se o aniversário ainda não passou', () => {
    expect(ageFromBirthdate('2008-10-16', NOW)).toBe(17);
    expect(ageFromBirthdate('2008-10-15', NOW)).toBe(18);
  });

  it('devolve -1 para data ausente ou inválida', () => {
    expect(ageFromBirthdate(null, NOW)).toBe(-1);
    expect(ageFromBirthdate(undefined, NOW)).toBe(-1);
    expect(ageFromBirthdate('nao-e-data', NOW)).toBe(-1);
  });
});

describe('isAdultBirthdate', () => {
  it('é adulto a partir dos 18 anos, exatamente', () => {
    expect(isAdultBirthdate('2008-10-15', NOW)).toBe(true);
    expect(MIN_BET_AGE).toBe(18);
  });

  it('é menor um dia antes de fazer 18', () => {
    expect(isAdultBirthdate('2008-10-16', NOW)).toBe(false);
  });

  it('sem data não é adulto', () => {
    expect(isAdultBirthdate(null, NOW)).toBe(false);
    expect(isAdultBirthdate(undefined, NOW)).toBe(false);
  });
});

describe('maxBirthdateForAdult', () => {
  it('é hoje menos 18 anos', () => {
    expect(maxBirthdateForAdult(NOW)).toBe('2008-10-15');
  });
});

describe('mapAgeGate', () => {
  it('mapeia a resposta completa', () => {
    expect(
      mapAgeGate({ has_birthdate: true, birthdate: '1990-01-01', is_adult: true }),
    ).toEqual({ hasBirthdate: true, birthdate: '1990-01-01', isAdult: true });
  });

  it('sem data de nascimento nunca é adulto', () => {
    expect(mapAgeGate({ has_birthdate: false, birthdate: null, is_adult: false })).toEqual({
      hasBirthdate: false,
      birthdate: null,
      isAdult: false,
    });
  });

  it('has_birthdate=true com birthdate nulo conta como ausente', () => {
    expect(mapAgeGate({ has_birthdate: true, is_adult: true })).toEqual({
      hasBirthdate: false,
      birthdate: null,
      isAdult: true,
    });
  });
});
