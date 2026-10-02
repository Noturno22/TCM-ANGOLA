'use client';

import { useEffect } from 'react';
import { useSettings } from '@/store/settings';
import { setLanguage, getLanguage, t as translate, type Language } from '@/lib/i18n';

/**
 * Hook para usar o sistema de i18n nos componentes React.
 * Sincroniza o idioma com as settings e força re-render quando muda.
 */
export function useI18n() {
  const language = useSettings((s) => s.language);
  const setSetting = useSettings((s) => s.set);

  useEffect(() => {
    setLanguage(language);
  }, [language]);

  return {
    t: translate,
    lang: language,
    setLang: (l: Language) => setSetting('language', l),
  };
}
