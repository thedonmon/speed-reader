'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme-provider';

/**
 * Hook that returns whether dark mode is currently active.
 * Handles 'system' theme by checking the actual system preference.
 * 
 * @returns boolean - true if dark mode is active, false otherwise
 */
export function useIsDarkMode(): boolean {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      setIsDark(true);
    } else if (theme === 'light') {
      setIsDark(false);
    } else {
      // theme === 'system' - check actual system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDark(mediaQuery.matches);

      // Listen for system theme changes
      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  return isDark;
}
