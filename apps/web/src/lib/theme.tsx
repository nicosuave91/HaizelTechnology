'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type ThemeMode = 'light' | 'dark';
type Density = 'compact' | 'cozy' | 'comfortable';

type ThemeContextValue = {
  mode: ThemeMode;
  density: Density;
  setMode: (mode: ThemeMode) => void;
  setDensity: (density: Density) => void;
  toggleMode: () => void;
};

const STORAGE_KEY_THEME = 'haizel.theme.mode';
const STORAGE_KEY_DENSITY = 'haizel.theme.density';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const densityAttribute = (density: Density) =>
  density === 'cozy' ? 'compact' : density;

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [density, setDensityState] = useState<Density>('comfortable');

  useEffect(() => {
    const storedMode = window.localStorage.getItem(STORAGE_KEY_THEME) as ThemeMode | null;
    const storedDensity = window.localStorage.getItem(STORAGE_KEY_DENSITY) as Density | null;
    if (storedMode) {
      setModeState(storedMode);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setModeState('dark');
    }
    if (storedDensity) {
      setDensityState(storedDensity);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    window.localStorage.setItem(STORAGE_KEY_THEME, mode);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-density', densityAttribute(density));
    window.localStorage.setItem(STORAGE_KEY_DENSITY, density);
  }, [density]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(
    () => ({ mode, density, setMode, setDensity, toggleMode }),
    [mode, density, setMode, setDensity, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
