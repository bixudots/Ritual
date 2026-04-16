import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { getBiometricEnabled, setBiometricEnabled } from '../lib/biometric';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Biometric lock
  biometricEnabled: boolean;
  isLocked: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    extras?: { avatarIconId?: string | null; goal?: string }
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  resetMyData: () => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;

  unlockApp: () => void;
  lockApp: () => void;
  setBiometricPreference: (enabled: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: false,
  isInitialized: false,
  biometricEnabled: false,
  isLocked: false,

  initialize: async () => {
    try {
      const [{ data: { session } }, bioEnabled] = await Promise.all([
        supabase.auth.getSession(),
        getBiometricEnabled(),
      ]);
      // If we have a persisted session AND biometric lock is enabled,
      // start in locked state. The lock screen will prompt Face ID.
      set({
        session,
        user: session?.user ?? null,
        biometricEnabled: bioEnabled,
        isLocked: !!(session && bioEnabled),
        isInitialized: true,
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
      });
    } catch {
      set({ isInitialized: true });
    }
  },

  unlockApp: () => set({ isLocked: false }),
  lockApp: () => {
    if (get().biometricEnabled && get().session) set({ isLocked: true });
  },
  setBiometricPreference: async (enabled: boolean) => {
    await setBiometricEnabled(enabled);
    set({ biometricEnabled: enabled });
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ isLoading: false });
    return { error: error?.message ?? null };
  },

  signUp: async (email, password, displayName, extras) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          avatar_icon: extras?.avatarIconId ?? null,
          goal: extras?.goal ?? '',
        },
      },
    });
    // If a session exists (email confirmation disabled), persist the goal/icon
    // directly on the profile row. Otherwise the data stays in user_metadata
    // and we'll sync on next sign-in.
    if (!error && data.session && data.user) {
      try {
        await supabase
          .from('profiles')
          .update({
            display_name: displayName,
            bio: extras?.goal ?? null,
            avatar_url: extras?.avatarIconId ?? null,
          })
          .eq('id', data.user.id);
      } catch {
        // non-fatal — trigger-created profile still exists with display_name
      }
    }
    set({ isLoading: false });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    // Turn off biometric lock when explicitly signing out so the next user
    // isn't blocked by a leftover lock.
    await setBiometricEnabled(false);
    set({ session: null, user: null, biometricEnabled: false, isLocked: false });
  },

  resetPassword: async (email) => {
    // Sends a password-reset email. The link lands on the Supabase hosted
    // recovery page unless you've configured a deep link in your project.
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  },

  resetMyData: async () => {
    // Wipes all habits/logs/xp but keeps the account signed in.
    const { error } = await supabase.rpc('reset_my_data');
    return { error: error?.message ?? null };
  },

  deleteAccount: async () => {
    // Permanently deletes auth.users row + cascades all data.
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return { error: error.message };
    // Clear local session immediately
    await supabase.auth.signOut();
    set({ session: null, user: null });
    return { error: null };
  },
}));
