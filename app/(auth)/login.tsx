import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth-store';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';

type Mode = 'signIn' | 'forgot';

/**
 * SIGN IN screen. Deliberately minimal: a returning user should be in and out
 * in two taps. Apple sign-in at the top, classic email/password below, forgot
 * password as a tertiary link. The visually dense flow lives on /signup.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('signIn');
  const { signIn, resetPassword, isLoading } = useAuthStore();

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);

    if (mode === 'forgot') {
      if (!email) return setError('Enter your email');
      const { error: err } = await resetPassword(email);
      if (err) setError(err);
      else setInfo('Password reset link sent. Check your email.');
      return;
    }

    if (!email || !password) return setError('Email and password required');
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
  };

  const goSignUp = () => {
    Haptics.selectionAsync();
    router.replace('/(auth)/signup');
  };

  const openTour = () => {
    Haptics.selectionAsync();
    router.push('/(auth)/welcome');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo / identity */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.logoSection}>
          <View style={styles.logoBadge}>
            <Ionicons name="flame" size={36} color={Colors.onPrimaryContainer} />
          </View>
          <Text style={styles.appName}>Welcome back</Text>
          <Text style={styles.tagline}>
            {mode === 'forgot'
              ? "We'll send you a reset link"
              : 'Pick up where you left off'}
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInDown.duration(420).delay(140)}
          style={styles.form}
        >
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.zinc600}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {mode === 'signIn' && (
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.zinc600}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <Pressable
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.onSecondary} />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'forgot' ? 'Send reset link' : 'Sign in'}
              </Text>
            )}
          </Pressable>

          {mode === 'signIn' ? (
            <Pressable onPress={() => { setMode('forgot'); setError(null); setInfo(null); }}>
              <Text style={styles.switchTextSubtle}>Forgot password?</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => { setMode('signIn'); setError(null); setInfo(null); }}>
              <Text style={styles.switchTextSubtle}>Back to sign in</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Bottom swap */}
        <Animated.View
          entering={FadeInDown.duration(420).delay(220)}
          style={styles.bottomSwap}
        >
          <Text style={styles.bottomSwapText}>New here? </Text>
          <Pressable onPress={goSignUp} hitSlop={8}>
            <Text style={styles.bottomSwapBold}>Create an account</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Floating Help — reopens the onboarding tour */}
      <Pressable
        onPress={openTour}
        style={({ pressed }) => [
          styles.helpFab,
          pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 },
        ]}
        hitSlop={12}
        accessibilityLabel="Show onboarding tour"
      >
        <Ionicons name="help" size={22} color={Colors.primaryContainer} />
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['3xl'],
    color: Colors.onSurface,
  },
  tagline: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
    marginTop: Spacing.xs,
  },
  form: { gap: Spacing.md },
  input: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
    borderWidth: 1,
    borderColor: Colors.zinc700,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.error,
    textAlign: 'center',
  },
  info: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.secondary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onSecondary,
  },
  switchTextSubtle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.zinc600,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  bottomSwap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing['2xl'],
  },
  bottomSwapText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
  },
  bottomSwapBold: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.sm,
    color: Colors.primaryContainer,
  },
  helpFab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Platform.OS === 'ios' ? Spacing['3xl'] : Spacing['2xl'],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.zinc700,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
