// The Ritual - Dynamic Theme System
// Colors are reactive — they read from the theme store at call time

import { useThemeStore } from '../stores/theme-store';
import { getThemeById, type ThemeColors } from './themes';

// ─── Reactive Colors proxy ───────────────────────────────────
// Every property access reads the current theme from the store.
// This lets all existing `Colors.xxx` references auto-update.
function createColorsProxy(): ThemeColors {
  const handler: ProxyHandler<ThemeColors> = {
    get(_target, prop: string) {
      const state = useThemeStore.getState();
      const colors = state.theme.colors;
      return (colors as any)[prop];
    },
  };
  // Use ember as the base target (proxy intercepts all gets)
  return new Proxy(getThemeById('ember').colors as ThemeColors, handler);
}

export const Colors = createColorsProxy();

// ─── Fonts (unchanged across themes) ─────────────────────────
export const Fonts = {
  headline: 'Manrope',
  headlineBold: 'Manrope-Bold',
  headlineExtraBold: 'Manrope-ExtraBold',
  body: 'Inter',
  bodyMedium: 'Inter-Medium',
  bodySemiBold: 'Inter-SemiBold',
  bodyBold: 'Inter-Bold',
  label: 'Inter',
} as const;

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
  '5xl': 40,
  '6xl': 48,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

// ─── Reactive Shadows ────────────────────────────────────────
// Shadows reference Colors, which are now dynamic.
// We use getters so they pick up the current theme.
export const Shadows = {
  get streakGlow() {
    return {
      shadowColor: Colors.primaryContainer,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 8,
    };
  },
  get completionGlow() {
    return {
      shadowColor: Colors.secondaryContainer,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 8,
    };
  },
  get xpGlow() {
    return {
      shadowColor: Colors.tertiary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 6,
    };
  },
  cardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  navBarShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  get fabShadow() {
    return {
      shadowColor: Colors.primaryContainer,
      shadowOffset: { width: 0, height: 15 },
      shadowOpacity: 0.4,
      shadowRadius: 30,
      elevation: 15,
    };
  },
};

// ─── Reactive Gradients ──────────────────────────────────────
export const Gradients = {
  get primaryProgress() {
    return [Colors.primary, Colors.primaryContainer] as const;
  },
  get tertiaryProgress() {
    return [Colors.tertiary, Colors.tertiaryContainer] as const;
  },
  get backgroundTonal() {
    return [Colors.background, Colors.surfaceContainerLow] as const;
  },
  get navBarBg() {
    const bg = Colors.background;
    return [`${bg}E6`, `${bg}E6`] as const;
  },
};
