import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/auth-store';
import { authenticate, getBiometricKind, type BiometricKind } from '../lib/biometric';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius } from '../constants/theme';

/**
 * Full-screen lock overlay shown on cold start when biometric lock is enabled
 * and a session exists. The Supabase session is already loaded in memory, but
 * the UI is hidden behind this overlay until Face ID / Touch ID succeeds.
 *
 * Matches the standard pattern used by 1Password, banking apps, etc.: the
 * biometric prompt auto-triggers on mount, and on failure the user can retry
 * or sign out.
 */
export default function BiometricLockScreen() {
  const unlockApp = useAuthStore((s) => s.unlockApp);
  const signOut = useAuthStore((s) => s.signOut);
  const [kind, setKind] = useState<BiometricKind>('biometric');
  const [attempting, setAttempting] = useState(false);
  const hasPromptedRef = useRef(false);

  const label =
    kind === 'face' ? 'Face ID' : kind === 'fingerprint' ? 'Touch ID' : 'Biometric';
  const icon =
    kind === 'face' ? 'scan-outline' : kind === 'fingerprint' ? 'finger-print' : 'lock-closed';

  const tryUnlock = async () => {
    if (attempting) return;
    setAttempting(true);
    const res = await authenticate(`Unlock Ritual with ${label}`);
    setAttempting(false);
    if (res.success) unlockApp();
  };

  useEffect(() => {
    getBiometricKind().then(setKind);
    // Auto-prompt once on mount
    if (!hasPromptedRef.current) {
      hasPromptedRef.current = true;
      tryUnlock();
    }
  }, []);

  // Re-prompt when app returns to foreground (if still locked)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !attempting) tryUnlock();
    });
    return () => sub.remove();
  }, [attempting]);

  return (
    <View style={styles.container}>
      <View style={styles.lockIconWrap}>
        <Ionicons name={icon as any} size={72} color={Colors.primaryContainer} />
      </View>
      <Text style={styles.title}>Ritual is locked</Text>
      <Text style={styles.subtitle}>Use {label} to continue</Text>

      <Pressable style={styles.unlockBtn} onPress={tryUnlock} disabled={attempting}>
        <Ionicons name={icon as any} size={20} color={Colors.onPrimaryContainer} />
        <Text style={styles.unlockBtnText}>Unlock with {label}</Text>
      </Pressable>

      <Pressable style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
  },
  lockIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: `${Colors.primaryContainer}1A` as any,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  title: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['3xl'],
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.zinc500,
    marginBottom: Spacing['3xl'],
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  unlockBtnText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onPrimaryContainer,
  },
  signOutBtn: {
    marginTop: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  signOutText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
  },
});
