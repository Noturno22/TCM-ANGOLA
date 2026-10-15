'use client';

import { useEffect } from 'react';
import { useSettings } from '@/store/settings';

export function ThemeSync() {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  return null;
}
