'use client';

import { useState, useEffect, useEffectEvent } from 'react';
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

  // Using useEffectEvent to avoid lint warnings about setState in effect
  const onSetDark = useEffectEvent((value: boolean) => {
    setIsDark(value);
  });

  useEffect(() => {
    if (theme === 'dark') {
      onSetDark(true);
    } else if (theme === 'light') {
      onSetDark(false);
    } else {
      // theme === 'system' - check actual system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      onSetDark(mediaQuery.matches);

      // Listen for system theme changes
      const handler = (e: MediaQueryListEvent) => onSetDark(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  return isDark;
}
