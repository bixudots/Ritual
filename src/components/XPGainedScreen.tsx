import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { getLevelProgress } from '../constants/xp';
import type { BadgeDefinition } from '../constants/badges';

interface XPGainedScreenProps {
  visible: boolean;
  xpGained: number;
  totalXP: number;
  badges?: BadgeDefinition[];
  onDismiss: () => void;
}

export default function XPGainedScreen({
  visible,
  xpGained,
  totalXP,
  badges = [],
  onDismiss,
}: XPGainedScreenProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const badgeSlideAnim = useRef(new Animated.Value(50)).current;
  const [displayedXP, setDisplayedXP] = useState(0);

  const { level, nextLevelXP, progress } = getLevelProgress(totalXP);
  const prevProgress = getLevelProgress(Math.max(0, totalXP - xpGained)).progress;

  useEffect(() => {
    if (visible) {
      setDisplayedXP(0);
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      progressAnim.setValue(prevProgress);
      badgeSlideAnim.setValue(50);

      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 1000,
          useNativeDriver: false,
        }),
        ...(badges.length > 0
          ? [
              Animated.spring(badgeSlideAnim, {
                toValue: 0,
                tension: 60,
                friction: 8,
                useNativeDriver: true,
              }),
            ]
          : []),
      ]).start();

      // Animate XP counter with JS interval (more reliable than Animated for text)
      const target = xpGained;
      const duration = 800;
      const steps = 30;
      const stepTime = duration / steps;
      let current = 0;
      const interval = setInterval(() => {
        current++;
        const value = Math.round((current / steps) * target);
        setDisplayedXP(Math.min(value, target));
        if (current >= steps) {
          clearInterval(interval);
          setDisplayedXP(target);
        }
      }, stepTime);

      return () => clearInterval(interval);
    }
  }, [visible]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* XP burst */}
          <View style={styles.xpBurst}>
            <Text style={styles.xpPlus}>+</Text>
            <Text style={styles.xpAmount}>{displayedXP}</Text>
            <Text style={styles.xpLabel}>XP</Text>
          </View>

          <Text style={styles.subtitle}>Habit Created!</Text>

          {/* Level progress */}
          <View style={styles.levelSection}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelText}>Level {level}</Text>
              <Text style={styles.xpProgress}>
                {totalXP} / {nextLevelXP} XP
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View
                style={[styles.progressBarFill, { width: progressWidth }]}
              />
            </View>
          </View>

          {/* Badges earned */}
          {badges.length > 0 && (
            <Animated.View
              style={[
                styles.badgeSection,
                { transform: [{ translateY: badgeSlideAnim }] },
              ]}
            >
              <Text style={styles.badgeSectionTitle}>
                {badges.length === 1 ? 'Badge Unlocked!' : 'Badges Unlocked!'}
              </Text>
              {badges.map((badge) => (
                <View key={badge.id} style={styles.badgeCard}>
                  <View style={styles.badgeIconBg}>
                    <Text style={styles.badgeIcon}>
                      {badge.id === 'starter' ? '🚀' : badge.id === 'photogenic' ? '📸' : badge.id === 'live' ? '📍' : '🏆'}
                    </Text>
                  </View>
                  <View style={styles.badgeInfo}>
                    <Text style={styles.badgeName}>{badge.name}</Text>
                    <Text style={styles.badgeDesc}>{badge.description}</Text>
                  </View>
                  <Text style={styles.badgeXP}>+{badge.xpReward} XP</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Continue button */}
          <Pressable style={styles.continueButton} onPress={onDismiss}>
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  container: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.xl,
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  xpBurst: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  xpPlus: {
    fontSize: FontSizes['4xl'],
    fontFamily: Fonts.headlineExtraBold,
    color: Colors.primaryContainer,
  },
  xpAmount: {
    fontSize: 56,
    fontFamily: Fonts.headlineExtraBold,
    color: Colors.primaryContainer,
  },
  xpLabel: {
    fontSize: FontSizes['3xl'],
    fontFamily: Fonts.headlineBold,
    color: Colors.primaryContainer,
    marginLeft: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.zinc400,
    marginBottom: Spacing['2xl'],
  },
  levelSection: {
    width: '100%',
    marginBottom: Spacing['2xl'],
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  levelText: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.headlineBold,
    color: Colors.onSurface,
  },
  xpProgress: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.zinc500,
  },
  progressBarBg: {
    width: '100%',
    height: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primaryContainer,
    borderRadius: 5,
  },
  badgeSection: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  badgeSectionTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.headlineBold,
    color: Colors.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(235,178,255,0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(235,178,255,0.2)',
  },
  badgeIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(235,178,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  badgeIcon: {
    fontSize: 22,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.headlineBold,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  badgeDesc: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.body,
    color: Colors.zinc500,
  },
  badgeXP: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.headlineBold,
    color: Colors.primaryContainer,
  },
  continueButton: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    width: '100%',
    alignItems: 'center',
    ...Shadows.fabShadow,
  },
  continueText: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.headlineExtraBold,
    color: Colors.onPrimaryContainer,
  },
});
