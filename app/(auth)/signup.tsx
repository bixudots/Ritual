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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth-store';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
} from '../../src/constants/theme';
import {
  AVATAR_ICONS,
  AvatarIconGlyph,
  getAvatarIconById,
} from '../../src/constants/avatar-icons';

/**
 * SIGN UP screen. Intentionally a different shape than /login — this is a
 * richer, multi-field "introduce yourself" flow:
 *   • Full-bleed accent header with a live preview of your chosen avatar
 *   • Name, email, password
 *   • Emoji avatar grid
 *   • One-liner goal ("Why are you here?")
 *   • Apple sign-in as a one-tap alternative
 */
export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [iconId, setIconId] = useState<string | null>('ion:rocket');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { signUp, isLoading } = useAuthStore();

  const pickIcon = (id: string) => {
    Haptics.selectionAsync();
    setIconId(id);
  };

  const selectedIcon = getAvatarIconById(iconId);

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);
    if (!displayName.trim()) return setError('Give yourself a name');
    if (!email || !password) return setError('Email and password required');
    if (password.length < 6) return setError('Password must be at least 6 characters');

    const { error: err } = await signUp(email, password, displayName.trim(), {
      avatarIconId: iconId,
      goal: goal.trim(),
    });
    if (err) setError(err);
    else setInfo('Account created — check your email to confirm, then sign in.');
  };

  const goSignIn = () => {
    Haptics.selectionAsync();
    router.replace('/(auth)/login');
  };

  const openTour = () => {
    Haptics.selectionAsync();
    router.push('/(auth)/welcome');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Full-bleed accent header with live avatar preview */}
        <Animated.View entering={FadeIn.duration(480)} style={styles.header}>
          <View style={styles.headerBlob} />
          <View style={styles.headerBlob2} />
          <View
            style={[
              styles.avatarPreview,
              selectedIcon && { borderColor: selectedIcon.color },
            ]}
          >
            {selectedIcon ? (
              <AvatarIconGlyph def={selectedIcon} size={52} />
            ) : (
              <Ionicons name="person" size={48} color={Colors.zinc500} />
            )}
          </View>
          <Text style={styles.headerTitle}>Start your ritual</Text>
          <Text style={styles.headerSub}>
            Takes 30 seconds. You can change everything later.
          </Text>
        </Animated.View>

        <View style={styles.body}>
          {/* Step 1 — identity */}
          <Animated.View
            entering={FadeInUp.duration(420).delay(140)}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>1</Text>
              </View>
              <Text style={styles.cardTitle}>Who are you?</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Display name"
              placeholderTextColor={Colors.zinc600}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
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
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={Colors.zinc600}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </Animated.View>

          {/* Step 2 — avatar */}
          <Animated.View
            entering={FadeInUp.duration(420).delay(200)}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>2</Text>
              </View>
              <Text style={styles.cardTitle}>Pick an icon</Text>
            </View>
            <View style={styles.emojiGrid}>
              {AVATAR_ICONS.map((icon) => {
                const active = icon.id === iconId;
                return (
                  <Pressable
                    key={icon.id}
                    onPress={() => pickIcon(icon.id)}
                    style={({ pressed }) => [
                      styles.emojiCell,
                      active && {
                        borderColor: icon.color,
                        backgroundColor: `${icon.color}1F`,
                      },
                      pressed && !active && { opacity: 0.7 },
                    ]}
                  >
                    <AvatarIconGlyph
                      def={icon}
                      size={24}
                      color={active ? icon.color : Colors.zinc400}
                    />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Step 3 — goal */}
          <Animated.View
            entering={FadeInUp.duration(420).delay(260)}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>3</Text>
              </View>
              <Text style={styles.cardTitle}>One-liner goal</Text>
            </View>
            <Text style={styles.cardHint}>
              Why are you here? Keep it short — you'll see it on your profile.
            </Text>
            <TextInput
              style={[styles.input, styles.goalInput]}
              placeholder="e.g. Run a half marathon by September"
              placeholderTextColor={Colors.zinc600}
              value={goal}
              onChangeText={setGoal}
              maxLength={80}
              multiline
            />
            <Text style={styles.charCount}>{goal.length}/80</Text>
          </Animated.View>

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <Animated.View entering={FadeInUp.duration(420).delay(320)}>
            <Pressable
              style={[styles.primaryBtn, isLoading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.onPrimaryContainer} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Create account</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={Colors.onPrimaryContainer}
                  />
                </>
              )}
            </Pressable>
          </Animated.View>

          <View style={styles.bottomSwap}>
            <Text style={styles.bottomSwapText}>Already have an account? </Text>
            <Pressable onPress={goSignIn} hitSlop={8}>
              <Text style={styles.bottomSwapBold}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

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
  scroll: {
    paddingBottom: Spacing['3xl'] * 2,
  },

  /* Header */
  header: {
    paddingTop: Platform.OS === 'ios' ? 70 : 48,
    paddingBottom: Spacing['2xl'],
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  headerBlob: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primaryContainer,
    opacity: 0.15,
  },
  headerBlob2: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.secondary,
    opacity: 0.12,
  },
  avatarPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  avatarPreviewText: {
    fontSize: 48,
  },
  headerTitle: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['3xl'],
    color: Colors.onSurface,
    textAlign: 'center',
  },
  headerSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  /* Body */
  body: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },

  /* Cards — each step is a distinct card */
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.zinc800,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  stepPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPillText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.sm,
    color: Colors.onPrimaryContainer,
  },
  cardTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.lg,
    color: Colors.onSurface,
  },
  cardHint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
  },
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
  goalInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.zinc600,
    textAlign: 'right',
    marginTop: -Spacing.xs,
  },

  /* Emoji grid */
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  emojiCell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emojiCellActive: {
    borderColor: Colors.primaryContainer,
    backgroundColor: `${Colors.primaryContainer}22`,
  },
  emojiCellText: {
    fontSize: 24,
  },

  /* CTA */
  primaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryBtnText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onPrimaryContainer,
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

  bottomSwap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
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
