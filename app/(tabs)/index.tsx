import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  RefreshControl,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { format, subDays, addDays, isSameDay, isToday } from 'date-fns';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useHabitStore } from '../../src/stores/habit-store';
import { useAuthStore } from '../../src/stores/auth-store';
import { useCapsuleStore } from '../../src/stores/capsule-store';
import { isCapsuleReady } from '../../src/types/capsule';
import { getLevelProgress } from '../../src/constants/xp';
import { isHabitScheduledForDay } from '../../src/types/habit';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
  Shadows,
} from '../../src/constants/theme';
import type { TodayHabit } from '../../src/types/habit';
import ProofSubmissionModal from '../../src/components/ProofSubmissionModal';
import ProofButton from '../../src/components/ProofButton';
import HeaderAvatar from '../../src/components/HeaderAvatar';
import AddHabitSheet from '../../src/components/AddHabitSheet';
import { checkXPLevelNotification } from '../../src/lib/notifications';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateHeader(date: Date): string {
  return format(date, 'EEEE, MMMM d').toUpperCase();
}

/** Build the list of dates for the date picker (30 days back + today + 7 ahead) */
function buildDateList(): Date[] {
  const dates: Date[] = [];
  for (let i = 30; i >= 1; i--) dates.push(subDays(new Date(), i));
  dates.push(new Date());
  return dates;
}

type CardState = 'completed' | 'pending' | 'not_scheduled' | 'urgent';

