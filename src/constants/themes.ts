// ═══════════════════════════════════════════════════════════════
// Ritual — Theme Collection
// ═══════════════════════════════════════════════════════════════

export type ThemeColors = {
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;
  primaryFixedDim: string;
  primaryFixed: string;
  onPrimaryFixed: string;
  inversePrimary: string;

  secondary: string;
  secondaryContainer: string;
  onSecondary: string;
  onSecondaryContainer: string;
  secondaryFixedDim: string;
  secondaryFixed: string;

  tertiary: string;
  tertiaryContainer: string;
  onTertiary: string;
  onTertiaryContainer: string;

  error: string;
  errorContainer: string;
  onError: string;
  onErrorContainer: string;

  background: string;
  surface: string;
  surfaceDim: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceVariant: string;
  surfaceBright: string;

  onBackground: string;
  onSurface: string;
  onSurfaceVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;

  outline: string;
  outlineVariant: string;

  orange500: string;
  zinc400: string;
  zinc500: string;
  zinc600: string;
  zinc700: string;
  zinc800: string;
  white: string;
  transparent: string;
};

export type ThemeDefinition = {
  id: string;
  name: string;
  description: string;
  preview: { bg: string; accent: string; secondary: string; text: string };
  colors: ThemeColors;
};

// ─────────────────────────────────────────────────────────────
// 1. EMBER (Default — current theme)
//    Warm dark with orange/amber fire accents
// ─────────────────────────────────────────────────────────────
const ember: ThemeDefinition = {
  id: 'ember',
  name: 'Ember',
  description: 'Dark fire — the original Ritual',
  preview: { bg: '#131313', accent: '#ff8c00', secondary: '#4ae183', text: '#e5e2e1' },
  colors: {
    primary: '#ffb77d',
    primaryContainer: '#ff8c00',
    onPrimary: '#4d2600',
    onPrimaryContainer: '#623200',
    primaryFixedDim: '#ffb77d',
    primaryFixed: '#ffdcc3',
    onPrimaryFixed: '#2f1500',
    inversePrimary: '#904d00',

    secondary: '#4ae183',
    secondaryContainer: '#06bb63',
    onSecondary: '#003919',
    onSecondaryContainer: '#00431f',
    secondaryFixedDim: '#4ae183',
    secondaryFixed: '#6bfe9c',

    tertiary: '#ebb2ff',
    tertiaryContainer: '#d58ff0',
    onTertiary: '#500a6c',
    onTertiaryContainer: '#601f7b',

    error: '#ffb4ab',
    errorContainer: '#93000a',
    onError: '#690005',
    onErrorContainer: '#ffdad6',

    background: '#131313',
    surface: '#131313',
    surfaceDim: '#131313',
    surfaceContainerLowest: '#0e0e0e',
    surfaceContainerLow: '#1c1b1b',
    surfaceContainer: '#201f1f',
    surfaceContainerHigh: '#2a2a2a',
    surfaceContainerHighest: '#353534',
    surfaceVariant: '#353534',
    surfaceBright: '#3a3939',

    onBackground: '#e5e2e1',
    onSurface: '#e5e2e1',
    onSurfaceVariant: '#ddc1ae',
    inverseSurface: '#e5e2e1',
    inverseOnSurface: '#313030',

    outline: '#a48c7a',
    outlineVariant: '#564334',

    orange500: '#f97316',
    zinc400: '#a1a1aa',
    zinc500: '#71717a',
    zinc600: '#52525b',
    zinc700: '#3f3f46',
    zinc800: '#27272a',
    white: '#ffffff',
    transparent: 'transparent',
  },
};

// ─────────────────────────────────────────────────────────────
// 2. IVORY — Soft White
//    Clean, minimal, warm light theme
// ─────────────────────────────────────────────────────────────
const ivory: ThemeDefinition = {
  id: 'ivory',
  name: 'Ivory',
  description: 'Soft white — clean & minimal',
  preview: { bg: '#FAFAF8', accent: '#2563EB', secondary: '#16A34A', text: '#1C1917' },
  colors: {
    primary: '#93B4F4',
    primaryContainer: '#2563EB',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#ffffff',
    primaryFixedDim: '#93B4F4',
    primaryFixed: '#DBEAFE',
    onPrimaryFixed: '#1E3A5F',
    inversePrimary: '#60A5FA',

    secondary: '#4ADE80',
    secondaryContainer: '#16A34A',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#ffffff',
    secondaryFixedDim: '#4ADE80',
    secondaryFixed: '#BBF7D0',

    tertiary: '#C084FC',
    tertiaryContainer: '#9333EA',
    onTertiary: '#ffffff',
    onTertiaryContainer: '#ffffff',

    error: '#EF4444',
    errorContainer: '#FEE2E2',
    onError: '#ffffff',
    onErrorContainer: '#991B1B',

    background: '#FAFAF8',
    surface: '#FAFAF8',
    surfaceDim: '#F5F5F3',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#F5F5F0',
    surfaceContainer: '#EFEFEA',
    surfaceContainerHigh: '#E8E8E3',
    surfaceContainerHighest: '#E0E0DB',
    surfaceVariant: '#E0E0DB',
    surfaceBright: '#ffffff',

    onBackground: '#1C1917',
    onSurface: '#1C1917',
    onSurfaceVariant: '#57534E',
    inverseSurface: '#1C1917',
    inverseOnSurface: '#FAFAF8',

    outline: '#A8A29E',
    outlineVariant: '#D6D3D1',

    orange500: '#2563EB',
    zinc400: '#78716C',
    zinc500: '#A8A29E',
    zinc600: '#D6D3D1',
    zinc700: '#E7E5E4',
    zinc800: '#F5F5F4',
    white: '#ffffff',
    transparent: 'transparent',
  },
};

