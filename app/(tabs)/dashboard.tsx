import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { useHabitStore } from '../../src/stores/habit-store';
import { getLevelProgress } from '../../src/constants/xp';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { format, subDays } from 'date-fns';
import { isHabitScheduledForDay } from '../../src/types/habit';
import HeaderAvatar from '../../src/components/HeaderAvatar';

// Habits created after a given day should not count against that day's
// consistency — you can't miss a ritual that didn't exist yet.
function wasHabitActiveOn(habit: { createdAt?: string | null }, dateStr: string) {
  if (!habit.createdAt) return true;
  return habit.createdAt.slice(0, 10) <= dateStr;
}

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

// Heatmap colors (0-4 intensity)
const HEATMAP_COLORS = [
  Colors.surfaceContainerHighest, // 0 - empty
  'rgba(74,225,131,0.2)',         // 1
  'rgba(74,225,131,0.4)',         // 2
  'rgba(74,225,131,0.7)',         // 3
  Colors.secondary,               // 4
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function DashboardScreen() {
  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const getTotalXP = useHabitStore((s) => s.getTotalXP);
  const profileXP = useHabitStore((s) => s.profileXP);

  const totalXP = useMemo(() => getTotalXP(), [logs, profileXP]);
  const { level, currentXP, nextLevelXP, progress: levelProgress } = getLevelProgress(totalXP);

  const activeHabits = useMemo(() => habits.filter(h => !h.isArchived), [habits]);

  // Calculate XP breakdown from logs
  const xpBreakdown = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = logs.filter(l => l.loggedDate === todayStr);
    const earned = todayLogs.reduce((s, l) => s + l.xpAwarded, 0);
    const penalties = todayLogs.reduce((s, l) => s + l.xpPenalty, 0);
    const recovered = todayLogs.reduce((s, l) => s + l.xpRecovered, 0);
    return { earned, penalties, recovered, net: earned - penalties + recovered };
  }, [logs]);

  // Generate heatmap from real logs (7 rows x 26 cols = ~6 months)
  const heatmapData = useMemo(() => {
    const rows: number[][] = [];
    for (let r = 0; r < 7; r++) {
      const row: number[] = [];
      for (let c = 0; c < 26; c++) {
        const daysAgo = (25 - c) * 7 + (6 - r);
        const date = subDays(new Date(), daysAgo);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dow = date.getDay();

        const scheduled = activeHabits.filter(
          h => wasHabitActiveOn(h, dateStr) && isHabitScheduledForDay(h, dow),
        );
        if (scheduled.length === 0) { row.push(0); continue; }

        const completed = scheduled.filter(h =>
          logs.some(l => l.habitId === h.id && l.loggedDate === dateStr && l.completed)
        );
        const ratio = completed.length / scheduled.length;
        const level = ratio >= 1 ? 4 : ratio >= 0.75 ? 3 : ratio >= 0.5 ? 2 : ratio > 0 ? 1 : 0;
        row.push(level);
      }
      rows.push(row);
    }
    return rows;
  }, [activeHabits, logs]);

  // Month labels for heatmap columns
  const heatmapMonthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    for (let c = 0; c < 26; c++) {
      // Take the first day of this column (row 0 = Sunday)
      const daysAgo = (25 - c) * 7 + 6;
      const date = subDays(new Date(), daysAgo);
      const month = date.getMonth();
      if (month !== lastMonth) {
        labels.push({ col: c, label: format(date, 'MMM') });
        lastMonth = month;
      }
    }
    return labels;
  }, []);

  // Last 7 days completion data (moved from profile)
  const last7Days = useMemo(() => {
    const days = [];
    let totalScheduled = 0;
    let totalCompleted = 0;
    for (let d = 6; d >= 0; d--) {
      const date = subDays(new Date(), d);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dow = date.getDay();
      const dayHabits = activeHabits.filter(h => isHabitScheduledForDay(h, dow));
      const scheduled = dayHabits.length;
      let completed = 0;
      dayHabits.forEach(h => {
        const log = logs.find(l => l.habitId === h.id && l.loggedDate === dateStr && l.completed);
        if (log) completed++;
      });
      totalScheduled += scheduled;
      totalCompleted += completed;
      days.push({
        label: format(date, 'EEE').charAt(0),
        scheduled,
        completed,
        allDone: scheduled > 0 && completed === scheduled,
        partial: completed > 0 && completed < scheduled,
        isToday: d === 0,
      });
    }
    const rate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
    return { days, rate };
  }, [logs, activeHabits]);

  // Active Habits — last 7 scheduled days tick/no-tick per habit
  const activeHabitsList = useMemo(() => {
    return activeHabits.map(h => {
      const habitLogs = logs.filter(l => l.habitId === h.id);
      // Last 7 scheduled days
      const ticks: boolean[] = [];
      let count = 0;
      for (let d = 0; d < 60 && count < 7; d++) {
        const date = subDays(new Date(), d);
        const dow = date.getDay();
        const dateStr = format(date, 'yyyy-MM-dd');
        if (!wasHabitActiveOn(h, dateStr)) break;
        if (!isHabitScheduledForDay(h, dow)) continue;
        const log = habitLogs.find(l => l.loggedDate === dateStr);
        ticks.push(!!log?.completed);
        count++;
      }
      return {
        id: h.id,
        icon: h.icon,
        name: h.name,
        color: h.color,
        ticks: ticks.reverse(), // oldest → newest
      };
    });
  }, [activeHabits, logs]);

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <HeaderAvatar size={32} style={styles.avatar} />
          <Text style={styles.headerTitle}>The Ritual</Text>
        </View>
        <Pressable
          style={styles.levelBadge}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/profile');
          }}
        >
          <Text style={styles.levelBadgeText}>Lvl {level}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Level Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
          <View style={styles.levelHeader}>
            <View>
              <Text style={styles.sectionLabel}>CURRENT STANDING</Text>
              <Text style={styles.levelText}>Level {level}</Text>
            </View>
            <Text style={styles.xpText}>
              {totalXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
            </Text>
          </View>

          <View style={styles.xpBarTrack}>
            <Animated.View
              entering={FadeIn.duration(800).delay(300)}
              style={[
                styles.xpBarFill,
                { width: `${Math.min(levelProgress * 100, 100)}%` },
              ]}
            />
            {[0.25, 0.5, 0.75].map((m, i) => (
              <View key={i} style={[styles.xpMilestone, { left: `${m * 100}%` }]} />
            ))}
          </View>
        </Animated.View>

        {/* Stats Row: Habits · Total XP · Last 7 Days */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>HABITS</Text>
            <Text style={[styles.statValue, { color: Colors.white }]}>{activeHabits.length}</Text>
            <Text style={styles.statSub}>active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL XP</Text>
            <Text style={[styles.statValue, { color: Colors.primaryContainer }]}>{totalXP.toLocaleString()}</Text>
            <Text style={styles.statSub}>all time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>LAST 7 DAYS</Text>
            <Text style={[styles.statValue, { color: Colors.secondary }]}>{last7Days.rate}%</Text>
            <View style={styles.miniDotsRow}>
              {last7Days.days.map((d, i) => (
                <View
                  key={i}
                  style={[
                    styles.miniDot,
                    d.allDone && { backgroundColor: Colors.secondary },
                    d.partial && { backgroundColor: Colors.primary },
                    !d.allDone && !d.partial && d.scheduled > 0 && { backgroundColor: Colors.zinc700 },
                    d.scheduled === 0 && { backgroundColor: Colors.zinc800, opacity: 0.3 },
                  ]}
                />
              ))}
            </View>
          </View>
        </Animated.View>

        {/* XP Breakdown — Celestial Ledger */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.card}>
          <Text style={styles.cardTitle}>Celestial Ledger</Text>

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Earned today</Text>
            <Text style={[styles.ledgerValue, { color: Colors.secondary }]}>
              +{xpBreakdown.earned}
            </Text>
          </View>

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Penalties</Text>
            <Text style={[styles.ledgerValue, { color: Colors.error }]}>
              −{xpBreakdown.penalties}
            </Text>
          </View>

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Recovered</Text>
            <Text style={[styles.ledgerValue, { color: Colors.tertiary }]}>
              +{xpBreakdown.recovered}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerNetLabel}>Daily Net</Text>
            <Text style={styles.ledgerNetValue}>
              Net: {xpBreakdown.net >= 0 ? '+' : ''}{xpBreakdown.net}
            </Text>
          </View>
        </Animated.View>

        {/* Consistency Heatmap */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.heatmapCard}>
          <View style={styles.heatmapHeader}>
            <Text style={styles.cardTitle}>Consistency Map</Text>
            <View style={styles.heatmapLegend}>
              <Text style={styles.heatmapLegendLabel}>Less</Text>
              {HEATMAP_COLORS.map((color, i) => (
                <View key={i} style={[styles.heatmapLegendSquare, { backgroundColor: color }]} />
              ))}
              <Text style={styles.heatmapLegendLabel}>More</Text>
            </View>
          </View>

          {/* Month labels */}
          <View style={styles.heatmapMonthRow}>
            {/* Left margin for day labels */}
            <View style={{ width: 16 }} />
            <View style={{ flex: 1, flexDirection: 'row' }}>
              {heatmapMonthLabels.map((ml, i) => {
                // Position each label at its column offset
                const pct = (ml.col / 26) * 100;
                return (
                  <Text
                    key={i}
                    style={[
                      styles.heatmapMonthLabel,
                      { position: 'absolute', left: `${pct}%` },
                    ]}
                  >
                    {ml.label}
                  </Text>
                );
              })}
            </View>
          </View>

          <View style={styles.heatmapBody}>
            {/* Day labels (S M T W T F S) */}
            <View style={styles.heatmapDayLabels}>
              {DAY_LABELS.map((d, i) => (
                <Text
                  key={i}
                  style={[
                    styles.heatmapDayLabel,
                    // Only show every other label to avoid crowding
                    i % 2 === 0 ? {} : { opacity: 0 },
                  ]}
                >
                  {d}
                </Text>
              ))}
            </View>

            {/* Grid */}
            <View style={styles.heatmapGrid}>
              {heatmapData.map((row, r) => (
                <View key={r} style={styles.heatmapRow}>
                  {row.map((val, c) => (
                    <View key={c} style={[styles.heatmapCell, { backgroundColor: HEATMAP_COLORS[val] }]} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Active Habits — 7-day tick/no-tick */}
        <Animated.View entering={FadeInDown.duration(400).delay(500)} style={styles.card}>
          <Text style={styles.cardTitle}>Active Habits</Text>

          {activeHabitsList.length === 0 && (
            <Text style={styles.emptyText}>No active habits yet</Text>
          )}

          {activeHabitsList.map((habit, idx) => (
            <Pressable
              key={habit.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/habit/${habit.id}`);
              }}
              style={[
                styles.pulseRow,
                idx < activeHabitsList.length - 1 && styles.pulseRowBorder,
              ]}
            >
              <View style={styles.pulseLeft}>
                <Text style={styles.pulseIcon}>{habit.icon}</Text>
                <Text style={[styles.pulseName, { color: habit.color }]}>
                  {habit.name}
                </Text>
              </View>

              {/* 7-day tick/no-tick */}
              <View style={styles.tickRow}>
                {habit.ticks.map((done, bi) => (
                  <View key={bi} style={styles.tickCell}>
                    {done ? (
                      <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                    ) : (
                      <Ionicons name="close-circle" size={16} color={Colors.zinc700} />
                    )}
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* ---- Header ---- */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    backgroundColor: Colors.surfaceContainerHigh,
  },
  headerTitle: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes.xl,
    color: Colors.primaryContainer,
  },
  levelBadge: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  levelBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.sm,
    color: Colors.primary,
  },

  /* ---- Scroll ---- */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: TAB_BAR_HEIGHT + 30,
  },

  /* ---- Shared ---- */
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
  },
  cardTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.lg,
    color: Colors.onSurface,
    marginBottom: Spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginVertical: Spacing.md,
  },

  /* ---- Level Section ---- */
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
  },
  levelText: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['6xl'],
    color: Colors.primary,
    lineHeight: FontSizes['6xl'] + 4,
  },
  xpText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.md,
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
  },

  /* ---- XP Bar ---- */
  xpBarTrack: {
    height: 16,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  xpBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  xpMilestone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  /* ---- Stats Row ---- */
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing['2xl'],
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 9,
    color: Colors.zinc500,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes['2xl'],
  },
  statSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.zinc600,
  },
  miniDotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.zinc700,
  },

  /* ---- Celestial Ledger ---- */
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  ledgerLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.onSurfaceVariant,
  },
  ledgerValue: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
  },
  ledgerNetLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.lg,
    color: Colors.onSurface,
  },
  ledgerNetValue: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.xl,
    color: Colors.primary,
  },

  /* ---- Heatmap ---- */
  heatmapCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
  },
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heatmapLegendLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    marginHorizontal: 2,
  },
  heatmapLegendSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  heatmapMonthRow: {
    flexDirection: 'row',
    marginBottom: 4,
    height: 14,
  },
  heatmapMonthLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 9,
    color: Colors.zinc500,
  },
  heatmapBody: {
    flexDirection: 'row',
    gap: 4,
  },
  heatmapDayLabels: {
    justifyContent: 'space-between',
    width: 12,
  },
  heatmapDayLabel: {
    fontFamily: Fonts.body,
    fontSize: 8,
    color: Colors.zinc600,
    textAlign: 'center',
    height: 12,
    lineHeight: 12,
  },
  heatmapGrid: {
    flex: 1,
    gap: 1,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 1,
  },
  heatmapCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 1,
    maxWidth: 12,
    maxHeight: 12,
  },

  /* ---- Active Habits ---- */
  pulseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  pulseRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  pulseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  pulseIcon: {
    fontSize: 24,
  },
  pulseName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
  },
  tickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tickCell: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc600,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});
