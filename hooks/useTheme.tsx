import { useState, useEffect, createContext, useContext, useMemo, useCallback, ReactNode } from 'react';

export type ThemeName = 'bloomberg' | 'tokyonight' | 'nord' | 'gruvbox' | 'coffee' | 'dark-macos';

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    // Background colors
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgHover: string;
    
    // Text colors
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    
    // Accent colors
    accent: string;
    accentHover: string;
    accentActive: string;
    
    // Border colors
    borderPrimary: string;
    borderSecondary: string;
    
    // Status colors (these might stay consistent or vary)
    positive: string;
    negative: string;
    positiveLight: string;
    negativeLight: string;
    
    // Special colors
    symbolColor: string;
    headerTitleBg: string;
  };
}

export const themes: Record<ThemeName, Theme> = {
  bloomberg: {
    name: 'bloomberg',
    displayName: 'Bloomberg',
    colors: {
      bgPrimary: '#0a0a0a',
      bgSecondary: '#1a1a1a',
      bgTertiary: '#0f0f0f',
      bgHover: '#1a1a2a',
      textPrimary: '#e0e0e0',
      textSecondary: '#ccc',
      textTertiary: '#888',
      accent: '#ff8800',
      accentHover: '#ff9900',
      accentActive: '#ff7700',
      borderPrimary: '#333',
      borderSecondary: '#222',
      positive: '#00ff00',
      negative: '#ff0000',
      positiveLight: '#88ff88',
      negativeLight: '#ff8888',
      symbolColor: '#ff8800',
      headerTitleBg: '#0a0a0a',
    },
  },
  tokyonight: {
    name: 'tokyonight',
    displayName: 'Tokyo Night',
    colors: {
      bgPrimary: '#1a1b26',
      bgSecondary: '#24283b',
      bgTertiary: '#2f3549',
      bgHover: '#2f3549',
      textPrimary: '#c0caf5',
      textSecondary: '#a9b1d6',
      textTertiary: '#565f89',
      accent: '#7aa2f7',
      accentHover: '#9d7cd8',
      accentActive: '#bb9af7',
      borderPrimary: '#414868',
      borderSecondary: '#2f3549',
      positive: '#9ece6a',
      negative: '#f7768e',
      positiveLight: '#b4f9f8',
      negativeLight: '#ff9e64',
      symbolColor: '#7aa2f7',
      headerTitleBg: '#1a1b26',
    },
  },
  nord: {
    name: 'nord',
    displayName: 'Nord',
    colors: {
      bgPrimary: '#2e3440',
      bgSecondary: '#3b4252',
      bgTertiary: '#434c5e',
      bgHover: '#4c566a',
      textPrimary: '#eceff4',
      textSecondary: '#e5e9f0',
      textTertiary: '#d8dee9',
      accent: '#88c0d0',
      accentHover: '#81a1c1',
      accentActive: '#5e81ac',
      borderPrimary: '#4c566a',
      borderSecondary: '#434c5e',
      positive: '#a3be8c',
      negative: '#bf616a',
      positiveLight: '#8fbcbb',
      negativeLight: '#d08770',
      symbolColor: '#88c0d0',
      headerTitleBg: '#2e3440',
    },
  },
  gruvbox: {
    name: 'gruvbox',
    displayName: 'Gruvbox',
    colors: {
      bgPrimary: '#282828',
      bgSecondary: '#3c3836',
      bgTertiary: '#504945',
      bgHover: '#665c54',
      textPrimary: '#ebdbb2',
      textSecondary: '#d5c4a1',
      textTertiary: '#bdae93',
      accent: '#fe8019',
      accentHover: '#d65d0e',
      accentActive: '#fb4934',
      borderPrimary: '#504945',
      borderSecondary: '#3c3836',
      positive: '#b8bb26',
      negative: '#cc241d',
      positiveLight: '#98971a',
      negativeLight: '#fb4934',
      symbolColor: '#fe8019',
      headerTitleBg: '#282828',
    },
  },
  coffee: {
    name: 'coffee',
    displayName: 'Coffee',
    colors: {
      bgPrimary: '#2d1b0e',
      bgSecondary: '#3d2817',
      bgTertiary: '#4a3320',
      bgHover: '#5a3f2a',
      textPrimary: '#d4b896',
      textSecondary: '#c4a882',
      textTertiary: '#9d7f5f',
      accent: '#c17e3c',
      accentHover: '#d4904f',
      accentActive: '#b06d2b',
      borderPrimary: '#5a3f2a',
      borderSecondary: '#4a3320',
      positive: '#8b9a46',
      negative: '#c45c3e',
      positiveLight: '#a4b563',
      negativeLight: '#d67a5f',
      symbolColor: '#c17e3c',
      headerTitleBg: '#2d1b0e',
    },
  },
  'dark-macos': {
    name: 'dark-macos',
    displayName: 'Dark macOS',
    colors: {
      bgPrimary: '#0d0d0d',
      bgSecondary: '#151515',
      bgTertiary: '#1a1a1a',
      bgHover: '#252525',
      textPrimary: '#e5e5e5',
      textSecondary: '#d0d0d0',
      textTertiary: '#909090',
      accent: '#007aff',
      accentHover: '#0051d5',
      accentActive: '#0040a8',
      borderPrimary: '#2a2a2a',
      borderSecondary: '#1f1f1f',
      positive: '#30d158',
      negative: '#ff3b30',
      positiveLight: '#64de7c',
      negativeLight: '#ff6961',
      symbolColor: '#007aff',
      headerTitleBg: '#0d0d0d',
    },
  },
};

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: Record<ThemeName, Theme>;
  themeColors: Theme['colors'];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize theme from localStorage if available, otherwise default to 'bloomberg'
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as ThemeName;
      if (savedTheme && themes[savedTheme]) {
        return savedTheme;
      }
    }
    return 'bloomberg';
  });

  // Sync theme from localStorage on client-side mount (handles SSR hydration mismatch)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as ThemeName;
      if (savedTheme && themes[savedTheme] && savedTheme !== theme) {
        setThemeState(savedTheme);
      }
    }
  }, []); // Run only once on mount

  // Wrap setTheme to ensure it updates correctly
  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
  }, []);

  // Create a new object reference each time theme changes to ensure React detects the change
  const themeColors = useMemo(() => ({ ...themes[theme].colors }), [theme]);

  useEffect(() => {
    // Apply theme to document root
    const root = document.documentElement;
    
    root.style.setProperty('--bg-primary', themeColors.bgPrimary);
    root.style.setProperty('--bg-secondary', themeColors.bgSecondary);
    root.style.setProperty('--bg-tertiary', themeColors.bgTertiary);
    root.style.setProperty('--bg-hover', themeColors.bgHover);
    root.style.setProperty('--text-primary', themeColors.textPrimary);
    root.style.setProperty('--text-secondary', themeColors.textSecondary);
    root.style.setProperty('--text-tertiary', themeColors.textTertiary);
    root.style.setProperty('--accent', themeColors.accent);
    root.style.setProperty('--accent-hover', themeColors.accentHover);
    root.style.setProperty('--accent-active', themeColors.accentActive);
    root.style.setProperty('--border-primary', themeColors.borderPrimary);
    root.style.setProperty('--border-secondary', themeColors.borderSecondary);
    root.style.setProperty('--positive', themeColors.positive);
    root.style.setProperty('--negative', themeColors.negative);
    root.style.setProperty('--positive-light', themeColors.positiveLight);
    root.style.setProperty('--negative-light', themeColors.negativeLight);
    root.style.setProperty('--symbol-color', themeColors.symbolColor);
    root.style.setProperty('--header-title-bg', themeColors.headerTitleBg);
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme, themeColors]);

  // Don't memoize - always create new object to ensure React detects changes
  const value = {
    theme,
    setTheme,
    themes,
    themeColors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

