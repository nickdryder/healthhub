import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@health_hub_theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  primary: string;
  primaryLight: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;
  white: string;
  success: string;
  error: string;
  warning: string;
}

const lightColors: ThemeColors = {
  primary: '#6366F1',
  primaryLight: '#818CF8',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  white: '#FFFFFF',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
};

const darkColors: ThemeColors = {
  primary: '#818CF8',
  primaryLight: '#A5B4FC',
  background: '#111827',
  card: '#1F2937',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  border: '#374151',
  gray50: '#1F2937',
  gray100: '#374151',
  gray200: '#4B5563',
  gray300: '#6B7280',
  gray400: '#9CA3AF',
  gray500: '#D1D5DB',
  gray600: '#E5E7EB',
  gray700: '#F3F4F6',
  gray800: '#F9FAFB',
  gray900: '#FFFFFF',
  white: '#1F2937',
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',
};

interface ThemeContextType {
  isDark: boolean;
  themeMode: ThemeMode;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        setThemeModeState(saved as ThemeMode);
      }
      setIsLoaded(true);
    });
  }, []);

  const isDark = themeMode === 'system' 
    ? systemScheme === 'dark' 
    : themeMode === 'dark';

  const colors = isDark ? darkColors : lightColors;

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_KEY, mode);
  };

  const toggleDarkMode = () => {
    const newMode = isDark ? 'light' : 'dark';
    setThemeMode(newMode);
  };

  if (!isLoaded) return null;

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, colors, setThemeMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
