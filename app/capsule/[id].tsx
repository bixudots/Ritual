import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCapsuleStore } from '../../src/stores/capsule-store';
import { isCapsuleReady, getCapsuleUnlockDate } from '../../src/types/capsule';
import { getCapsulePhotoSignedUrl } from '../../src/lib/capsule-service';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
} from '../../src/constants/theme';

export default function CapsuleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const capsule = useCapsuleStore((s) => s.capsules.find((c) => c.id === id));
  const openAndSave = useCapsuleStore((s) => s.openAndSave);
  const deleteCapsule = useCapsuleStore((s) => s.deleteCapsule);

  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});

  // Resolve each stored capsule photo path to a short-lived signed URL.
  // Re-runs whenever the photo list changes. Private bucket → direct URIs fail.
  useEffect(() => {
    let cancelled = false;
    const urls = capsule?.photoUrls ?? [];
    if (urls.length === 0) {
      setSignedPhotoUrls({});
      return;
    }
    (async () => {
      const resolved: Record<string, string> = {};
      await Promise.all(
        urls.map(async (u) => {
          const signed = await getCapsulePhotoSignedUrl(u);
          if (signed) resolved[u] = signed;
        }),
      );
      if (!cancelled) setSignedPhotoUrls(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [capsule?.photoUrls]);

  if (!capsule) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.zinc400} />
        </Pressable>
        <Text style={styles.missing}>Capsule not found.</Text>
      </View>
    );
  }

  const ready = isCapsuleReady(capsule);
  const alreadyOpened = capsule.openedAt !== null;
  const showContent = alreadyOpened || revealed;
  const unlockMoment = getCapsuleUnlockDate(capsule);
  const hasExactTime = capsule.deliverAt !== null;

  const handleReveal = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRevealed(true);
  };

  const handleKeep = async () => {
    if (!capsule) return;
    try {
      setBusy(true);
      const reward = await openAndSave(capsule.id, true);
      if (reward && reward.totalXP > 0) {
        const lines = [`+${reward.saveXP} XP · capsule saved`];
        if (reward.earnedTimeTraveler) {
          lines.push(`+${reward.timeTravelerBonus} XP · 🏅 Time Traveler badge`);
        }
        Alert.alert(
          `+${reward.totalXP} XP`,
          lines.join('\n'),
          [{ text: 'Nice', onPress: () => router.back() }],
        );
      } else {
        router.back();
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Delete capsule?',
      'This will permanently remove the capsule and its photos. You can also mark it opened and save it instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              // If it hasn't been opened yet, call open with save=false (which deletes)
              if (!alreadyOpened) {
                await openAndSave(capsule.id, false);
              } else {
                await deleteCapsule(capsule.id);
              }
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Failed to delete.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.zinc400} />
        </Pressable>
        {alreadyOpened && (
          <Pressable style={styles.headerTrash} onPress={handleDiscard} disabled={busy}>
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Envelope header */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.envelopeWrap}>
          <View
            style={[
              styles.envelope,
              ready && !showContent && styles.envelopeReady,
              !ready && styles.envelopeSealed,
            ]}
          >
            <Ionicons
              name={
                showContent
                  ? 'mail-open'
                  : ready
                    ? 'mail-unread'
                    : 'lock-closed'
              }
              size={56}
              color={
                showContent
                  ? Colors.tertiary
                  : ready
                    ? Colors.secondaryContainer
                    : Colors.zinc500
              }
            />
          </View>
        </Animated.View>

        {/* SEALED STATE */}
        {!ready && !alreadyOpened && (
          <Animated.View entering={FadeInDown.duration(500).delay(150)} style={styles.sealedBox}>
            <Text style={styles.sealedTitle}>Sealed</Text>
            <Text style={styles.sealedMeta}>
              {hasExactTime
                ? `Unlocks ${format(unlockMoment, 'EEEE, MMM d · h:mm a')}`
                : `Unlocks ${format(unlockMoment, 'EEEE, MMMM d, yyyy')}`}
            </Text>
            <Text style={styles.sealedCountdown}>
              in {formatDistanceToNow(unlockMoment)}
            </Text>
            <View style={styles.sealedDivider} />
            <Text style={styles.sealedNote}>
              This capsule is locked until delivery day. Come back then to open it.
            </Text>
          </Animated.View>
        )}

        {/* READY (unopened) STATE */}
        {ready && !revealed && !alreadyOpened && (
          <Animated.View entering={FadeInDown.duration(500).delay(150)} style={styles.readyBox}>
            <Text style={styles.readyTitle}>It's time</Text>
            <Text style={styles.readyMeta}>
              You sealed this on {format(parseISO(capsule.createdAt), 'MMM d, yyyy')}
            </Text>
            <Pressable style={styles.openBtn} onPress={handleReveal} disabled={busy}>
              <Ionicons name="mail-open" size={20} color={Colors.onPrimaryContainer} />
              <Text style={styles.openBtnText}>Open capsule</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* OPENED / REVEALED */}
        {showContent && (
          <Animated.View entering={FadeIn.duration(600)} style={styles.letterCard}>
            <Text style={styles.letterDate}>
              {format(parseISO(capsule.createdAt), 'MMMM d, yyyy')} →{' '}
              {hasExactTime
                ? format(unlockMoment, 'MMMM d, yyyy · h:mm a')
                : format(unlockMoment, 'MMMM d, yyyy')}
            </Text>
            <Text style={styles.letterTitle}>{capsule.title}</Text>
            <View style={styles.letterDivider} />
            <Text style={styles.letterBody}>{capsule.message}</Text>

            {capsule.photoUrls.length > 0 && (
              <View style={styles.photosRow}>
                {capsule.photoUrls.map((stored) => {
                  const uri = signedPhotoUrls[stored];
                  if (!uri) {
                    return (
                      <View key={stored} style={[styles.photo, styles.photoLoading]}>
                        <ActivityIndicator color={Colors.zinc500} />
                      </View>
                    );
                  }
                  return <Image key={stored} source={{ uri }} style={styles.photo} />;
                })}
              </View>
            )}
          </Animated.View>
        )}

        {/* Post-open actions (first open only) */}
        {revealed && !alreadyOpened && (
          <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.actions}>
            <Pressable style={styles.keepBtn} onPress={handleKeep} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={Colors.onPrimaryContainer} />
              ) : (
                <>
                  <Ionicons name="bookmark" size={18} color={Colors.onPrimaryContainer} />
                  <Text style={styles.keepBtnText}>Keep this capsule</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.discardBtn} onPress={handleDiscard} disabled={busy}>
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
              <Text style={styles.discardBtnText}>Delete forever</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'ios' ? 56 : 36 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'flex-start' },
  headerTrash: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  missing: {
    textAlign: 'center',
    marginTop: 80,
    color: Colors.zinc500,
    fontFamily: Fonts.body,
  },

  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 120, alignItems: 'center' },

  envelopeWrap: { alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing['2xl'] },
  envelope: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  envelopeReady: {
    backgroundColor: `${Colors.secondaryContainer}22` as any,
    borderWidth: 2,
    borderColor: Colors.secondaryContainer,
  },
  envelopeSealed: {
    backgroundColor: Colors.surfaceContainerLow,
  },

  sealedBox: { alignItems: 'center', maxWidth: 320 },
  sealedTitle: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['3xl'],
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  sealedMeta: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.zinc400,
  },
  sealedCountdown: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.primaryContainer,
    marginTop: Spacing.xs,
  },
  sealedDivider: {
    width: 40,
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginVertical: Spacing['2xl'],
  },
  sealedNote: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
    textAlign: 'center',
    lineHeight: 20,
  },

  readyBox: { alignItems: 'center', maxWidth: 320 },
  readyTitle: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['4xl'],
    color: Colors.secondaryContainer,
    marginBottom: Spacing.sm,
  },
  readyMeta: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.zinc500,
    marginBottom: Spacing['2xl'],
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  openBtnText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onPrimaryContainer,
  },

  letterCard: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing['2xl'],
    marginTop: Spacing.md,
  },
  letterDate: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  letterTitle: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['2xl'],
    color: Colors.onSurface,
    marginBottom: Spacing.md,
  },
  letterDivider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginBottom: Spacing.lg,
  },
  letterBody: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
    lineHeight: 24,
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainer,
  },
  photoLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  actions: {
    width: '100%',
    marginTop: Spacing['2xl'],
    gap: Spacing.md,
  },
  keepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  keepBtnText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onPrimaryContainer,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  discardBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.error,
  },
});
