import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { applyThemeProgress } from '../utils/themeEngine.js';

const ThemeContext = createContext({
  themeMode: 'dark', // 'dark' | 'light' | 'mid' | 'system'
  themeProgress: 0,
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeModeState] = useState(() => {
    return localStorage.getItem('zl-theme-mode') || 'dark';
  });

  const [themeProgress, setThemeProgressState] = useState(() => {
    const saved = localStorage.getItem('themeProgress');
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) return parsed;
    }
    // Check system preference default
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 100;
    }
    return 0;
  });

  const isDark = themeProgress <= 50;
  const transitionTimerRef = useRef(null);

  // Trigger smooth transition class on root during toggle
  const triggerTransition = useCallback(() => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 280);
  }, []);

  const setProgressInternal = useCallback((progress, mode = null, animate = true) => {
    const p = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
    if (animate) triggerTransition();

    setThemeProgressState(p);
    applyThemeProgress(p);

    localStorage.setItem('themeProgress', String(p));
    localStorage.setItem('zl-theme', p > 50 ? 'light' : 'dark');

    if (mode) {
      setThemeModeState(mode);
      localStorage.setItem('zl-theme-mode', mode);
    } else {
      const deduced = p === 0 ? 'dark' : p === 100 ? 'light' : p === 50 ? 'mid' : 'custom';
      setThemeModeState(deduced);
      localStorage.setItem('zl-theme-mode', deduced);
    }
  }, [triggerTransition]);

  // Public API: setTheme
  const setTheme = useCallback((target) => {
    if (typeof target === 'number') {
      setProgressInternal(target);
      return;
    }

    if (target === 'dark') {
      setProgressInternal(0, 'dark');
    } else if (target === 'mid') {
      setProgressInternal(50, 'mid');
    } else if (target === 'light') {
      setProgressInternal(100, 'light');
    } else if (target === 'system') {
      const prefersLight = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      setProgressInternal(prefersLight ? 100 : 0, 'system');
    }
  }, [setProgressInternal]);

  // Public API: toggleTheme (between dark and light)
  const toggleTheme = useCallback(() => {
    const nextProgress = themeProgress <= 50 ? 100 : 0;
    setProgressInternal(nextProgress, nextProgress === 100 ? 'light' : 'dark', true);
  }, [themeProgress, setProgressInternal]);

  // Apply on initial mount
  useEffect(() => {
    applyThemeProgress(themeProgress);
  }, []);

  // Listen to system preference changes when in 'system' mode
  useEffect(() => {
    if (themeMode !== 'system' || typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      setProgressInternal(e.matches ? 100 : 0, 'system', true);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode, setProgressInternal]);

  // Listen to storage events across tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'themeProgress' && e.newValue !== null) {
        const newP = parseInt(e.newValue, 10);
        if (!isNaN(newP)) {
          setThemeProgressState(newP);
          applyThemeProgress(newP);
        }
      }
      if (e.key === 'zl-theme-mode' && e.newValue) {
        setThemeModeState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Listen to custom zl-theme-change events from legacy callers
  useEffect(() => {
    const handleCustom = (e) => {
      if (e.detail && typeof e.detail.progress === 'number') {
        if (e.detail.progress !== themeProgress) {
          setThemeProgressState(e.detail.progress);
        }
      }
    };
    window.addEventListener('zl-theme-change', handleCustom);
    return () => window.removeEventListener('zl-theme-change', handleCustom);
  }, [themeProgress]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        themeProgress,
        isDark,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