function getCardState(habit: TodayHabit, hasHistory: boolean): CardState {
  if (!habit.isScheduledToday) return 'not_scheduled';
  if (habit.todayLog?.completed) return 'completed';
  if (hasHistory && habit.missedYesterday && habit.consecutiveMisses >= 1) return 'urgent';
  return 'pending';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header({ selectedDate }: { selectedDate: Date }) {
  const logs = useHabitStore((s) => s.logs);
  const habits = useHabitStore((s) => s.habits);
  const getOverallStreak = useHabitStore((s) => s.getOverallStreak);
  const streak = useMemo(() => getOverallStreak(), [habits, logs]);

  return (
    <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.header}>
      <View style={styles.headerLeft}>
        <HeaderAvatar size={40} style={styles.avatar} />
        <View>
          <Text style={styles.headerTitle}>The Ritual</Text>
          <Text style={styles.headerDate}>{formatDateHeader(selectedDate)}</Text>
        </View>
      </View>

      {streak > 0 && (
        <View style={styles.headerStreak}>
          <Ionicons name="flame" size={18} color={Colors.primaryContainer} />
          <Text style={styles.headerStreakText}>{streak}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── Daily all-complete celebration messages ──────────────────────
// Cycled deterministically per-day so users see a consistent line
// for any given day, but different lines across days.
const ALL_COMPLETE_MESSAGES: { emoji: string; line: string }[] = [
  { emoji: '🔥', line: "All done. You're a machine." },
  { emoji: '💪', line: 'Perfect day. Take the win.' },
  { emoji: '🧘', line: 'Everything checked off. Rest easy.' },
  { emoji: '⚡', line: 'Clean sweep. Momentum is yours.' },
  { emoji: '🎯', line: 'Bullseye on every ritual today.' },
  { emoji: '🌟', line: 'Another perfect day in the books.' },
  { emoji: '🏆', line: 'Undefeated today. Stack another.' },
  { emoji: '🚀', line: 'Fully launched. Keep climbing.' },
  { emoji: '🧠', line: 'Discipline beat motivation today.' },
  { emoji: '🔒', line: 'Locked in. Every single one.' },
  { emoji: '🌅', line: 'You showed up. That is everything.' },
  { emoji: '🎖️', line: 'Earned every point the hard way.' },
  { emoji: '📈', line: 'One more brick in the streak.' },
  { emoji: '🥇', line: 'Gold star day. No shortcuts.' },
  { emoji: '✨', line: 'This is what consistency looks like.' },
  { emoji: '🌊', line: 'Smooth and complete. Ride the wave.' },
  { emoji: '💎', line: 'Polished day. Nothing missed.' },
  { emoji: '🧗', line: 'Another summit. See you tomorrow.' },
  { emoji: '🔨', line: 'Day built. Future self says thanks.' },
  { emoji: '🌱', line: 'Tiny habits, giant compounding.' },
  { emoji: '🎨', line: 'A masterpiece of a day.' },
  { emoji: '⛰️', line: 'No shortcuts, no excuses. Done.' },
  { emoji: '🏹', line: 'Every target hit. Rest up.' },
  { emoji: '🛡️', line: 'Day defended. Streak intact.' },
  { emoji: '🦾', line: 'Iron will. Iron day.' },
  { emoji: '🌙', line: 'Close the day proud. You earned it.' },
  { emoji: '🧩', line: 'Every piece in place. Done and done.' },
  { emoji: '🥷', line: 'Silent grind. Loud results.' },
  { emoji: '🎇', line: 'Light it up. Perfect day sealed.' },
  { emoji: '🕊️', line: 'Peace of mind, earned by action.' },
];

function pickDailyMessage(date: Date) {
  // Deterministic index based on YYYY-MM-DD so the line is stable for a day.
  const key = format(date, 'yyyy-MM-dd');
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % ALL_COMPLETE_MESSAGES.length;
  return ALL_COMPLETE_MESSAGES[idx];
}

function HeroSection({ dateHabits, selectedDate }: { dateHabits: TodayHabit[]; selectedDate: Date }) {
  const logs = useHabitStore((s) => s.logs);
  const getTotalXP = useHabitStore((s) => s.getTotalXP);
  const profileXP = useHabitStore((s) => s.profileXP);
  const totalXP = useMemo(() => getTotalXP(), [logs, profileXP]);
  const { level, currentXP, nextLevelXP } = getLevelProgress(totalXP);
  const xpToNext = nextLevelXP - currentXP;

  const scheduled = dateHabits.filter((h) => h.isScheduledToday);
  const completed = scheduled.filter((h) => h.todayLog?.completed);
  const xpEarned = completed.reduce(
    (sum, h) => sum + (h.todayLog?.xpAwarded ?? 0),
    0,
  );

  const fraction = `${completed.length}/${scheduled.length}`;
  const progress =
    scheduled.length > 0 ? completed.length / scheduled.length : 0;
  const allDone = scheduled.length > 0 && completed.length === scheduled.length;
  const celebration = useMemo(() => pickDailyMessage(selectedDate), [selectedDate]);

  return (
    <>
    <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.hero}>
      {/* Left: Progress ring + XP earned today */}
      <View style={styles.heroLeftContainer}>
        <View style={styles.progressRingOuter}>
          <View
            style={[
              styles.progressRingFill,
              {
                borderColor:
                  progress >= 1
                    ? Colors.secondary
                    : progress > 0
                      ? Colors.primaryContainer
                      : Colors.zinc700,
              },
            ]}
          />
          <View style={styles.progressRingInner}>
            <Text style={styles.progressFraction}>{fraction}</Text>
          </View>
        </View>
        <Animated.Text
          entering={FadeIn.duration(400).delay(150)}
          style={[
            styles.heroXpEarnedToday,
            { color: progress >= 1 ? Colors.secondary : Colors.primaryContainer },
          ]}
        >
          {xpEarned} XP
        </Animated.Text>
      </View>

      {/* Right: Level info */}
      <View style={styles.heroRightContainer}>
        <View style={styles.heroLevelRow}>
          <Animated.Text
            entering={FadeIn.duration(400).delay(300)}
            style={styles.heroLevelNumber}
          >
            {level}
          </Animated.Text>
          <Text style={styles.heroLevelLabel}>LVL</Text>
        </View>
        <Animated.Text
          entering={FadeIn.duration(400).delay(250)}
          style={styles.heroXpUntil}
        >
          {xpToNext} XP to next
        </Animated.Text>
      </View>
    </Animated.View>
    {allDone && (
      <Animated.View
        entering={FadeInDown.duration(500).delay(250)}
        style={styles.allDoneBanner}
      >
        <Text style={styles.allDoneEmoji}>{celebration.emoji}</Text>
        <Text style={styles.allDoneText}>{celebration.line}</Text>
      </Animated.View>
    )}
    </>
  );
}

interface HabitCardProps {
  habit: TodayHabit;
  index: number;
  selectedDate: Date;
  onProofPress?: (logId: string) => void;
  onProofRequired?: (habitId: string) => void;
  onTrackingRequired?: (habitId: string) => void;
}

function HabitCard({ habit, index, selectedDate, onProofPress, onProofRequired, onTrackingRequired }: HabitCardProps) {
  const toggleHabit = useHabitStore((s) => s.toggleHabit);
  const toggleHabitForDate = useHabitStore((s) => s.toggleHabitForDate);
  const logs = useHabitStore((s) => s.logs);
  const getHabitStreak = useHabitStore((s) => s.getHabitStreak);
  const scale = useSharedValue(1);

  const streakInfo = useMemo(() => getHabitStreak(habit.id), [logs, habit.id]);
  const hasHistory = useMemo(() => logs.some(l => l.habitId === habit.id), [logs, habit.id]);
  const isNewHabit = useMemo(() => {
    if (!habit.createdAt) return !hasHistory;
    const created = new Date(habit.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation < 48; // treat as "new" for the first 2 days
  }, [habit.createdAt, hasHistory]);
  const state = getCardState(habit, hasHistory);
  const isTodaySelected = isToday(selectedDate);

  const isCompleted = state === 'completed';
  const isNotScheduled = state === 'not_scheduled';
  const isUrgent = state === 'urgent';
  const isPending = state === 'pending';
  const isActionable = !isNotScheduled;

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleCardPress = useCallback(() => {
    router.push(`/habit/${habit.id}`);
  }, [habit.id]);

  const handleCheckPress = useCallback(() => {
    if (!isActionable) return;

    // If habit requires proof and we're completing (not uncompleting), ask for proof first
    if (!isCompleted && habit.proofRequired !== 'none' && onProofRequired) {
      scale.value = withSequence(
        withTiming(0.95, { duration: 80 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
      onProofRequired(habit.id);
      return;
    }

    // If habit tracks a numeric value, prompt for it before completing
    if (!isCompleted && habit.trackingEnabled && onTrackingRequired) {
      scale.value = withSequence(
        withTiming(0.95, { duration: 80 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
      onTrackingRequired(habit.id);
      return;
    }

    scale.value = withSequence(
      withTiming(0.95, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    if (isTodaySelected) {
      toggleHabit(habit.id);
    } else {
      toggleHabitForDate(habit.id, format(selectedDate, 'yyyy-MM-dd'));
    }
  }, [isActionable, isCompleted, habit.id, habit.proofRequired, habit.trackingEnabled, toggleHabit, toggleHabitForDate, scale, isTodaySelected, selectedDate, onProofRequired, onTrackingRequired]);

  const streakLabel = streakInfo.count > 0
    ? `${streakInfo.count}${(streakInfo.unit as string) === 'week' ? 'w' : 'd'}`
    : null;

  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(300 + index * 60).springify()}
      layout={Layout.springify()}
      style={animatedCardStyle}
    >
      <View
        style={[
          styles.card,
          isNotScheduled && styles.cardNotScheduled,
          isUrgent && styles.cardUrgent,
        ]}
      >
        {/* Tappable body area — navigates to habit detail */}
        <Pressable style={styles.cardBody} onPress={handleCardPress}>
          {/* Emoji circle */}
          <View
            style={[
              styles.cardEmojiCircle,
              isCompleted && styles.cardEmojiCircleCompleted,
              isNotScheduled && styles.cardEmojiCircleDimmed,
            ]}
          >
            <Text
              style={[
                styles.cardEmoji,
                isNotScheduled && styles.cardEmojiDimmed,
              ]}
            >
              {habit.icon}
            </Text>
          </View>

          {/* Center info */}
          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Text
                style={[
                  styles.cardName,
                  isNotScheduled && styles.cardNameDimmed,
                ]}
                numberOfLines={1}
              >
                {habit.name}
              </Text>
              {streakLabel && (
                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={10} color={Colors.primaryContainer} />
                  <Text style={styles.streakBadgeText}>{streakLabel}</Text>
                </View>
              )}
              {habit.reminderTime && !isCompleted && (
                <View style={styles.reminderBadge}>
                  <Ionicons name="notifications" size={9} color={Colors.zinc500} />
                  <Text style={styles.reminderBadgeText}>
                    {(() => {
                      const [h, m] = habit.reminderTime!.split(':').map(Number);
                      const ampm = h < 12 ? 'AM' : 'PM';
                      const h12 = h % 12 || 12;
                      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
                    })()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.cardSubRow}>
              {isCompleted && (
                <Animated.Text entering={FadeIn.duration(300)} style={styles.cardXpEarned}>
                  {habit.xpValue} XP EARNED
                </Animated.Text>
              )}
              {isPending && isNewHabit && (
                <Text style={styles.cardEncourageLabel}>
                  Let's get it! +{habit.xpValue} XP
                </Text>
              )}
              {isPending && !isNewHabit && (
                <Text style={styles.cardXpAvailable}>
                  {habit.xpValue} XP Available
                </Text>
              )}
              {isNotScheduled && (
                <Text style={styles.cardNotScheduledLabel}>
                  NOT SCHEDULED TODAY
                </Text>
              )}
              {isUrgent && !isNewHabit && (
                <Text style={styles.cardUrgentLabel}>
                  −{habit.xpValue} XP if missed again
                </Text>
              )}
              {isUrgent && isNewHabit && (
                <Text style={styles.cardEncourageLabel}>
                  Keep the streak alive! +{habit.xpValue} XP
                </Text>
              )}

              {/* Proof button for today's log if needed */}
              {isActionable && habit.proofRequired !== 'none' && habit.todayLog && (
                <ProofButton
                  proofRequired={habit.proofRequired}
                  proofVerified={habit.todayLog.proofVerified}
                  onPress={() => onProofPress?.(habit.todayLog!.id)}
                />
              )}
            </View>

            <WeekDots habitId={habit.id} habit={habit} />
          </View>
        </Pressable>

        {/* Right: checkbox — separate Pressable, NOT nested */}
        {isActionable ? (
          <Pressable
            style={styles.cardRight}
            onPress={handleCheckPress}
            hitSlop={12}
          >
            {isCompleted ? (
              <Animated.View entering={ZoomIn.duration(300).springify()} style={styles.checkCircleFilled}>
                <Ionicons name="checkmark" size={18} color={Colors.onSecondary} />
              </Animated.View>
            ) : (
              <View style={styles.checkCircleEmpty} />
            )}
          </Pressable>
        ) : (
          <View style={styles.cardRight} />
        )}
      </View>
    </Animated.View>
  );
}

function SectionHeader({
  title,
  count,
  delay,
}: {
  title: string;
  count: number;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(delay)} style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Horizontal date picker strip
// ---------------------------------------------------------------------------

/** Horizontal date picker strip */
function DateSelector({
  selectedDate,
  onSelect,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}) {
  const dates = useMemo(() => buildDateList(), []);
  const flatListRef = useRef<FlatList>(null);
  const todayIndex = useMemo(() => dates.findIndex(d => isToday(d)), [dates]);

  useEffect(() => {
    // Scroll to today on mount
    if (todayIndex >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: Math.max(0, todayIndex - 2), animated: false });
      }, 100);
    }
  }, [todayIndex]);

  const renderItem = useCallback(({ item }: { item: Date }) => {
    const selected = isSameDay(item, selectedDate);
    const today = isToday(item);
    return (
      <Pressable onPress={() => onSelect(item)} style={styles.dateItem}>
        <Text style={[styles.dateDayLabel, selected && styles.dateDayLabelSelected]}>
          {format(item, 'EEEEE')}
        </Text>
        <View
          style={[
            styles.dateCircle,
            selected && styles.dateCircleSelected,
            today && !selected && styles.dateCircleToday,
          ]}
        >
          <Text style={[styles.dateNum, selected && styles.dateNumSelected]}>
            {format(item, 'd')}
          </Text>
        </View>
      </Pressable>
    );
  }, [selectedDate, onSelect]);

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(150)}>
      <FlatList
        ref={flatListRef}
        data={dates}
        renderItem={renderItem}
        keyExtractor={(item) => item.toISOString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateStrip}
        getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
      />
    </Animated.View>
  );
}

// Helper to render week dots
function WeekDots({ habitId, habit }: { habitId: string; habit: TodayHabit }) {
  const logs = useHabitStore((s) => s.logs);
  const habitLogs = useMemo(() => {
    return logs.filter(l => l.habitId === habitId)
      .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
  }, [logs, habitId]);

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const todayDow = new Date().getDay();

  return (
    <View style={styles.weekDots}>
      {dayOrder.map((dow, i) => {
        const daysAgo = ((todayDow - dow) + 7) % 7;
        const date = subDays(new Date(), daysAgo);
        const dateStr = format(date, 'yyyy-MM-dd');
        const scheduled = isHabitScheduledForDay(habit, dow);
        const log = habitLogs.find(l => l.loggedDate === dateStr);
        const isCompleted = log?.completed;

        let bgColor: string = Colors.surfaceContainerHigh;
        if (!scheduled) bgColor = 'rgba(0,0,0,0.2)';
        else if (isCompleted) bgColor = Colors.secondary;

        return (
          <View key={dow} style={[styles.weekDot, { backgroundColor: bgColor }]}>
            {isCompleted && <Ionicons name="checkmark-sharp" size={8} color={Colors.onSecondary} />}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TodayScreen() {
  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const fetchHabits = useHabitStore((s) => s.fetchHabits);
  const fetchLogs = useHabitStore((s) => s.fetchLogs);
  const getTodayHabits = useHabitStore((s) => s.getTodayHabits);
  const getHabitsForDate = useHabitStore((s) => s.getHabitsForDate);
  const user = useAuthStore((s) => s.user);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Proof system state
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedLogForProof, setSelectedLogForProof] = useState<string | null>(null);
  const [selectedHabitForProof, setSelectedHabitForProof] = useState<string | null>(null);

  // Tracking modal state
  const [trackingHabitId, setTrackingHabitId] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');

  // Add-habit chooser sheet (only shown when user already has habits)
  const [showAddSheet, setShowAddSheet] = useState(false);
  const handleAddPress = useCallback(() => {
    if (habits.length === 0) {
      router.push('/habit/new');
      return;
    }
    setShowAddSheet(true);
  }, [habits.length]);

  const isTodaySelected = isToday(selectedDate);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const dateHabits = useMemo(() => {
    if (isTodaySelected) return getTodayHabits();
    return getHabitsForDate(dateStr);
  }, [habits, logs, isTodaySelected, dateStr]);

  const selectedLog = useMemo(() => {
    if (!selectedLogForProof) return undefined;
    return logs.find(l => l.id === selectedLogForProof);
  }, [selectedLogForProof, logs]);

  const fetchProfileXP = useHabitStore((s) => s.fetchProfileXP);
  const setTrackingValue = useHabitStore((s) => s.setTrackingValue);

  // Capsules — just fetch count of ready-to-open
  const capsules = useCapsuleStore((s) => s.capsules);
  const fetchCapsules = useCapsuleStore((s) => s.fetchCapsules);
  const readyCapsuleCount = useMemo(() => {
    const now = new Date();
    return capsules.filter((c) => isCapsuleReady(c, now)).length;
  }, [capsules]);

  // Fetch data from Supabase on mount
  // fetchProfileXP must run AFTER fetchHabits so orphan cleanup sees real habit list
  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchHabits(), fetchLogs()]);
      await fetchProfileXP();

      // Check if user is close to levelling up (max once/week notification)
      const xp = useHabitStore.getState().getTotalXP();
      const progress = getLevelProgress(xp);
      checkXPLevelNotification(xp, progress.nextLevelXP, progress.level + 1);
    };
    load();
    if (user) fetchCapsules(user.id);
  }, [user]);

  const sortedHabits = useMemo(() => {
    const order: Record<CardState, number> = {
      urgent: 0,
      pending: 1,
      completed: 2,
      not_scheduled: 3,
    };
    return [...dateHabits].sort((a, b) => {
      const hasHistoryA = logs.some(l => l.habitId === a.id);
      const hasHistoryB = logs.some(l => l.habitId === b.id);
      return order[getCardState(a, hasHistoryA)] - order[getCardState(b, hasHistoryB)];
    });
  }, [dateHabits, logs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchHabits(), fetchLogs()]);
    await fetchProfileXP();
    setRefreshing(false);
  }, [fetchHabits, fetchLogs, fetchProfileXP]);

  const handleProofPress = useCallback((logId: string) => {
    setSelectedLogForProof(logId);
    setSelectedHabitForProof(null);
    setShowProofModal(true);
  }, []);

  // Called when user taps checkbox on a proof-required habit (complete-with-proof mode)
  const handleProofRequired = useCallback((habitId: string) => {
    setSelectedHabitForProof(habitId);
    setSelectedLogForProof(null);
    setShowProofModal(true);
  }, []);

  const handleTrackingRequired = useCallback((habitId: string) => {
    const h = habits.find(x => x.id === habitId);
    const existing = logs.find(l => l.habitId === habitId && l.loggedDate === dateStr);
    setTrackingHabitId(habitId);
    setTrackingInput(
      existing?.trackingValue != null
        ? String(existing.trackingValue)
        : (h?.trackingGoal != null ? String(h.trackingGoal) : '')
    );
  }, [habits, logs, dateStr]);

  const trackingHabit = useMemo(
    () => (trackingHabitId ? habits.find(h => h.id === trackingHabitId) : undefined),
    [trackingHabitId, habits]
  );

  const handleTrackingSubmit = useCallback(async () => {
    if (!trackingHabitId) return;
    const value = Number(trackingInput);
    if (!trackingInput.trim() || isNaN(value)) return;
    await setTrackingValue(trackingHabitId, dateStr, value);
    setTrackingHabitId(null);
    setTrackingInput('');
  }, [trackingHabitId, trackingInput, dateStr, setTrackingValue]);

  const handleProofSubmitted = () => {
    setShowProofModal(false);
    setSelectedLogForProof(null);
    setSelectedHabitForProof(null);
  };

  // Find the habit for the proof modal (either from log or direct habit selection)
  const habitForProofModal = useMemo(() => {
    if (selectedHabitForProof) {
      return habits.find(h => h.id === selectedHabitForProof);
    }
    if (selectedLog) {
      return habits.find(h => h.id === selectedLog.habitId);
    }
    return undefined;
  }, [selectedLog, selectedHabitForProof, habits]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryContainer}
            colors={[Colors.primaryContainer]}
          />
        }
      >
        <Header selectedDate={selectedDate} />
        <DateSelector selectedDate={selectedDate} onSelect={setSelectedDate} />
        <HeroSection dateHabits={dateHabits} selectedDate={selectedDate} />

        {readyCapsuleCount > 0 && (
          <Animated.View entering={FadeInDown.duration(500).delay(200)}>
            <Pressable
              style={styles.capsuleBanner}
              onPress={() => router.push('/(tabs)/capsules')}
            >
              <View style={styles.capsuleBannerIcon}>
                <Ionicons name="mail-unread" size={22} color={Colors.secondaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.capsuleBannerTitle}>
                  {readyCapsuleCount} capsule{readyCapsuleCount > 1 ? 's' : ''} ready to open
                </Text>
                <Text style={styles.capsuleBannerSub}>Tap to read your message</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.secondaryContainer} />
            </Pressable>
          </Animated.View>
        )}

        {sortedHabits.length > 0 ? (
          <>
            <SectionHeader
              title="MY RITUALS"
              count={sortedHabits.filter(h => h.isScheduledToday).length}
              delay={280}
            />
            {sortedHabits.map((habit, i) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                index={i}
                selectedDate={selectedDate}
                onProofPress={handleProofPress}
                onProofRequired={handleProofRequired}
                onTrackingRequired={handleTrackingRequired}
              />
            ))}
          </>
        ) : (
          <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.emptyState}>
            <Ionicons name="add-circle-outline" size={48} color={Colors.zinc600} />
            <Text style={styles.emptyStateTitle}>No rituals yet</Text>
            <Text style={styles.emptyStateSub}>Pick a goal and we'll suggest habits</Text>
            <Pressable
              style={styles.emptyStateButton}
              onPress={() => router.push('/onboarding')}
            >
              <Ionicons name="sparkles" size={18} color={Colors.onPrimaryContainer} />
              <Text style={styles.emptyStateButtonText}>Browse starters</Text>
            </Pressable>
            <Pressable
              style={[styles.emptyStateButton, styles.emptyStateButtonGhost]}
              onPress={handleAddPress}
            >
              <Ionicons name="add" size={18} color={Colors.onSurface} />
              <Text style={[styles.emptyStateButtonText, { color: Colors.onSurface }]}>
                Create your own
              </Text>
            </Pressable>
          </Animated.View>
        )}

      </ScrollView>

      {/* Floating add-habit button */}
      <Pressable style={styles.fab} onPress={handleAddPress}>
        <Ionicons name="add" size={28} color={Colors.onPrimaryContainer} />
      </Pressable>

      {/* Add-habit chooser — Create your own vs Browse library */}
      <AddHabitSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onCreateOwn={() => {
          setShowAddSheet(false);
          router.push('/habit/new');
        }}
        onBrowse={() => {
          setShowAddSheet(false);
          router.push('/onboarding');
        }}
      />

      {/* Proof Submission Modal — two modes:
          1. Add proof to existing log (selectedLog exists)
          2. Complete with proof (selectedHabitForProof, no log yet) */}
      {habitForProofModal && user && (
        <ProofSubmissionModal
          visible={showProofModal}
          habit={habitForProofModal}
          habitLog={selectedLog}
          userId={user.id}
          dateStr={dateStr}
          onClose={() => {
            setShowProofModal(false);
            setSelectedLogForProof(null);
            setSelectedHabitForProof(null);
          }}
          onProofSubmitted={handleProofSubmitted}
        />
      )}

      {/* Tracking prompt modal */}
      <Modal
        visible={trackingHabitId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTrackingHabitId(null)}
      >
        <KeyboardAvoidingView
          style={styles.trackingBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setTrackingHabitId(null)}
          />
          <View style={styles.trackingModal}>
            <Text style={styles.trackingModalEmoji}>{trackingHabit?.icon}</Text>
            <Text style={styles.trackingModalTitle}>{trackingHabit?.name}</Text>
            <Text style={styles.trackingModalSubtitle}>
              How many {trackingHabit?.trackingUnit || 'units'} today?
              {trackingHabit?.trackingGoal != null && `  ·  Goal: ${trackingHabit.trackingGoal}`}
            </Text>
            <TextInput
              style={styles.trackingModalInput}
              value={trackingInput}
              onChangeText={setTrackingInput}
              keyboardType="numeric"
              autoFocus
              placeholder="0"
              placeholderTextColor={Colors.zinc600}
              selectionColor={Colors.secondary}
              onSubmitEditing={handleTrackingSubmit}
              returnKeyType="done"
            />
            <View style={styles.trackingModalButtons}>
              <Pressable
                style={[styles.trackingModalBtn, styles.trackingModalBtnCancel]}
                onPress={() => setTrackingHabitId(null)}
              >
                <Text style={styles.trackingModalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.trackingModalBtn,
                  styles.trackingModalBtnSave,
                  !trackingInput.trim() && { opacity: 0.5 },
                ]}
                onPress={handleTrackingSubmit}
                disabled={!trackingInput.trim()}
              >
                <Text style={styles.trackingModalBtnSaveText}>Log it</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PROGRESS_RING_SIZE = 80;
const PROGRESS_RING_BORDER = 5;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
const DOT_SIZE = 6;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  capsuleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.secondaryContainer}1F` as any,
    borderWidth: 1,
    borderColor: Colors.secondaryContainer,
  },
  capsuleBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.secondaryContainer}33` as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleBannerTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
  },
  capsuleBannerSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Platform.OS === 'ios' ? 100 : 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: Spacing.lg,
    paddingBottom: TAB_BAR_HEIGHT + 30,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing['2xl'],
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 40, height: 40, borderRadius: BorderRadius.full,
    borderWidth: 2, borderColor: Colors.orange500,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: Fonts.headlineBold, fontSize: FontSizes.xl, color: Colors.orange500 },
  headerDate: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs, color: Colors.zinc500,
    textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2,
  },
  headerStreak: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,140,0,0.12)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full,
  },
  headerStreakText: {
    fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes.lg,
    color: Colors.primaryContainer,
  },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'], marginBottom: Spacing['2xl'], ...Shadows.cardShadow,
  },
  heroLeftContainer: { alignItems: 'center' },
  heroRightContainer: { alignItems: 'flex-end' },
  progressRingOuter: { position: 'relative', marginBottom: Spacing.md },
  progressRingFill: {
    width: PROGRESS_RING_SIZE,
    height: PROGRESS_RING_SIZE,
    borderRadius: PROGRESS_RING_SIZE / 2,
    borderWidth: PROGRESS_RING_BORDER,
    borderColor: Colors.zinc700,
  },
  progressRingInner: {
    position: 'absolute',
    top: PROGRESS_RING_BORDER,
    left: PROGRESS_RING_BORDER,
    width: PROGRESS_RING_SIZE - PROGRESS_RING_BORDER * 2,
    height: PROGRESS_RING_SIZE - PROGRESS_RING_BORDER * 2,
    borderRadius: (PROGRESS_RING_SIZE - PROGRESS_RING_BORDER * 2) / 2,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressFraction: { fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes['2xl'], color: Colors.onSurface },
  heroXpEarnedToday: { fontFamily: Fonts.bodyBold, fontSize: FontSizes.sm },
  heroLevelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLevelNumber: {
    fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes['5xl'],
    color: Colors.primaryContainer, lineHeight: 44,
  },
  heroLevelLabel: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.sm, color: Colors.zinc400,
    marginTop: 2,
  },
  heroXpUntil: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs, color: Colors.zinc500, marginTop: 4,
  },

  // All-complete celebration banner
  allDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.secondary}14` as any,
    borderWidth: 1,
    borderColor: `${Colors.secondary}40` as any,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: -Spacing.md,
    marginBottom: Spacing.lg,
  },
  allDoneEmoji: { fontSize: 20 },
  allDoneText: {
    flex: 1,
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.sm,
    color: Colors.secondary,
    lineHeight: 20,
  },

  // Date strip
  dateStrip: { paddingHorizontal: Spacing.xs, gap: 0, marginBottom: Spacing.lg },
  dateItem: {
    width: 48, alignItems: 'center', gap: 4,
  },
  dateDayLabel: {
    fontFamily: Fonts.body, fontSize: 10, color: Colors.zinc600,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  dateDayLabelSelected: { color: Colors.primaryContainer },
  dateCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
  },
  dateCircleSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  dateCircleToday: {
    borderWidth: 1.5, borderColor: Colors.zinc600,
  },
  dateNum: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.sm, color: Colors.zinc400,
  },
  dateNumSelected: { color: Colors.onPrimaryContainer },

  // Empty state
  emptyState: {
    alignItems: 'center', paddingVertical: Spacing['3xl'], gap: Spacing.md,
  },
  emptyStateTitle: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.xl, color: Colors.onSurface,
  },
  emptyStateSub: {
    fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.zinc500,
  },
  emptyStateButton: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer, paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.md,
  },
  emptyStateButtonText: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.md, color: Colors.onPrimaryContainer,
  },
  emptyStateButtonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.zinc700,
    marginTop: Spacing.sm,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md, marginTop: Spacing.lg,
  },
  sectionLabel: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.sm, color: Colors.zinc500,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionCount: { fontFamily: Fonts.headlineBold, fontSize: FontSizes.lg, color: Colors.onSurface },

  // Cards
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginBottom: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: 'transparent',
  },
  cardNotScheduled: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderLeftColor: 'rgba(0,0,0,0.2)',
  },
  cardUrgent: {},
  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardEmojiCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center', justifyContent: 'center',
  },
  cardEmojiCircleCompleted: { backgroundColor: 'rgba(74,225,131,0.15)' },
  cardEmojiCircleDimmed: { opacity: 0.5 },
  cardEmoji: { fontSize: FontSizes['2xl'] },
  cardEmojiDimmed: { opacity: 0.5 },
  cardInfo: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardName: { fontFamily: Fonts.headlineBold, fontSize: FontSizes.md, color: Colors.onSurface, flex: 1 },
  cardNameDimmed: { color: Colors.zinc500 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,140,0,0.1)', paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  streakBadgeText: { fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes.xs, color: Colors.primaryContainer },
  reminderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(161,161,170,0.1)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  reminderBadgeText: { fontFamily: Fonts.body, fontSize: 10, color: Colors.zinc500 },
  cardSubRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  cardXpEarned: { fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes.xs, color: Colors.secondary },
  cardXpAvailable: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs, color: Colors.zinc500 },
  cardNotScheduledLabel: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs, color: Colors.zinc500 },
  cardUrgentLabel: { fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes.xs, color: Colors.error },
  cardEncourageLabel: { fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs, color: Colors.secondary },

  weekDots: { flexDirection: 'row', gap: 3, marginTop: 6 },
  weekDot: {
    width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },

  cardRight: {
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
  },
  checkCircleEmpty: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.zinc600,
  },
  checkCircleFilled: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center',
  },

  // Tracking modal
  trackingBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  trackingModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    alignItems: 'center',
    ...Shadows.cardShadow,
  },
  trackingModalEmoji: { fontSize: 36, marginBottom: Spacing.sm },
  trackingModalTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.headlineBold,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  trackingModalSubtitle: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.body,
    color: Colors.zinc500,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  trackingModalInput: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSizes['3xl'] ?? 28,
    fontFamily: Fonts.headlineBold,
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  trackingModalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  trackingModalBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  trackingModalBtnCancel: {
    backgroundColor: Colors.surfaceContainerLowest,
  },
  trackingModalBtnCancelText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.zinc400,
  },
  trackingModalBtnSave: {
    backgroundColor: Colors.secondaryContainer,
  },
  trackingModalBtnSaveText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onSecondaryContainer,
  },
});
