/**
 * Hook de i18n mobile — sincroniza o idioma persistido nas settings com t().
 * Devolve `t` tipado (chaves do dicionário PT) e o idioma atual.
 */
import { useSettings } from '@/store/settings';
import { setLanguage, t as translate, type I18nKey, type I18nVars } from './index';

export interface UseTResult {
  t: (key: I18nKey, vars?: I18nVars) => string;
  lang: string;
}

export function useT(): UseTResult {
  const language = useSettings((s) => s.language);
  setLanguage(language);
  return { t: translate, lang: language };
}
