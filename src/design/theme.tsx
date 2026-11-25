import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import type { ThemePreference } from '@/domain/types';

export type Palette = {
  scheme: 'light' | 'dark';
  bg: string;
  frame: string;
  card: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  coral: string;
  coralSoft: string;
  danger: string;
  dangerSoft: string;
  warn: string;
  warnSoft: string;
  heroStart: string;
  heroEnd: string;
  heroText: string;
  heroMuted: string;
  ring: string;
  ringTrack: string;
  input: string;
  overlay: string;
  shadow: string;
};

const light: Palette = {
  scheme: 'light',
  bg: '#F3EEE6',
  frame: '#E4DDD2',
  card: '#FFFCF8',
  ink: '#1C1915',
  muted: '#5E584E',
  faint: '#8A8378',
  line: '#E4DCD0',
  accent: '#0E6B4F',
  accentInk: '#F4FBF7',
  accentSoft: '#E5F4EE',
  coral: '#C4622D',
  coralSoft: '#F8E7DC',
  danger: '#9F2D32',
  dangerSoft: '#F8E4E2',
  warn: '#8A5A12',
  warnSoft: '#F8EBD4',
  heroStart: '#145C45',
  heroEnd: '#0C3428',
  heroText: '#F6F1E8',
  heroMuted: '#D5E4DC',
  ring: '#E7C07A',
  ringTrack: 'rgba(246, 241, 232, 0.28)',
  input: '#F7F3EC',
  overlay: 'rgba(28, 25, 21, 0.45)',
  shadow: 'rgba(40, 32, 22, 0.08)',
};

const dark: Palette = {
  scheme: 'dark',
  bg: '#100E0C',
  frame: '#070605',
  card: '#1C1916',
  ink: '#F6F1E8',
  muted: '#C2BAAE',
  faint: '#8F877C',
  line: '#322C26',
  accent: '#8FE0C0',
  accentInk: '#10241C',
  accentSoft: '#1A3330',
  coral: '#F0A36A',
  coralSoft: '#3A2A22',
  danger: '#FFB0AA',
  dangerSoft: '#3A2222',
  warn: '#E7C07A',
  warnSoft: '#332A1C',
  heroStart: '#1C3F34',
  heroEnd: '#10241E',
  heroText: '#F6F1E8',
  heroMuted: '#C9DDD4',
  ring: '#E7C07A',
  ringTrack: 'rgba(246, 241, 232, 0.16)',
  input: '#171410',
  overlay: 'rgba(0, 0, 0, 0.55)',
  shadow: 'rgba(0, 0, 0, 0.35)',
};

type ThemeValue = {
  theme: Palette;
  preference: ThemePreference;
  reduceMotion: boolean;
  fontsReady: boolean;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({
  preference,
  fontsReady,
  children,
}: {
  preference: ThemePreference;
  fontsReady: boolean;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduceMotion(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const theme = useMemo(() => {
    const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    return scheme === 'dark' ? dark : light;
  }, [preference, system]);

  const value = useMemo(
    () => ({ theme, preference, reduceMotion, fontsReady }),
    [fontsReady, preference, reduceMotion, theme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
