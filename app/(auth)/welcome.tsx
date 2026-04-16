import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Dimensions,
  Platform,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
} from '../../src/constants/theme';
import { markWelcomeSeen } from '../../src/lib/welcome-flag';

// Re-export for backwards compatibility with any old imports.
export { WELCOME_SEEN_KEY } from '../../src/lib/welcome-flag';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TourSlide {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}

const SLIDES: TourSlide[] = [
  {
    key: 'welcome',
    eyebrow: 'Welcome to',
    title: 'The Ritual',
    body: 'A quiet habit tracker for people who want streaks that actually mean something. No nagging, no ads, no tricks.',
    icon: 'sparkles',
    accent: Colors.primaryContainer,
  },
  {
    key: 'binary',
    eyebrow: 'Step 1',
    title: 'Every habit is yes or no',
    body: 'Pick something you can answer with a tap: did you do it today, or not? No "almost", no fake metrics.',
    icon: 'checkmark-circle',
    accent: Colors.secondary,
  },
  {
    key: 'xp',
    eyebrow: 'Step 2',
    title: 'Earn, lose, recover XP',
    body: 'Complete a habit → gain XP. Miss → lose some. Come back the next day → get it back. Miss two in a row → the loss sticks.',
    icon: 'flash',
    accent: Colors.tertiary,
  },
  {
    key: 'proof',
    eyebrow: 'Step 3',
    title: 'Prove it, if you want',
    body: 'Attach a photo or require a location check-in so a habit only counts when you actually show up.',
    icon: 'camera',
    accent: Colors.secondaryContainer,
  },
  {
    key: 'capsule',
    eyebrow: 'Step 4',
    title: 'Write to your future self',
    body: 'Seal a time capsule with a message and an unlock date. On the day, open it. Keep it, or let it go.',
    icon: 'mail-open',
    accent: Colors.primaryContainer,
  },
  {
    key: 'privacy',
    eyebrow: 'Before you sign up',
    title: 'Your data is yours',
    body: 'No trackers, no ads, no third-party analytics. Everything lives in your own private record, exportable or wipeable any time.',
    icon: 'lock-closed',
    accent: Colors.secondary,
  },
];

/* -------------------------------------------------------------------------- */
/*  Animated background blob — pulses + drifts with the current accent color  */
/* -------------------------------------------------------------------------- */

