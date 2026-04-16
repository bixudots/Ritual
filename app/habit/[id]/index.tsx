import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  Image,
  Modal,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle as SvgCircle, Line, Text as SvgText, Rect as SvgRect } from 'react-native-svg';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../../src/stores/habit-store';
import { useAuthStore } from '../../../src/stores/auth-store';
import { getLevelProgress } from '../../../src/constants/xp';
import { isHabitScheduledForDay } from '../../../src/types/habit';
import {
  format,
  subDays,
  parseISO,
  startOfMonth,
  getDaysInMonth,
  addMonths,
  isBefore,
  isSameDay,
  differenceInCalendarDays,
} from 'date-fns';
import { supabase } from '../../../src/lib/supabase';
import type { HabitLog } from '../../../src/types/habit';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
} from '../../../src/constants/theme';
import ProofSubmissionModal from '../../../src/components/ProofSubmissionModal';
import ProofButton from '../../../src/components/ProofButton';
import { getProofPhotoSignedUrl } from '../../../src/lib/proof-service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Heatmap helpers
// ---------------------------------------------------------------------------
const HEATMAP_COLS = 26; // ~6 months
const HEATMAP_ROWS = 7;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - Spacing.xl * 2 - Spacing['2xl'] * 2) / HEATMAP_COLS) - 2;
const CELL_GAP = 2;

