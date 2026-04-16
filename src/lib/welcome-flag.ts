import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny shared flag for whether the intro tour has been seen. We keep it in a
 * module-level variable (not React state) so that when the welcome screen
 * marks it as seen and navigates away, AuthGate sees the new value
 * synchronously and doesn't bounce the user back to the tour.
 */
export const WELCOME_SEEN_KEY = 'ritual.welcome.seen.v1';

let seen: boolean | null = null;
const listeners = new Set<() => void>();

export async function loadWelcomeSeen(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
    seen = v === '1';
  } catch {
    seen = true; // fail-open: don't trap existing users in the tour
  }
  listeners.forEach((l) => l());
  return seen;
}

export function getWelcomeSeen(): boolean | null {
  return seen;
}

export async function markWelcomeSeen() {
  seen = true;
  try {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
  } catch {
    // non-fatal
  }
  listeners.forEach((l) => l());
}

export function subscribeWelcomeSeen(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