function AccentBlob({ color, style, delay = 0 }: { color: string; style: any; delay?: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [pulse, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [0.9, 1.15], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.18, 0.32], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.blob,
        { backgroundColor: color },
        style,
        animatedStyle,
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Slide content                                                              */
/* -------------------------------------------------------------------------- */

function Slide({ item, active }: { item: TourSlide; active: boolean }) {
  // Icon float / pulse
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [float]);

  const iconAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [-6, 6], Extrapolation.CLAMP) },
      { scale: interpolate(float.value, [0, 1], [1, 1.04], Extrapolation.CLAMP) },
    ],
  }));

  // Subtle rotating ring around the icon
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false
    );
  }, [ring]);
  const ringAnim = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(ring.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  // Re-mount-style key to replay entering animations when a slide becomes active
  const animKey = `${item.key}-${active ? 'a' : 'i'}`;

  return (
    <View style={styles.slide}>
      {/* Floating accent blobs behind content */}
      <AccentBlob color={item.accent} style={styles.blobTop} delay={0} />
      <AccentBlob color={item.accent} style={styles.blobBottom} delay={1200} />

      {/* Icon + ring */}
      <View style={styles.iconWrap}>
        <Animated.View
          style={[
            styles.ring,
            { borderColor: `${item.accent}55` },
            ringAnim,
          ]}
        />
        <Animated.View
          key={`icon-${animKey}`}
          entering={FadeIn.duration(500)}
          style={[
            styles.iconBubble,
            { backgroundColor: `${item.accent}1F`, borderColor: item.accent },
            iconAnim,
          ]}
        >
          <Ionicons name={item.icon} size={60} color={item.accent} />
        </Animated.View>
      </View>

      {/* Staggered text */}
      <Animated.Text
        key={`eb-${animKey}`}
        entering={FadeInUp.duration(420).delay(80)}
        style={[styles.eyebrow, { color: item.accent }]}
      >
        {item.eyebrow}
      </Animated.Text>
      <Animated.Text
        key={`title-${animKey}`}
        entering={FadeInUp.duration(480).delay(160)}
        style={styles.title}
      >
        {item.title}
      </Animated.Text>
      <Animated.Text
        key={`body-${animKey}`}
        entering={FadeInDown.duration(520).delay(240)}
        style={styles.body}
      >
        {item.body}
      </Animated.Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function WelcomeScreen() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<TourSlide>>(null);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first && typeof first.index === 'number') {
      setIndex(first.index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const goToLogin = useCallback(async (mode: 'signIn' | 'signUp') => {
    await markWelcomeSeen();
    router.replace(mode === 'signUp' ? '/(auth)/signup' : '/(auth)/login');
  }, []);

  const goNext = useCallback(() => {
    Haptics.selectionAsync();
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      goToLogin('signUp');
    }
  }, [index, goToLogin]);

  const skip = useCallback(() => {
    Haptics.selectionAsync();
    goToLogin('signUp');
  }, [goToLogin]);

  const goSignIn = useCallback(() => {
    Haptics.selectionAsync();
    goToLogin('signIn');
  }, [goToLogin]);

  const renderSlide = useCallback(
    ({ item, index: i }: { item: TourSlide; index: number }) => (
      <Slide item={item} active={i === index} />
    ),
    [index]
  );

  const isLast = index === SLIDES.length - 1;

  // Animated progress bar
  const progressStyle = useAnimatedStyle(() => ({
    width: withTiming(
      `${((index + 1) / SLIDES.length) * 100}%`,
      { duration: 380, easing: Easing.out(Easing.cubic) }
    ),
  }));

  return (
    <View style={styles.container}>
      {/* Top bar — progress + skip */}
      <View style={styles.topBar}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: SLIDES[index].accent },
              progressStyle,
            ]}
          />
        </View>
        <Pressable onPress={skip} hitSlop={16} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * i,
          index: i,
        })}
      />

      {/* Pagination dots */}
      <View style={styles.dots}>
        {SLIDES.map((s, i) => {
          const isActive = i === index;
          return (
            <Animated.View
              key={s.key}
              style={[
                styles.dot,
                isActive && {
                  width: 28,
                  backgroundColor: s.accent,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Primary CTA */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: SLIDES[index].accent },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
          onPress={goNext}
        >
          <Text style={styles.primaryBtnText}>
            {isLast ? 'Get started' : 'Next'}
          </Text>
          <Ionicons
            name={isLast ? 'arrow-forward' : 'chevron-forward'}
            size={20}
            color={Colors.onPrimaryContainer}
          />
        </Pressable>

        <Pressable onPress={goSignIn} style={styles.signInLink} hitSlop={12}>
          <Text style={styles.signInLinkText}>
            Already have an account?{' '}
            <Text style={styles.signInLinkBold}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    height: 32,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.zinc800,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  skipBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  skipText: {
    color: Colors.zinc500,
    fontSize: FontSizes.sm,
    fontFamily: Fonts.bodySemiBold,
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['3xl'],
    alignItems: 'center',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  blobTop: {
    top: -120,
    right: -100,
  },
  blobBottom: {
    bottom: -160,
    left: -140,
  },
  iconWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['3xl'],
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  iconBubble: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  eyebrow: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['3xl'],
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 38,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.zinc400,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.zinc700,
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Platform.OS === 'ios' ? Spacing['3xl'] : Spacing['2xl'],
    gap: Spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  primaryBtnText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onPrimaryContainer,
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  signInLinkText: {
    color: Colors.zinc500,
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
  },
  signInLinkBold: {
    color: Colors.onSurface,
    fontFamily: Fonts.bodySemiBold,
  },
});
