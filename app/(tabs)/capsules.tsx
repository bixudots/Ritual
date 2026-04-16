import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth-store';
import { useCapsuleStore } from '../../src/stores/capsule-store';
import { useHabitStore } from '../../src/stores/habit-store';
import { isCapsuleReady, getCapsuleUnlockDate } from '../../src/types/capsule';
import HeaderAvatar from '../../src/components/HeaderAvatar';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
} from '../../src/constants/theme';

const TODAY_LABEL_FORMAT = 'EEEE, MMMM d';

export default function CapsulesScreen() {
  const user = useAuthStore((s) => s.user);
  const capsules = useCapsuleStore((s) => s.capsules);
  const loading = useCapsuleStore((s) => s.loading);
  const loaded = useCapsuleStore((s) => s.loaded);
  const fetchCapsules = useCapsuleStore((s) => s.fetchCapsules);
  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const getOverallStreak = useHabitStore((s) => s.getOverallStreak);
  const streak = useMemo(() => getOverallStreak(), [habits, logs, getOverallStreak]);
  const todayLabel = useMemo(
    () => format(new Date(), TODAY_LABEL_FORMAT).toUpperCase(),
    [],
  );

  useEffect(() => {
    if (user && !loaded) fetchCapsules(user.id);
  }, [user, loaded, fetchCapsules]);

  const { ready, sealed, opened } = useMemo(() => {
    const now = new Date();
    const ready = capsules.filter((c) => isCapsuleReady(c, now));
    const sealed = capsules.filter(
      (c) => c.openedAt === null && !isCapsuleReady(c, now),
    );
    const opened = capsules.filter((c) => c.openedAt !== null);
    return { ready, sealed, opened };
  }, [capsules]);

  const onRefresh = () => {
    if (user) fetchCapsules(user.id);
  };

  return (
    <View style={styles.container}>
      {/* Shared "The Ritual" hero — matches home/dashboard so the user
          always knows which app they're in and whose avatar is showing. */}
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <HeaderAvatar size={40} />
          <View>
            <Text style={styles.heroTitle}>The Ritual</Text>
            <Text style={styles.heroDate}>{todayLabel}</Text>
          </View>
        </View>

        {streak > 0 && (
          <View style={styles.heroStreak}>
            <Ionicons name="flame" size={18} color={Colors.primaryContainer} />
            <Text style={styles.heroStreakText}>{streak}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Time Capsules</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push('/capsule/new')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Create time capsule"
        >
          <Ionicons name="add" size={22} color={Colors.onPrimaryContainer} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={Colors.primaryContainer}
          />
        }
      >
        {!loaded && loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primaryContainer} />
          </View>
        ) : capsules.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(500)} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="mail-outline" size={56} color={Colors.primaryContainer} />
            </View>
            <Text style={styles.emptyTitle}>No capsules yet</Text>
            <Text style={styles.emptySub}>
              Write a message to your future self — it stays sealed until delivery day.
            </Text>
            <Pressable style={styles.emptyCta} onPress={() => router.push('/capsule/new')}>
              <Ionicons name="add" size={18} color={Colors.onPrimaryContainer} />
              <Text style={styles.emptyCtaText}>Create a capsule</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {ready.length > 0 && (
              <>
                <SectionHeader label="READY TO OPEN" count={ready.length} />
                {ready.map((c, i) => (
                  <CapsuleCard key={c.id} capsule={c} state="ready" index={i} />
                ))}
              </>
            )}
            {sealed.length > 0 && (
              <>
                <SectionHeader label="SEALED" count={sealed.length} />
                {sealed.map((c, i) => (
                  <CapsuleCard key={c.id} capsule={c} state="sealed" index={i} />
                ))}
              </>
            )}
            {opened.length > 0 && (
              <>
                <SectionHeader label="OPENED" count={opened.length} />
                {opened.map((c, i) => (
                  <CapsuleCard key={c.id} capsule={c} state="opened" index={i} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

function CapsuleCard({
  capsule,
  state,
  index,
}: {
  capsule: ReturnType<typeof useCapsuleStore.getState>['capsules'][number];
  state: 'ready' | 'sealed' | 'opened';
  index: number;
}) {
  const onPress = () => router.push(`/capsule/${capsule.id}`);
  const deliveryDate = getCapsuleUnlockDate(capsule);
  const hasExactTime = capsule.deliverAt !== null;

  const iconName =
    state === 'ready' ? 'mail-unread' : state === 'sealed' ? 'lock-closed' : 'mail-open';
  const accent =
    state === 'ready' ? Colors.secondaryContainer : state === 'sealed' ? Colors.zinc600 : Colors.tertiary;

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(index * 60)}>
      <Pressable
        style={[styles.card, state === 'sealed' && styles.cardSealed, state === 'ready' && styles.cardReady]}
        onPress={onPress}
      >
        <View style={[styles.cardIcon, { backgroundColor: `${accent}22` }]}>
          <Ionicons name={iconName as any} size={22} color={accent} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, state === 'sealed' && styles.cardTitleMuted]} numberOfLines={1}>
            {state === 'sealed' ? 'Sealed capsule' : capsule.title}
          </Text>
          <Text style={styles.cardMeta}>
            {state === 'ready' && 'Ready to open · '}
            {state === 'sealed' && `Unlocks in ${formatDistanceToNow(deliveryDate)}`}
            {state === 'opened' && `Opened ${format(parseISO(capsule.openedAt!), 'MMM d, yyyy')}`}
            {state === 'ready' &&
              (hasExactTime
                ? format(deliveryDate, 'MMM d, yyyy · h:mm a')
                : format(deliveryDate, 'MMM d, yyyy'))}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.zinc500} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'ios' ? 56 : 36 },

  // ── Shared hero (matches home/dashboard) ──
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.xl,
    color: Colors.orange500,
  },
  heroDate: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  heroStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,140,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  heroStreakText: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes.lg,
    color: Colors.primaryContainer,
  },

  // ── HR divider between hero and page section ──
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.zinc800,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },

  // ── "Time Capsules" section heading row ──
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['3xl'],
    color: Colors.onSurface,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  loadingBox: { paddingVertical: Spacing['5xl'], alignItems: 'center' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    letterSpacing: 2,
  },
  sectionCount: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardSealed: { opacity: 0.75 },
  cardReady: {
    borderColor: Colors.secondaryContainer,
    backgroundColor: `${Colors.secondaryContainer}14` as any,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.lg,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  cardTitleMuted: { color: Colors.zinc400, fontStyle: 'italic' },
  cardMeta: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: `${Colors.primaryContainer}1A` as any,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  emptyTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes['2xl'],
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  emptySub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.zinc500,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    lineHeight: 22,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  emptyCtaText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onPrimaryContainer,
  },
});
