import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { ThemePreference } from '../types';

type ThemeMode = 'light' | 'dark';

export type AppColors = {
  mode: ThemeMode;
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  secondary: string;
  tabInactive: string;
};

const LIGHT_COLORS: AppColors = {
  mode: 'light',
  background: '#F8FAFC',
  surface: '#FFF',
  surfaceMuted: '#EEF6F8',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  primary: '#0F4C81',
  secondary: '#14B8A6',
  tabInactive: '#94A3B8',
};

const DARK_COLORS: AppColors = {
  mode: 'dark',
  background: '#07111F',
  surface: '#0E1B2B',
  surfaceMuted: '#132A3D',
  text: '#E6EEF8',
  textMuted: '#9FB0C3',
  border: '#20364B',
  primary: '#6DB7E8',
  secondary: '#2DD4BF',
  tabInactive: '#728296',
};

type ThemeContextValue = {
  colors: AppColors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT_COLORS,
  preference: 'system',
  setPreference: () => undefined,
});

export function AppThemeProvider({
  children,
  initialPreference = 'system',
}: {
  children: ReactNode;
  initialPreference?: ThemePreference;
}) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);

  const colors = useMemo(() => {
    const mode: ThemeMode = preference === 'system'
      ? systemScheme === 'dark' ? 'dark' : 'light'
      : preference;
    return mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  }, [preference, systemScheme]);

  return (
    <ThemeContext.Provider value={{ colors, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
