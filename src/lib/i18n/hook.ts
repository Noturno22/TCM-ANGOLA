'use client';

import { useSettings } from '@/store/settings';
import { setLanguage, t as translate, type Language } from '@/lib/i18n';

/**
 * Hook para usar o sistema de i18n nos componentes React.
 * Sincroniza o idioma com as settings antes do render para não haver lag.
 */
export function useI18n() {
  const language = useSettings((s) => s.language);
  const setSetting = useSettings((s) => s.set);

  setLanguage(language);

  return {
    t: translate,
    lang: language,
    setLang: (l: Language) => setSetting('language', l),
  };
}
