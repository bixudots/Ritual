import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { getThemeById, type ThemeDefinition } from '../constants/themes';

const THEME_KEY = 'ritual_theme_id';

interface ThemeState {
  themeId: string;
  theme: ThemeDefinition;
  isLoaded: boolean;
  /** Persist and apply the theme. Reloads the JS bundle so that
   *  StyleSheet.create() re-evaluates with the new Colors Proxy values. */
  setTheme: (id: string) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'gotham',
  theme: getThemeById('gotham'),
  isLoaded: false,

  setTheme: async (id: string) => {
    const theme = getThemeById(id);
    set({ themeId: id, theme });
    try {
      await AsyncStorage.setItem(THEME_KEY, id);
    } catch {
      /* ignore */
    }
    // Reload the JS bundle so every StyleSheet.create() runs again
    // and picks up the new theme colors. Falls back silently if
    // Updates isn't available (e.g. Expo Go without the module).
    try {
      await Updates.reloadAsync();
    } catch {
      /* ignore — will apply on next app launch */
    }
  },

  loadTheme: async () => {
    // Gotham is the only theme — always use it.
    try {
      await AsyncStorage.setItem(THEME_KEY, 'gotham');
    } catch {
      /* ignore */
    }
    set({ themeId: 'gotham', theme: getThemeById('gotham'), isLoaded: true });
  },
}));
