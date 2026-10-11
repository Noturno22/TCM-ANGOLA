/**
 * Hook de i18n — PT-only (sem settings de idioma no mobile).
 * Devolve `t` tipado (chaves do dicionário PT).
 */
import { t, type I18nKey, type I18nVars } from './index';

export interface UseTResult {
  t: (key: I18nKey, vars?: I18nVars) => string;
}

export function useT(): UseTResult {
  return { t };
}