// Mini calendar (last 30 days) — 5 rows × 7 columns, tap to expand.
const CAL_RECENT_DAYS = 30;
const CAL_COLS = 7;
const CAL_GAP = 6;
const CAL_CELL = Math.floor((SCREEN_WIDTH - Spacing.xl * 2 - Spacing['2xl'] * 2 - CAL_GAP * (CAL_COLS - 1)) / CAL_COLS);
// Full calendar modal cell — a bit tighter so a 6-row month fits comfortably.
const CAL_FULL_GAP = 4;
const CAL_FULL_CELL = Math.floor((SCREEN_WIDTH - Spacing.xl * 2 - Spacing['2xl'] * 2 - CAL_FULL_GAP * (CAL_COLS - 1)) / CAL_COLS);
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getHeatmapColor(level: number): string {
  switch (level) {
    case 0: return Colors.surfaceContainerLowest;
    case 1: return 'rgba(74, 225, 131, 0.4)';
    case 2: return Colors.secondary;
    default: return Colors.surfaceContainerLowest;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const getHabitById = useHabitStore((s) => s.getHabitById);
  const logs = useHabitStore((s) => s.logs);
  const habits = useHabitStore((s) => s.habits);
  const getHabitStreak = useHabitStore((s) => s.getHabitStreak);
  const getTotalXP = useHabitStore((s) => s.getTotalXP);
  const user = useAuthStore((s) => s.user);

  // Proof system state
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedLogForProof, setSelectedLogForProof] = useState<string | null>(null);

  // Chart tooltip state
  const [trackingTooltip, setTrackingTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [xpTooltip, setXpTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);

  const habit = useMemo(() => id ? getHabitById(id) : undefined, [id, habits]);
  const totalXP = getTotalXP();
  const { level } = getLevelProgress(totalXP);
  const displayName = user?.user_metadata?.display_name || 'Ritualist';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // If habit was deleted, go back
  useEffect(() => {
    if (id && habits.length > 0 && !habit) {
      router.back();
    }
  }, [habit, habits, id]);

  // Full log history for this habit — the store only caches the last ~60
  // days, which would give a completion-rate that's always a rolling window
  // rather than "since the habit was created". For the detail page we fetch
  // every row for this habit id once on mount.
  const [fullHabitLogs, setFullHabitLogs] = useState<HabitLog[] | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('habit_id', id)
        .order('logged_date', { ascending: false });
      if (cancelled || error || !data) return;
      const mapped: HabitLog[] = data.map((row: any) => ({
        id: row.id,
        habitId: row.habit_id,
        userId: row.user_id,
        loggedDate: row.logged_date,
        completed: row.completed,
        xpAwarded: row.xp_awarded,
        xpPenalty: row.xp_penalty,
        xpRecovered: row.xp_recovered,
        proofPhotoUrl: row.proof_photo_url,
        proofLocationLat: row.proof_location_lat,
        proofLocationLng: row.proof_location_lng,
        proofVerified: row.proof_verified,
        note: row.note,
        trackingValue: row.tracking_value ?? undefined,
        createdAt: row.created_at,
      }));
      setFullHabitLogs(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Habit-specific logs — prefer the unbounded fetch, fall back to the
  // 60-day store cache while it loads. Merging store updates on top of the
  // fetched set keeps optimistic check-ins visible immediately.
  const habitLogs = useMemo(() => {
    if (!id) return [];
    const storeLogs = logs.filter((l) => l.habitId === id);
    if (!fullHabitLogs) {
      return [...storeLogs].sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
    }
    // Merge: full logs as base, store logs overwrite by date (newer wins).
    const byDate = new Map<string, HabitLog>();
    for (const l of fullHabitLogs) byDate.set(l.loggedDate, l);
    for (const l of storeLogs) byDate.set(l.loggedDate, l);
    return Array.from(byDate.values()).sort((a, b) =>
      b.loggedDate.localeCompare(a.loggedDate),
    );
  }, [logs, id, fullHabitLogs]);

  // Get the selected log for proof submission
  const selectedLog = useMemo(() => {
    if (!selectedLogForProof) return undefined;
    return habitLogs.find(l => l.id === selectedLogForProof);
  }, [selectedLogForProof, habitLogs]);

  // Streak
  const streakInfo = useMemo(() => {
    if (!id) return { count: 0, unit: 'day' as const };
    return getHabitStreak(id);
  }, [id, logs]);

  // Completion rate + longest streak, computed from the habit's creation
  // date forward. Both numbers walk the same day-by-day loop so a single
  // pass gives us:
  //   - scheduled/completed count for the percentage
  //   - longest run of consecutive scheduled days completed
  //   - total XP earned and penalties lost (for the bento card)
  // Longest streak is recomputed client-side because the DB column isn't
  // maintained by the client, so it would otherwise be stale at 0.
  const { completionRate, longestStreak, totalHabitXP, totalPenalty } = useMemo(() => {
    if (!habit) {
      return { completionRate: 0, longestStreak: 0, totalHabitXP: 0, totalPenalty: 0 };
    }
    const createdDate = parseISO(habit.createdAt);
    const today = new Date();

    // If user backdated logs before the habit's creation date, extend the
    // window to include those days.
    const earliestLog = habitLogs.length > 0
      ? habitLogs.reduce((earliest, l) =>
          l.loggedDate < earliest ? l.loggedDate : earliest,
          habitLogs[0].loggedDate)
      : null;
    const startDate = earliestLog && earliestLog < format(createdDate, 'yyyy-MM-dd')
      ? parseISO(earliestLog)
      : createdDate;

    const totalDays = Math.max(0, differenceInCalendarDays(today, startDate)) + 1;

    // Fast lookup of logs by YYYY-MM-DD to avoid an O(n²) find() per day.
    const logByDate = new Map<string, HabitLog>();
    for (const l of habitLogs) logByDate.set(l.loggedDate, l);

    let scheduled = 0;
    let completed = 0;
    let earned = 0;
    let penalty = 0;
    let runLength = 0;
    let maxRun = 0;

    // Walk oldest → newest so the streak counter grows in the right order.
    for (let i = totalDays - 1; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dow = date.getDay();
      if (!isHabitScheduledForDay(habit, dow)) continue;

      // Before creation date — only count if there's a log (backdated entry)
      const log = logByDate.get(dateStr);
      const beforeCreation = isBefore(date, createdDate) && !isSameDay(date, createdDate);
      if (beforeCreation && !log) continue;

      scheduled++;
      if (log?.completed) {
        completed++;
        earned += log.xpAwarded;
        runLength++;
        if (runLength > maxRun) maxRun = runLength;
      } else {
        // Any missed scheduled day ends the current run. Today counts as
        // "in-progress" rather than a break — don't reset the streak on it.
        if (!isSameDay(date, today)) runLength = 0;
        if (log) penalty += log.xpPenalty;
      }
    }

    return {
      completionRate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
      longestStreak: maxRun,
      totalHabitXP: earned,
      totalPenalty: penalty,
    };
  }, [habit, habitLogs]);

  // Heatmap from real data (last ~6 months)
  const heatmapData = useMemo(() => {
    if (!habit) return [];
    const data: number[][] = [];
    const totalDays = HEATMAP_COLS * 7;
    for (let col = HEATMAP_COLS - 1; col >= 0; col--) {
      const week: number[] = [];
      for (let row = 0; row < HEATMAP_ROWS; row++) {
        const daysAgo = col * 7 + (6 - row);
        if (daysAgo >= totalDays) { week.push(0); continue; }
        const date = subDays(new Date(), daysAgo);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dow = date.getDay();
        if (!isHabitScheduledForDay(habit, dow)) {
          week.push(-1); // not scheduled
          continue;
        }
        const log = habitLogs.find(l => l.loggedDate === dateStr);
        week.push(log?.completed ? 2 : 0);
      }
      data.push(week);
    }
    return data;
  }, [habit, habitLogs]);

  // This week status from real data
  const thisWeek = useMemo(() => {
    if (!habit) return [];
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Monday first
    const todayDow = new Date().getDay();
    return dayOrder.map((dow, i) => {
      const daysAgo = ((todayDow - dow) + 7) % 7;
      const date = subDays(new Date(), daysAgo);
      const dateStr = format(date, 'yyyy-MM-dd');
      const scheduled = isHabitScheduledForDay(habit, dow);
      if (!scheduled) return { label: days[i], status: 'na' as const };
      const log = habitLogs.find(l => l.loggedDate === dateStr);
      if (log?.completed) return { label: days[i], status: 'done' as const };
      if (daysAgo === 0) return { label: days[i], status: 'empty' as const }; // today, not yet
      return { label: days[i], status: 'missed' as const };
    });
  }, [habit, habitLogs]);

  // XP progression from real logs (cumulative)
  const chartData = useMemo(() => {
    if (habitLogs.length === 0) return { points: [] as number[], labels: [] as string[], dates: [] as string[] };
    const sorted = [...habitLogs].sort((a, b) => a.loggedDate.localeCompare(b.loggedDate));
    const xpByDate = new Map<string, number>();
    for (const l of sorted) {
      const net = l.xpAwarded + l.xpRecovered - l.xpPenalty;
      xpByDate.set(l.loggedDate, (xpByDate.get(l.loggedDate) ?? 0) + net);
    }
    const dates = Array.from(xpByDate.keys()).sort();
    let running = 0;
    const cumDates: { date: string; xp: number }[] = [];
    for (const d of dates) {
      running += xpByDate.get(d) ?? 0;
      cumDates.push({ date: d, xp: running });
    }
    // Sample up to 12 points
    let sampled = cumDates;
    if (cumDates.length > 12) {
      const step = (cumDates.length - 1) / 11;
      sampled = [];
      for (let i = 0; i < 12; i++) sampled.push(cumDates[Math.round(i * step)]);
    }
    return {
      points: sampled.map(p => p.xp),
      dates: sampled.map(p => p.date),
      labels: sampled.map((p, i) => {
        if (sampled.length <= 7 || i === 0 || i === sampled.length - 1) {
          return format(new Date(p.date + 'T12:00:00'), 'MMM d');
        }
        return '';
      }),
    };
  }, [habitLogs]);

  // Tracking values over time (only if habit tracks a number)
  const trackingChart = useMemo(() => {
    if (!habit?.trackingEnabled) return { points: [] as number[], labels: [] as string[], dates: [] as string[] };
    const withValues = habitLogs
      .filter(l => l.trackingValue != null)
      .sort((a, b) => a.loggedDate.localeCompare(b.loggedDate));
    if (withValues.length === 0) return { points: [], labels: [], dates: [] };
    let sampled = withValues;
    if (withValues.length > 12) {
      const step = (withValues.length - 1) / 11;
      sampled = [];
      for (let i = 0; i < 12; i++) sampled.push(withValues[Math.round(i * step)]);
    }
    return {
      points: sampled.map(p => Number(p.trackingValue)),
      dates: sampled.map(p => p.loggedDate),
      labels: sampled.map((p, i) => {
        if (sampled.length <= 7 || i === 0 || i === sampled.length - 1) {
          return format(new Date(p.loggedDate + 'T12:00:00'), 'MMM d');
        }
        return '';
      }),
    };
  }, [habit, habitLogs]);

  // History entries from real logs
  const historyEntries = useMemo(() => {
    return habitLogs.slice(0, 15).map(l => ({
      id: l.id,
      date: format(new Date(l.loggedDate + 'T12:00:00'), 'EEEE, MMM d'),
      completed: l.completed,
      xp: l.completed ? l.xpAwarded : -(l.xpPenalty || 0),
      trackingValue: l.trackingValue ?? undefined,
    }));
  }, [habitLogs]);

  // Photo log — all logs with a proof photo, newest first
  const photoLogs = useMemo(() => {
    return habitLogs
      .filter(l => !!l.proofPhotoUrl)
      .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
  }, [habitLogs]);

  const [viewerPhotoUrl, setViewerPhotoUrl] = useState<string | null>(null);
  const [viewerDate, setViewerDate] = useState<string>('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  // Set of YYYY-MM-DD dates where the habit was completed. Used by the
  // calendar cells to decide whether to render a filled dot.
  const completedDateSet = useMemo(() => {
    const s = new Set<string>();
    for (const l of habitLogs) if (l.completed) s.add(l.loggedDate);
    return s;
  }, [habitLogs]);

  // Last 30 days (rows of 7, oldest top-left → today bottom-right).
  const last30Days = useMemo(() => {
    const days: { date: Date; dateStr: string; done: boolean }[] = [];
    for (let i = CAL_RECENT_DAYS - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      days.push({ date: d, dateStr, done: completedDateSet.has(dateStr) });
    }
    return days;
  }, [completedDateSet]);

  // Full timeline: up to 2 years back from today (or earliest log, whichever
  // is older), newest month first. User can scroll back through history.
  const monthBlocks = useMemo(() => {
    if (!habit) return [];
    const firstLogDate =
      habitLogs.length > 0
        ? parseISO(habitLogs[habitLogs.length - 1].loggedDate)
        : parseISO(habit.createdAt);
    const habitCreated = parseISO(habit.createdAt);
    const twoYearsAgo = subDays(new Date(), 730);
    // Go back to the earliest of: 2 years ago, habit creation, or first log
    let earliest = isBefore(firstLogDate, habitCreated) ? firstLogDate : habitCreated;
    if (isBefore(twoYearsAgo, earliest)) earliest = twoYearsAgo;
    const start = startOfMonth(earliest);
    const today = new Date();
    const end = startOfMonth(today);
    const months: {
      key: string;
      label: string;
      cells: ({ day: number; dateStr: string; done: boolean; isFuture: boolean } | null)[];
    }[] = [];
    let cursor = start;
    while (!isBefore(end, cursor)) {
      const daysInMonth = getDaysInMonth(cursor);
      const leadingBlanks = cursor.getDay(); // 0 = Sunday
      const cells: ({ day: number; dateStr: string; done: boolean; isFuture: boolean } | null)[] = [];
      for (let i = 0; i < leadingBlanks; i++) cells.push(null);
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
        const dateStr = format(d, 'yyyy-MM-dd');
        cells.push({
          day,
          dateStr,
          done: completedDateSet.has(dateStr),
          isFuture: isBefore(today, d) && !isSameDay(today, d),
        });
      }
      months.push({
        key: format(cursor, 'yyyy-MM'),
        label: format(cursor, 'MMMM yyyy'),
        cells,
      });
      cursor = addMonths(cursor, 1);
    }
    return months.reverse();
  }, [habit, habitLogs, completedDateSet]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        photoLogs.map(async (l) => {
          const signed = await getProofPhotoSignedUrl(l.proofPhotoUrl);
          return [l.id, signed || l.proofPhotoUrl!] as const;
        })
      );
      if (!cancelled) {
        setSignedUrls(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoLogs]);

  const handleProofPress = (logId: string) => {
    setSelectedLogForProof(logId);
    setShowProofModal(true);
  };

  const handleProofSubmitted = () => {
    setShowProofModal(false);
    setSelectedLogForProof(null);
    // Store will automatically update due to habitLogs dependency
  };

  if (!habit) {
    return (
      <View style={styles.container}>
        <View style={styles.navHeader}>
          <Pressable style={styles.navLeft} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.zinc400} />
            <Text style={styles.navTitle}>Back</Text>
          </Pressable>
        </View>
        <Text style={{ color: Colors.zinc500, textAlign: 'center', marginTop: 100 }}>
          Habit not found
        </Text>
      </View>
    );
  }

  const chartWidth = SCREEN_WIDTH - Spacing.xl * 2 - Spacing['2xl'] * 2;
  const chartHeight = 140;
  const cPts = chartData.points;
  const cRawMin = Math.min(...cPts, 0);
  const cRawMax = Math.max(...cPts);
  const cDataRange = cRawMax - cRawMin;
  const cPadding = cDataRange === 0 ? Math.max(Math.abs(cRawMin) * 0.2, 1) : cDataRange * 0.15;
  const cMin = Math.max(0, cRawMin - cPadding);
  const cMax = cRawMax + cPadding;

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.navHeader}>
        <Pressable style={styles.navLeft} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.zinc400} />
          <Text style={styles.navTitle}>The Ritual</Text>
        </Pressable>
        <View style={styles.navRight}>
          <View style={styles.levelPill}>
            <Text style={styles.levelText}>Lvl {level}</Text>
          </View>
          <View style={styles.navAvatar}>
            <Text style={styles.navAvatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Habit Header */}
        <View style={styles.habitHeader}>
          <View style={styles.habitHeaderLeft}>
            <Text style={styles.habitIcon}>{habit.icon}</Text>
            <Text style={styles.habitName}>{habit.name}</Text>
          </View>
          <View style={styles.habitHeaderRight}>
            <View style={styles.xpChip}>
              <Text style={styles.xpChipText}>{'⚡ '}{habit.xpValue} XP</Text>
            </View>
            <View style={styles.streakRow}>
              <Text style={styles.streakFlame}>{'🔥'}</Text>
              <Text style={styles.streakCount}>{streakInfo.count}</Text>
            </View>
          </View>
        </View>

        {/* Tracking Values Chart — shown first for trackable habits */}
        {habit.trackingEnabled && trackingChart.points.length >= 2 && (() => {
          const tPts = trackingChart.points;
          const rawMin = Math.min(...tPts);
          const rawMax = Math.max(...tPts);
          // Smart Y-axis: pad 20% above & below so flat data sits in the middle
          const dataRange = rawMax - rawMin;
          const padding = dataRange === 0 ? Math.max(Math.abs(rawMin) * 0.2, 1) : dataRange * 0.15;
          const tMin = Math.max(0, rawMin - padding);
          const tMax = rawMax + padding;
          const latest = tPts[tPts.length - 1];
          const avg = tPts.reduce((a, b) => a + b, 0) / tPts.length;
          const yAxisW = 36;
          const plotW = chartWidth - yAxisW;
          // Nice Y-axis tick values
          const niceStep = (() => {
            const r = tMax - tMin;
            const rough = r / 3;
            const mag = Math.pow(10, Math.floor(Math.log10(rough)));
            const norm = rough / mag;
            if (norm <= 1.5) return mag;
            if (norm <= 3.5) return 2 * mag;
            if (norm <= 7.5) return 5 * mag;
            return 10 * mag;
          })();
          const yTicks: number[] = [];
          const firstTick = Math.ceil(tMin / niceStep) * niceStep;
          for (let v = firstTick; v <= tMax; v += niceStep) yTicks.push(Math.round(v * 100) / 100);
          if (yTicks.length < 2) { yTicks.length = 0; yTicks.push(rawMin, rawMax); }
          return (
            <Pressable onPress={() => setTrackingTooltip(null)} style={styles.sectionCard}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>
                  {habit.trackingUnit ? habit.trackingUnit.toUpperCase() : 'TRACKED VALUE'} OVER TIME
                </Text>
                <Text style={styles.sectionSubLabel}>
                  {Math.round(latest)} · avg {Math.round(avg)}
                  {habit.trackingGoal != null ? ` · goal ${habit.trackingGoal}` : ''}
                </Text>
              </View>
              <View style={{ height: chartHeight + 30 }}>
                <View style={{ flexDirection: 'row' }}>
                  {/* Y-axis labels */}
                  <View style={{ width: yAxisW, height: chartHeight, justifyContent: 'space-between', paddingVertical: 4 }}>
                    {[...yTicks].reverse().map((v, i) => (
                      <Text key={i} style={styles.yAxisLabel}>{Number.isInteger(v) ? v : v.toFixed(1)}</Text>
                    ))}
                  </View>
                  {/* Chart area */}
                  <View style={{ flex: 1 }}>
                    <Svg width={plotW} height={chartHeight} viewBox={`0 0 ${plotW} ${chartHeight}`}>
                      <Defs>
                        <LinearGradient id="trackingAreaGradTop" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor={Colors.secondary} stopOpacity="0.3" />
                          <Stop offset="1" stopColor={Colors.secondary} stopOpacity="0.02" />
                        </LinearGradient>
                      </Defs>
                      {(() => {
                        const padY = 8;
                        const h = chartHeight - padY * 2;
                        const range = tMax - tMin || 1;
                        const coords = tPts.map((v, i) => ({
                          x: (i / (tPts.length - 1)) * plotW,
                          y: padY + h - ((v - tMin) / range) * h,
                        }));
                        // Grid lines
                        const gridLines = yTicks.map(v => padY + h - ((v - tMin) / range) * h);
                        let linePath = `M ${coords[0].x},${coords[0].y}`;
                        for (let i = 0; i < coords.length - 1; i++) {
                          const p0 = coords[Math.max(i - 1, 0)];
                          const p1 = coords[i];
                          const p2 = coords[i + 1];
                          const p3 = coords[Math.min(i + 2, coords.length - 1)];
                          const t = 0.3;
                          linePath += ` C ${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
                        }
                        const areaPath = linePath + ` L ${coords[coords.length - 1].x},${chartHeight} L ${coords[0].x},${chartHeight} Z`;
                        let goalLineY: number | null = null;
                        if (habit.trackingGoal != null) {
                          const g = habit.trackingGoal;
                          if (g >= tMin && g <= tMax) {
                            goalLineY = padY + h - ((g - tMin) / range) * h;
                          }
                        }
                        return (
                          <>
                            {/* Grid lines */}
                            {gridLines.map((gy, i) => (
                              <Line key={i} x1={0} y1={gy} x2={plotW} y2={gy} stroke={Colors.zinc800} strokeWidth={0.5} opacity={0.5} />
                            ))}
                            <Path d={areaPath} fill="url(#trackingAreaGradTop)" />
                            <Path d={linePath} fill="none" stroke={Colors.secondary} strokeWidth={2} strokeLinecap="round" />
                            {goalLineY !== null && (
                              <Path
                                d={`M 0,${goalLineY} L ${plotW},${goalLineY}`}
                                fill="none"
                                stroke={Colors.primaryContainer}
                                strokeWidth={1}
                                strokeDasharray="4,4"
                                opacity={0.6}
                              />
                            )}
                            {/* Data points — all visible, tappable */}
                            {coords.map((c, i) => (
                              <SvgCircle
                                key={i}
                                cx={c.x}
                                cy={c.y}
                                r={trackingTooltip?.idx === i ? 6 : 4}
                                fill={trackingTooltip?.idx === i ? Colors.primary : Colors.secondary}
                                stroke={trackingTooltip?.idx === i ? Colors.secondary : 'none'}
                                strokeWidth={trackingTooltip?.idx === i ? 2 : 0}
                                onPress={() => setTrackingTooltip(trackingTooltip?.idx === i ? null : { idx: i, x: c.x, y: c.y })}
                              />
                            ))}
                            {/* Tooltip */}
                            {trackingTooltip && (() => {
                              const ti = trackingTooltip.idx;
                              const val = tPts[ti];
                              const dateStr = trackingChart.dates[ti];
                              const label = `${Math.round(val * 10) / 10}${habit.trackingUnit ? ' ' + habit.trackingUnit : ''}`;
                              const dateFmt = format(new Date(dateStr + 'T12:00:00'), 'MMM d');
                              const text = `${label}  ·  ${dateFmt}`;
                              const textW = text.length * 6.5 + 16;
                              const tipX = Math.max(4, Math.min(trackingTooltip.x - textW / 2, plotW - textW - 4));
                              const tipY = trackingTooltip.y - 32;
                              return (
                                <>
                                  <Line x1={trackingTooltip.x} y1={trackingTooltip.y} x2={trackingTooltip.x} y2={chartHeight} stroke={Colors.zinc600} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
                                  <SvgRect x={tipX} y={tipY} width={textW} height={22} rx={6} fill={Colors.surfaceContainerHigh} stroke={Colors.zinc700} strokeWidth={0.5} />
                                  <SvgText x={tipX + textW / 2} y={tipY + 15} textAnchor="middle" fill={Colors.onSurface} fontSize={11} fontWeight="600">{text}</SvgText>
                                </>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </Svg>
                  </View>
                </View>
                <View style={[styles.chartXAxis, { marginLeft: yAxisW }]}>
                  {trackingChart.labels.map((l, i) => (
                    <Text key={i} style={styles.chartXLabel}>{l}</Text>
                  ))}
                </View>
              </View>
            </Pressable>
          );
        })()}

        {/* Annual Heatmap */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>RITUAL FREQUENCY</Text>
            <Text style={styles.sectionSubLabel}>Past {HEATMAP_COLS * 7} Days</Text>
          </View>
          <View style={styles.heatmapWithLabels}>
            {/* Day labels */}
            <View style={styles.heatmapDayLabels}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text
                  key={i}
                  style={[
                    styles.heatmapDayLabel,
                    i % 2 !== 0 && { opacity: 0 },
                  ]}
                >
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.heatmapContainer}>
              {heatmapData.map((week, colIdx) => (
                <View key={colIdx} style={styles.heatmapCol}>
                  {week.map((lv, rowIdx) => (
                    <View
                      key={rowIdx}
                      style={[
                        styles.heatmapCell,
                        {
                          backgroundColor: lv === -1
                            ? Colors.surfaceContainerLowest
                            : getHeatmapColor(lv),
                          opacity: lv === -1 ? 0.3 : 1,
                        },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Calendar — last 30 days, tap to see full timeline */}
        <Pressable
          style={styles.sectionCard}
          onPress={() => setShowFullCalendar(true)}
          accessibilityRole="button"
          accessibilityLabel="Open full calendar"
        >
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>CALENDAR</Text>
            <Text style={styles.sectionSubLabel}>Last 30 days · tap to expand</Text>
          </View>
          <View style={styles.calGrid}>
            {last30Days.map((d) => {
              const isToday = isSameDay(d.date, new Date());
              return (
                <View
                  key={d.dateStr}
                  style={[
                    styles.calCell,
                    d.done && styles.calCellDone,
                    isToday && !d.done && styles.calCellToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.calCellText,
                      d.done && styles.calCellTextDone,
                    ]}
                  >
                    {d.date.getDate()}
                  </Text>
                </View>
              );
            })}
          </View>
        </Pressable>

        {/* Stats Bento Grid */}
        <View style={styles.bentoGrid}>
          <View style={styles.bentoRow}>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>CURRENT STREAK</Text>
              <Text style={styles.bentoFireGhost}>{'🔥'}</Text>
              <Text style={[styles.bentoValue, { color: Colors.primary }]}>
                {streakInfo.count}
              </Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>LONGEST</Text>
              <Text style={[styles.bentoValue, { color: Colors.white }]}>
                {longestStreak}
              </Text>
            </View>
          </View>

          <View style={styles.bentoRow}>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>COMPLETION</Text>
              <Text style={[styles.bentoValue, { color: Colors.secondary }]}>
                {completionRate}%
              </Text>
            </View>
            <View style={styles.bentoCard}>
              <View style={styles.bentoXpHeader}>
                <Text style={styles.bentoLabel}>TOTAL XP</Text>
                {totalPenalty > 0 && (
                  <Text style={styles.bentoPenalty}>-{totalPenalty} penalty</Text>
                )}
              </View>
              <Text style={[styles.bentoValue, { color: Colors.tertiary }]}>
                {totalHabitXP}
              </Text>
            </View>
          </View>

          {/* This Week */}
          <View style={styles.bentoCardWide}>
            <Text style={styles.bentoLabel}>THIS WEEK</Text>
            <View style={styles.weekRow}>
              {thisWeek.map((day, i) => (
                <View key={i} style={styles.weekDayCol}>
                  <Text style={styles.weekDayLabel}>{day.label}</Text>
                  {day.status === 'done' && (
                    <View style={[styles.weekCircle, styles.weekDone]}>
                      <Ionicons name="checkmark" size={14} color={Colors.secondary} />
                    </View>
                  )}
                  {day.status === 'missed' && (
                    <View style={[styles.weekCircle, styles.weekMissed]}>
                      <Ionicons name="close" size={14} color={Colors.error} />
                    </View>
                  )}
                  {day.status === 'empty' && (
                    <View style={[styles.weekCircle, styles.weekEmpty]} />
                  )}
                  {day.status === 'na' && (
                    <View style={[styles.weekCircle, { backgroundColor: Colors.zinc800, opacity: 0.3 }]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* XP Progression Curve */}
        {cPts.length >= 2 && (() => {
          const yAxisW = 36;
          const plotW = chartWidth - yAxisW;
          const xpNiceStep = (() => {
            const r = cMax - cMin;
            const rough = r / 3;
            if (rough === 0) return 1;
            const mag = Math.pow(10, Math.floor(Math.log10(rough)));
            const norm = rough / mag;
            if (norm <= 1.5) return mag;
            if (norm <= 3.5) return 2 * mag;
            if (norm <= 7.5) return 5 * mag;
            return 10 * mag;
          })();
          const xpTicks: number[] = [];
          const firstXpTick = Math.ceil(cMin / xpNiceStep) * xpNiceStep;
          for (let v = firstXpTick; v <= cMax; v += xpNiceStep) xpTicks.push(Math.round(v));
          if (xpTicks.length < 2) { xpTicks.length = 0; xpTicks.push(Math.round(cRawMin), Math.round(cRawMax)); }
          return (
            <Pressable onPress={() => setXpTooltip(null)} style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>XP PROGRESSION</Text>
              <View style={{ height: chartHeight + 30 }}>
                <View style={{ flexDirection: 'row' }}>
                  {/* Y-axis labels */}
                  <View style={{ width: yAxisW, height: chartHeight, justifyContent: 'space-between', paddingVertical: 4 }}>
                    {[...xpTicks].reverse().map((v, i) => (
                      <Text key={i} style={styles.yAxisLabel}>{v}</Text>
                    ))}
                  </View>
                  {/* Chart area */}
                  <View style={{ flex: 1 }}>
                    <Svg width={plotW} height={chartHeight} viewBox={`0 0 ${plotW} ${chartHeight}`}>
                      <Defs>
                        <LinearGradient id="habitAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor={Colors.tertiary} stopOpacity="0.3" />
                          <Stop offset="1" stopColor={Colors.tertiary} stopOpacity="0.02" />
                        </LinearGradient>
                      </Defs>
                      {(() => {
                        const padY = 8;
                        const h = chartHeight - padY * 2;
                        const range = cMax - cMin || 1;
                        const coords = cPts.map((v, i) => ({
                          x: (i / (cPts.length - 1)) * plotW,
                          y: padY + h - ((v - cMin) / range) * h,
                        }));
                        // Grid lines
                        const gridLines = xpTicks.map(v => padY + h - ((v - cMin) / range) * h);
                        let linePath = `M ${coords[0].x},${coords[0].y}`;
                        for (let i = 0; i < coords.length - 1; i++) {
                          const p0 = coords[Math.max(i - 1, 0)];
                          const p1 = coords[i];
                          const p2 = coords[i + 1];
                          const p3 = coords[Math.min(i + 2, coords.length - 1)];
                          const t = 0.3;
                          linePath += ` C ${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
                        }
                        const areaPath = linePath + ` L ${coords[coords.length - 1].x},${chartHeight} L ${coords[0].x},${chartHeight} Z`;
                        return (
                          <>
                            {/* Grid lines */}
                            {gridLines.map((gy, i) => (
                              <Line key={i} x1={0} y1={gy} x2={plotW} y2={gy} stroke={Colors.zinc800} strokeWidth={0.5} opacity={0.5} />
                            ))}
                            <Path d={areaPath} fill="url(#habitAreaGrad)" />
                            <Path d={linePath} fill="none" stroke={Colors.tertiary} strokeWidth={2} strokeLinecap="round" />
                            {/* Data points — all visible, tappable */}
                            {coords.map((c, i) => (
                              <SvgCircle
                                key={i}
                                cx={c.x}
                                cy={c.y}
                                r={xpTooltip?.idx === i ? 6 : 4}
                                fill={xpTooltip?.idx === i ? Colors.primary : Colors.tertiary}
                                stroke={xpTooltip?.idx === i ? Colors.tertiary : 'none'}
                                strokeWidth={xpTooltip?.idx === i ? 2 : 0}
                                onPress={() => setXpTooltip(xpTooltip?.idx === i ? null : { idx: i, x: c.x, y: c.y })}
                              />
                            ))}
                            {/* Tooltip */}
                            {xpTooltip && (() => {
                              const xi = xpTooltip.idx;
                              const val = cPts[xi];
                              const dateStr = chartData.dates[xi];
                              const dateFmt = format(new Date(dateStr + 'T12:00:00'), 'MMM d');
                              const text = `${Math.round(val)} XP  ·  ${dateFmt}`;
                              const textW = text.length * 6.5 + 16;
                              const tipX = Math.max(4, Math.min(xpTooltip.x - textW / 2, plotW - textW - 4));
                              const tipY = xpTooltip.y - 32;
                              return (
                                <>
                                  <Line x1={xpTooltip.x} y1={xpTooltip.y} x2={xpTooltip.x} y2={chartHeight} stroke={Colors.zinc600} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
                                  <SvgRect x={tipX} y={tipY} width={textW} height={22} rx={6} fill={Colors.surfaceContainerHigh} stroke={Colors.zinc700} strokeWidth={0.5} />
                                  <SvgText x={tipX + textW / 2} y={tipY + 15} textAnchor="middle" fill={Colors.onSurface} fontSize={11} fontWeight="600">{text}</SvgText>
                                </>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </Svg>
                  </View>
                </View>
                <View style={[styles.chartXAxis, { marginLeft: yAxisW }]}>
                  {chartData.labels.map((l, i) => (
                    <Text key={i} style={styles.chartXLabel}>{l}</Text>
                  ))}
                </View>
              </View>
            </Pressable>
          );
        })()}

        {/* (Tracking chart moved to top of page) */}

        {/* Photo log */}
        {photoLogs.length > 0 && (
          <View style={styles.photoLogSection}>
            <Text style={styles.sectionLabel}>PHOTO LOG</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoLogRow}
            >
              {photoLogs.map((l) => (
                <Pressable
                  key={l.id}
                  style={styles.photoLogItem}
                  onPress={() => {
                    setViewerPhotoUrl(signedUrls[l.id] || l.proofPhotoUrl!);
                    setViewerDate(format(new Date(l.loggedDate + 'T12:00:00'), 'EEEE, MMM d, yyyy'));
                  }}
                >
                  <Image
                    source={{ uri: signedUrls[l.id] || l.proofPhotoUrl! }}
                    style={styles.photoLogThumb}
                    resizeMode="cover"
                  />
                  <Text style={styles.photoLogDate}>
                    {format(new Date(l.loggedDate + 'T12:00:00'), 'MMM d')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* History List */}
        {historyEntries.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionLabel}>HISTORY</Text>
            {historyEntries.map((entry) => {
              const log = habitLogs.find(l => l.id === entry.id);
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.historyRow,
                    !entry.completed && styles.historyRowMissed,
                  ]}
                >
                  <View style={styles.historyLeft}>
                    <View
                      style={[
                        styles.historyDot,
                        {
                          backgroundColor: entry.completed
                            ? Colors.secondary
                            : Colors.error,
                        },
                      ]}
                    />
                    <Text style={styles.historyDate}>{entry.date}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    {habit.trackingEnabled && entry.trackingValue != null && (
                      <Text style={styles.historyTracking}>
                        {entry.trackingValue}{habit.trackingUnit ? ` ${habit.trackingUnit}` : ''}
                      </Text>
                    )}
                    {log && habit.proofRequired !== 'none' && (
                      <ProofButton
                        proofRequired={habit.proofRequired}
                        proofVerified={log.proofVerified}
                        onPress={() => handleProofPress(log.id)}
                      />
                    )}
                    <Text
                      style={[
                        styles.historyXp,
                        { color: entry.completed ? Colors.zinc500 : Colors.error },
                      ]}
                    >
                      {entry.xp > 0 ? '+' : ''}{entry.xp} XP
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Edit button */}
        <Pressable
          style={styles.editButton}
          onPress={() => router.push(`/habit/${id}/edit`)}
        >
          <Ionicons name="pencil-outline" size={16} color={Colors.onPrimaryContainer} />
          <Text style={styles.editButtonText}>Edit Habit</Text>
        </Pressable>
      </ScrollView>

      {/* Proof Submission Modal */}
      {habit && selectedLog && user && (
        <ProofSubmissionModal
          visible={showProofModal}
          habit={habit}
          habitLog={selectedLog}
          userId={user.id}
          onClose={() => {
            setShowProofModal(false);
            setSelectedLogForProof(null);
          }}
          onProofSubmitted={handleProofSubmitted}
        />
      )}

      {/* Full timeline calendar */}
      <Modal
        visible={showFullCalendar}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFullCalendar(false)}
      >
        <View style={styles.calModal}>
          <View style={styles.calModalHeader}>
            <Text style={styles.calModalTitle}>{habit.name}</Text>
            <Pressable
              onPress={() => setShowFullCalendar(false)}
              accessibilityRole="button"
              accessibilityLabel="Close calendar"
              hitSlop={12}
            >
              <Ionicons name="close" size={24} color={Colors.zinc400} />
            </Pressable>
          </View>
          <View style={styles.calWeekRow}>
            {WEEKDAY_LABELS.map((w, i) => (
              <Text key={i} style={styles.calWeekLabel}>{w}</Text>
            ))}
          </View>
          <ScrollView
            contentContainerStyle={styles.calModalScroll}
            showsVerticalScrollIndicator={false}
          >
            {monthBlocks.map((m) => (
              <View key={m.key} style={styles.calMonthBlock}>
                <Text style={styles.calMonthLabel}>{m.label}</Text>
                <View style={styles.calMonthGrid}>
                  {m.cells.map((cell, idx) => {
                    if (!cell) {
                      return <View key={idx} style={styles.calFullCellEmpty} />;
                    }
                    const isToday = isSameDay(parseISO(cell.dateStr), new Date());
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.calFullCell,
                          cell.done && styles.calCellDone,
                          isToday && !cell.done && styles.calCellToday,
                          cell.isFuture && { opacity: 0.3 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.calFullCellText,
                            cell.done && styles.calCellTextDone,
                          ]}
                        >
                          {cell.day}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Photo viewer */}
      <Modal
        visible={!!viewerPhotoUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerPhotoUrl(null)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable style={styles.viewerClose} onPress={() => setViewerPhotoUrl(null)}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </Pressable>
          {viewerPhotoUrl && (
            <Image
              source={{ uri: viewerPhotoUrl }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.viewerDate}>{viewerDate}</Text>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Nav Header
  navHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.lg, backgroundColor: Colors.background,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  navTitle: { color: Colors.primaryContainer, fontSize: FontSizes.lg, fontFamily: Fonts.headlineBold },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  levelPill: {
    backgroundColor: Colors.surfaceContainerHigh, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs, borderRadius: BorderRadius.full,
  },
  levelText: { color: Colors.onSurface, fontSize: FontSizes.sm, fontFamily: Fonts.bodySemiBold },
  navAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.primaryContainer,
  },
  navAvatarText: { color: Colors.primary, fontFamily: Fonts.headlineBold, fontSize: 9 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },

  // Habit Header
  habitHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing['2xl'],
  },
  habitHeaderLeft: { flex: 1 },
  habitIcon: { fontSize: FontSizes['4xl'], marginBottom: Spacing.sm },
  habitName: { fontSize: 32, fontFamily: Fonts.headlineExtraBold, color: Colors.onSurface },
  habitHeaderRight: { alignItems: 'flex-end', gap: Spacing.sm },
  xpChip: {
    backgroundColor: 'rgba(235,178,255,0.1)', borderWidth: 1,
    borderColor: 'rgba(235,178,255,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  xpChipText: { color: Colors.tertiary, fontSize: FontSizes.sm, fontFamily: Fonts.bodyBold },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  streakFlame: { fontSize: FontSizes.xl },
  streakCount: { fontSize: FontSizes['3xl'], fontFamily: Fonts.headlineBold, color: Colors.primaryContainer },

  // Section card
  sectionCard: {
    backgroundColor: Colors.surfaceContainerLow, borderRadius: BorderRadius.md,
    padding: Spacing['2xl'], marginBottom: Spacing.lg,
  },
  sectionLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg,
  },
  sectionLabel: {
    color: Colors.zinc500, fontSize: FontSizes.xs, fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: Spacing.md,
  },
  sectionSubLabel: { color: Colors.zinc600, fontSize: FontSizes.xs, fontFamily: Fonts.body },

  // Heatmap
  heatmapWithLabels: { flexDirection: 'row', gap: 4 },
  heatmapDayLabels: { justifyContent: 'space-between', width: 12 },
  heatmapDayLabel: {
    fontFamily: Fonts.body, fontSize: 8, color: Colors.zinc600,
    textAlign: 'center', height: CELL_SIZE, lineHeight: CELL_SIZE,
  },
  heatmapContainer: { flexDirection: 'row', gap: CELL_GAP, flex: 1 },
  heatmapCol: { gap: CELL_GAP },
  heatmapCell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 1 },

  // Calendar — compact (last 30 days)
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CAL_GAP,
  },
  calCell: {
    width: CAL_CELL,
    height: CAL_CELL,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellDone: {
    backgroundColor: Colors.secondary,
  },
  calCellToday: {
    borderWidth: 1,
    borderColor: Colors.zinc600,
  },
  calCellText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.body,
    color: Colors.zinc600,
  },
  calCellTextDone: {
    color: Colors.background,
    fontFamily: Fonts.bodySemiBold,
  },

  // Calendar — full modal
  calModal: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  calModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  calModalTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.headlineExtraBold,
    color: Colors.onSurface,
    flex: 1,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  calWeekLabel: {
    flex: 1,
    textAlign: 'center',
    color: Colors.zinc600,
    fontSize: FontSizes.xs,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
  },
  calModalScroll: {
    paddingBottom: 80,
  },
  calMonthBlock: {
    marginBottom: Spacing['2xl'],
  },
  calMonthLabel: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.zinc500,
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  calMonthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CAL_FULL_GAP,
  },
  calFullCell: {
    width: CAL_FULL_CELL,
    height: CAL_FULL_CELL,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calFullCellEmpty: {
    width: CAL_FULL_CELL,
    height: CAL_FULL_CELL,
  },
  calFullCellText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.body,
    color: Colors.zinc600,
  },

  // Bento Grid
  bentoGrid: { marginBottom: Spacing.lg, gap: Spacing.sm },
  bentoRow: { flexDirection: 'row', gap: Spacing.sm },
  bentoCard: {
    flex: 1, backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.sm,
    padding: Spacing.lg, height: 128, justifyContent: 'space-between', overflow: 'hidden',
  },
  bentoCardWide: {
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.sm,
    padding: Spacing.lg, height: 128, justifyContent: 'space-between',
  },
  bentoLabel: {
    color: Colors.zinc500, fontSize: FontSizes.xs, fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  bentoValue: { fontSize: FontSizes['3xl'], fontFamily: Fonts.headlineExtraBold },
  bentoFireGhost: { position: 'absolute', right: 10, bottom: 10, fontSize: 48, opacity: 0.08 },
  bentoXpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bentoPenalty: { color: Colors.error, fontSize: FontSizes.xs, fontFamily: Fonts.bodySemiBold },

  // This Week
  weekRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', flex: 1 },
  weekDayCol: { alignItems: 'center', gap: Spacing.xs },
  weekDayLabel: { color: Colors.zinc500, fontSize: FontSizes.xs, fontFamily: Fonts.bodySemiBold },
  weekCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  weekDone: { backgroundColor: 'rgba(74,225,131,0.15)' },
  weekMissed: { backgroundColor: 'rgba(255,180,171,0.15)' },
  weekEmpty: { borderWidth: 1, borderColor: Colors.zinc700 },

  // Chart
  chartXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  chartXLabel: { color: Colors.zinc600, fontSize: FontSizes.xs, fontFamily: Fonts.body },
  yAxisLabel: { color: Colors.zinc600, fontSize: 10, fontFamily: Fonts.body, textAlign: 'right', paddingRight: 6 },

  // History
  historySection: { marginBottom: Spacing.lg },
  photoLogSection: { marginBottom: Spacing.xl },
  photoLogRow: { gap: Spacing.md, paddingVertical: Spacing.xs },
  photoLogItem: { width: 96 },
  photoLogThumb: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  photoLogDate: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.zinc500,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: Spacing.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  viewerImage: { width: '100%', height: '75%' },
  viewerDate: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 56 : 32,
    color: Colors.white,
    fontSize: FontSizes.md,
    fontFamily: Fonts.bodySemiBold,
  },
  historyRow: {
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginBottom: Spacing.sm,
  },
  historyRowMissed: { borderLeftWidth: 2, borderLeftColor: 'rgba(255,180,171,0.5)' },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  historyRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyDate: { color: Colors.onSurface, fontSize: FontSizes.md, fontFamily: Fonts.bodyBold },
  historyTracking: {
    fontSize: FontSizes.sm, fontFamily: Fonts.bodySemiBold, color: Colors.secondary,
    backgroundColor: 'rgba(74,225,131,0.1)', paddingHorizontal: Spacing.sm,
    paddingVertical: 2, borderRadius: BorderRadius.sm, overflow: 'hidden',
  },
  historyXp: { fontSize: FontSizes.sm, fontFamily: Fonts.bodySemiBold },

  // Edit button
  editButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg, marginBottom: Spacing['2xl'],
  },
  editButtonText: {
    color: Colors.onPrimaryContainer, fontFamily: Fonts.headlineBold, fontSize: FontSizes.md,
  },
});