// ─────────────────────────────────────────────────────────────
// 3. GOTHAM — Dark Batman Style
//    Deep black, gunmetal gray, subtle gold accents
// ─────────────────────────────────────────────────────────────
const gotham: ThemeDefinition = {
  id: 'gotham',
  name: 'Gotham',
  description: 'Deep black — dark knight energy',
  preview: { bg: '#0A0A0A', accent: '#C9A84C', secondary: '#4ADE80', text: '#D4D4D8' },
  colors: {
    primary: '#D4B96A',
    primaryContainer: '#C9A84C',
    onPrimary: '#1A1400',
    onPrimaryContainer: '#2A2000',
    primaryFixedDim: '#D4B96A',
    primaryFixed: '#F0E0B0',
    onPrimaryFixed: '#1A1400',
    inversePrimary: '#8B7A3C',

    secondary: '#4ADE80',
    secondaryContainer: '#22C55E',
    onSecondary: '#003919',
    onSecondaryContainer: '#00431f',
    secondaryFixedDim: '#4ADE80',
    secondaryFixed: '#6bfe9c',

    tertiary: '#94A3B8',
    tertiaryContainer: '#64748B',
    onTertiary: '#0F172A',
    onTertiaryContainer: '#1E293B',

    error: '#F87171',
    errorContainer: '#7F1D1D',
    onError: '#450A0A',
    onErrorContainer: '#FECACA',

    background: '#0A0A0A',
    surface: '#0A0A0A',
    surfaceDim: '#080808',
    surfaceContainerLowest: '#050505',
    surfaceContainerLow: '#111111',
    surfaceContainer: '#161616',
    surfaceContainerHigh: '#1E1E1E',
    surfaceContainerHighest: '#262626',
    surfaceVariant: '#262626',
    surfaceBright: '#2E2E2E',

    onBackground: '#D4D4D8',
    onSurface: '#D4D4D8',
    onSurfaceVariant: '#A1A1AA',
    inverseSurface: '#D4D4D8',
    inverseOnSurface: '#18181B',

    outline: '#52525B',
    outlineVariant: '#3F3F46',

    orange500: '#C9A84C',
    zinc400: '#A1A1AA',
    zinc500: '#71717A',
    zinc600: '#52525B',
    zinc700: '#3F3F46',
    zinc800: '#27272A',
    white: '#E4E4E7',
    transparent: 'transparent',
  },
};

// ─────────────────────────────────────────────────────────────
// 4. FOREST — Deep Nature
//    Rich emerald greens, earth tones, warm wood
// ─────────────────────────────────────────────────────────────
const forest: ThemeDefinition = {
  id: 'forest',
  name: 'Forest',
  description: 'Deep nature — earth & emerald',
  preview: { bg: '#0C1410', accent: '#34D399', secondary: '#FBBF24', text: '#D1FAE5' },
  colors: {
    primary: '#6EE7B7',
    primaryContainer: '#34D399',
    onPrimary: '#003D26',
    onPrimaryContainer: '#004D30',
    primaryFixedDim: '#6EE7B7',
    primaryFixed: '#A7F3D0',
    onPrimaryFixed: '#002E1B',
    inversePrimary: '#059669',

    secondary: '#FCD34D',
    secondaryContainer: '#FBBF24',
    onSecondary: '#422D00',
    onSecondaryContainer: '#534000',
    secondaryFixedDim: '#FCD34D',
    secondaryFixed: '#FEF3C7',

    tertiary: '#FB923C',
    tertiaryContainer: '#F97316',
    onTertiary: '#431407',
    onTertiaryContainer: '#5A1D0C',

    error: '#F87171',
    errorContainer: '#7F1D1D',
    onError: '#450A0A',
    onErrorContainer: '#FECACA',

    background: '#0C1410',
    surface: '#0C1410',
    surfaceDim: '#0A110D',
    surfaceContainerLowest: '#070E0A',
    surfaceContainerLow: '#121E18',
    surfaceContainer: '#16241D',
    surfaceContainerHigh: '#1C2C24',
    surfaceContainerHighest: '#22342B',
    surfaceVariant: '#22342B',
    surfaceBright: '#2A3D32',

    onBackground: '#D1FAE5',
    onSurface: '#D1FAE5',
    onSurfaceVariant: '#86EFAC',
    inverseSurface: '#D1FAE5',
    inverseOnSurface: '#064E3B',

    outline: '#059669',
    outlineVariant: '#065F46',

    orange500: '#34D399',
    zinc400: '#86EFAC',
    zinc500: '#4ADE80',
    zinc600: '#22C55E',
    zinc700: '#166534',
    zinc800: '#14532D',
    white: '#ECFDF5',
    transparent: 'transparent',
  },
};

// ═══════════════════════════════════════════════════════════════
// Theme registry
// ═══════════════════════════════════════════════════════════════

export const THEMES: ThemeDefinition[] = [ember, ivory, gotham, forest];

export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find(t => t.id === id) ?? ember;
}
