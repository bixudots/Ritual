import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Habit, HabitLog, TodayHabit, isHabitScheduledForDay } from '../types/habit';
import { format, subDays, parseISO } from 'date-fns';
import { getHabitCreationXP } from '../constants/xp';

/**
 * Was this habit already created on the given calendar day?
 * Used to prevent retroactively breaking past "perfect days" when the user
 * adds a new habit — a habit that didn't exist yet cannot have been missed.
 */
function wasHabitActiveOn(habit: Habit, dateStr: string): boolean {
  if (!habit.createdAt) return true;
  // Compare YYYY-MM-DD strings — habit's creation day counts as active.
  const createdDay = habit.createdAt.slice(0, 10);
  return createdDay <= dateStr;
}

// =============================================
// DB → App mapping helpers
// =============================================

function mapDbHabit(row: any): Habit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    xpValue: row.xp_value,
    schedule: {
      type: row.schedule_type,
      days: row.schedule_days ?? [],
      timesPerWeek: row.schedule_times_per_week ?? 0,
    },
    proofRequired: row.proof_required,
    proofLocationLat: row.proof_location_lat,
    proofLocationLng: row.proof_location_lng,
    proofLocationRadius: row.proof_location_radius,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    sortOrder: row.sort_order,
    isArchived: row.is_archived,
    trackingEnabled: row.tracking_enabled ?? false,
    trackingUnit: row.tracking_unit ?? undefined,
    trackingGoal: row.tracking_goal ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbLog(row: any): HabitLog {
  return {
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
  };
}

// =============================================
// STORE
// =============================================
interface HabitState {
  habits: Habit[];
  logs: HabitLog[];
  profileXP: number; // Single source of truth — mirrors profiles.xp from DB
  isLoading: boolean;

  // Data fetching
  fetchHabits: () => Promise<void>;
  fetchLogs: () => Promise<void>;

  // Computed
  getTodayHabits: () => TodayHabit[];
  getHabitsForDate: (dateStr: string) => TodayHabit[];
  getHabitById: (id: string) => Habit | undefined;
  getLogsForHabit: (habitId: string) => HabitLog[];
  getCompletedCount: (date: string) => number;
  getScheduledCount: (date: string) => number;
  getTotalXP: () => number;
  getOverallStreak: () => number;
  getHabitStreak: (habitId: string) => { count: number; unit: 'day' };

  // Actions
  toggleHabit: (habitId: string) => void;
  toggleHabitForDate: (habitId: string, dateStr: string) => void;
  completeHabitWithProof: (habitId: string, dateStr: string, proofPhotoUrl?: string, proofLocationLat?: number, proofLocationLng?: number) => Promise<void>;
  /** Re-read authoritative XP from profiles.xp. Call after any mutation. */
  fetchProfileXP: () => Promise<void>;
  addHabit: (habit: Omit<Habit, 'id' | 'userId' | 'currentStreak' | 'longestStreak' | 'sortOrder' | 'isArchived' | 'createdAt' | 'updatedAt'>) => Promise<{ creationXP: number; habit: Habit } | undefined>;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  archiveHabit: (id: string) => void;
  /** Set the tracking value on today's (or given date's) log. Creates the log if missing and marks completed. */
  setTrackingValue: (habitId: string, dateStr: string, value: number) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  logs: [],
  profileXP: 0,
  isLoading: false,

  // -------------------------------------------
  // Fetch from Supabase
  // -------------------------------------------
  fetchHabits: async () => {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      set({ habits: data.map(mapDbHabit) });
    }
  },

  fetchLogs: async () => {
    // Fetch last 60 days of logs (enough for streaks, heatmap, etc.)
    const since = format(subDays(new Date(), 60), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .gte('logged_date', since)
      .order('logged_date', { ascending: false });

    if (!error && data) {
      set({ logs: data.map(mapDbLog) });
    }
  },

  // -------------------------------------------
  // Computed
  // -------------------------------------------
  getTodayHabits: () => {
    const { habits, logs } = get();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const dayBefore = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const dayOfWeek = new Date().getDay();

    return habits
      .filter(h => !h.isArchived)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(habit => {
        const todayLog = logs.find(
          l => l.habitId === habit.id && l.loggedDate === todayStr
        );
        const yesterdayLog = logs.find(
          l => l.habitId === habit.id && l.loggedDate === yesterdayStr
        );
        const dayBeforeLog = logs.find(
          l => l.habitId === habit.id && l.loggedDate === dayBefore
        );

        const isScheduledToday = isHabitScheduledForDay(habit, dayOfWeek);

        const yesterdayDow = (dayOfWeek + 6) % 7;
        const wasScheduledYesterday =
          wasHabitActiveOn(habit, yesterdayStr) &&
          isHabitScheduledForDay(habit, yesterdayDow);
        const missedYesterday = wasScheduledYesterday &&
          (!yesterdayLog || !yesterdayLog.completed);

        let consecutiveMisses = 0;
        if (missedYesterday) {
          consecutiveMisses = 1;
          const dayBeforeDow = (dayOfWeek + 5) % 7;
          const wasScheduledDayBefore = isHabitScheduledForDay(habit, dayBeforeDow);
          if (wasScheduledDayBefore && dayBeforeLog && !dayBeforeLog.completed) {
            consecutiveMisses = 2;
          }
        }

        return {
          ...habit,
          todayLog,
          isScheduledToday,
          missedYesterday,
          consecutiveMisses,
        };
      });
  },

  getHabitsForDate: (dateStr: string) => {
    const { habits, logs } = get();
    const date = parseISO(dateStr);
    const dayOfWeek = date.getDay();
    const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');
    const dayBeforeStr = format(subDays(date, 2), 'yyyy-MM-dd');

    return habits
      .filter(h => !h.isArchived && wasHabitActiveOn(h, dateStr))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(habit => {
        const dateLog = logs.find(
          l => l.habitId === habit.id && l.loggedDate === dateStr
        );
        const yesterdayLog = logs.find(
          l => l.habitId === habit.id && l.loggedDate === yesterdayStr
        );
        const dayBeforeLog = logs.find(
          l => l.habitId === habit.id && l.loggedDate === dayBeforeStr
        );

        const isScheduledToday = isHabitScheduledForDay(habit, dayOfWeek);

        const yesterdayDow = (dayOfWeek + 6) % 7;
        const wasScheduledYesterday =
          wasHabitActiveOn(habit, yesterdayStr) &&
          isHabitScheduledForDay(habit, yesterdayDow);
        const missedYesterday = wasScheduledYesterday &&
          (!yesterdayLog || !yesterdayLog.completed);

        let consecutiveMisses = 0;
        if (missedYesterday) {
          consecutiveMisses = 1;
          const dayBeforeDow = (dayOfWeek + 5) % 7;
          const wasScheduledDayBefore = isHabitScheduledForDay(habit, dayBeforeDow);
          if (wasScheduledDayBefore && dayBeforeLog && !dayBeforeLog.completed) {
            consecutiveMisses = 2;
          }
        }

        return {
          ...habit,
          todayLog: dateLog,
          isScheduledToday,
          missedYesterday,
          consecutiveMisses,
        };
      });
  },

  getHabitById: (id) => get().habits.find(h => h.id === id),

  getLogsForHabit: (habitId) =>
    get().logs
      .filter(l => l.habitId === habitId)
      .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate)),

  getCompletedCount: (date) =>
    get().logs.filter(l => l.loggedDate === date && l.completed).length,

  getScheduledCount: (date) => {
    const d = parseISO(date);
    const dow = d.getDay();
    return get().habits.filter(
      h => !h.isArchived && wasHabitActiveOn(h, date) && isHabitScheduledForDay(h, dow)
    ).length;
  },

  getTotalXP: () => {
    // Authoritative: read from profileXP, which mirrors profiles.xp
    // (maintained by DB triggers on habit_logs and xp_events).
    return get().profileXP;
  },

  getOverallStreak: () => {
    const { habits, logs } = get();
    // Build a Set of "habitId:date" keys for completed logs — O(1) lookup
    const completedKeys = new Set<string>();
    for (const l of logs) {
      if (l.completed) completedKeys.add(`${l.habitId}:${l.loggedDate}`);
    }

    let streak = 0;
    for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
      const date = subDays(new Date(), daysAgo);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dow = date.getDay();

      const scheduledHabits = habits.filter(
        h =>
          !h.isArchived &&
          wasHabitActiveOn(h, dateStr) &&
          isHabitScheduledForDay(h, dow)
      );

      if (scheduledHabits.length === 0) continue;

      const allCompleted = scheduledHabits.every(
        h => completedKeys.has(`${h.id}:${dateStr}`)
      );

      if (allCompleted) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  },

  getHabitStreak: (habitId: string) => {
    const { habits, logs } = get();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return { count: 0, unit: 'day' as const };

    // Build a Set of completed dates for O(1) lookups instead of .find()
    const completedDates = new Set<string>();
    const logDates = new Set<string>();
    for (const l of logs) {
      if (l.habitId === habitId) {
        logDates.add(l.loggedDate);
        if (l.completed) completedDates.add(l.loggedDate);
      }
    }

    let streak = 0;
    for (let daysAgo = 0; daysAgo < 730; daysAgo++) {
      const date = subDays(new Date(), daysAgo);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dow = date.getDay();
      if (!isHabitScheduledForDay(habit, dow)) continue;
      if (completedDates.has(dateStr)) {
        streak++;
      } else if (daysAgo === 0) {
        continue;
      } else if (!wasHabitActiveOn(habit, dateStr)) {
        break;
      } else {
        break;
      }
    }
    return { count: streak, unit: 'day' as const };
  },

  // -------------------------------------------
  // Actions — optimistic local + sync to Supabase
  // -------------------------------------------
  toggleHabit: (habitId: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    set(state => {
      const existingLog = state.logs.find(
        l => l.habitId === habitId && l.loggedDate === todayStr
      );
      const habit = state.habits.find(h => h.id === habitId);
      if (!habit) return state;

      if (existingLog) {
        const newCompleted = !existingLog.completed;
        const newXp = newCompleted ? habit.xpValue : 0;

        // Optimistic update
        const newLogs = state.logs.map(l =>
          l.id === existingLog.id
            ? { ...l, completed: newCompleted, xpAwarded: newXp }
            : l
        );

        // Optimistic local XP bump
        const xpDelta = (newCompleted ? habit.xpValue : 0) - existingLog.xpAwarded;

        // Sync to Supabase, then reconcile with authoritative profiles.xp
        supabase
          .from('habit_logs')
          .update({ completed: newCompleted, xp_awarded: newXp })
          .eq('id', existingLog.id)
          .then(() => {
            get().fetchProfileXP();
          });

        return {
          logs: newLogs,
          profileXP: Math.max(0, state.profileXP + xpDelta),
        };
      } else {
        // Create new log
        const tempId = `temp-${Date.now()}`;
        const newLog: HabitLog = {
          id: tempId,
          habitId,
          userId: '', // filled by RLS
          loggedDate: todayStr,
          completed: true,
          xpAwarded: habit.xpValue,
          xpPenalty: 0,
          xpRecovered: 0,
          proofVerified: false,
          createdAt: new Date().toISOString(),
        };

        // Optimistic update
        const newLogs = [...state.logs, newLog];

        // Sync to Supabase — get actual user_id from auth
        supabase.auth.getUser().then(({ data }) => {
          const userId = data.user?.id;
          if (!userId) return;

          supabase
            .from('habit_logs')
            .insert({
              habit_id: habitId,
              user_id: userId,
              logged_date: todayStr,
              completed: true,
              xp_awarded: habit.xpValue,
              xp_penalty: 0,
              xp_recovered: 0,
            })
            .select()
            .single()
            .then(({ data: inserted }) => {
              if (inserted) {
                // Replace temp ID with real ID
                set(s => ({
                  logs: s.logs.map(l =>
                    l.id === tempId ? mapDbLog(inserted) : l
                  ),
                }));
              }
              // Reconcile with DB-authoritative profiles.xp
              get().fetchProfileXP();
            });
        });

        return {
          logs: newLogs,
          profileXP: state.profileXP + habit.xpValue,
        };
      }
    });
  },

  toggleHabitForDate: (habitId: string, dateStr: string) => {
    set(state => {
      const existingLog = state.logs.find(
        l => l.habitId === habitId && l.loggedDate === dateStr
      );
      const habit = state.habits.find(h => h.id === habitId);
      if (!habit) return state;

      if (existingLog) {
        const newCompleted = !existingLog.completed;
        const newXp = newCompleted ? habit.xpValue : 0;

        const newLogs = state.logs.map(l =>
          l.id === existingLog.id
            ? { ...l, completed: newCompleted, xpAwarded: newXp }
            : l
        );

        const xpDelta = (newCompleted ? habit.xpValue : 0) - existingLog.xpAwarded;

        supabase
          .from('habit_logs')
          .update({ completed: newCompleted, xp_awarded: newXp })
          .eq('id', existingLog.id)
          .then(() => {
            get().fetchProfileXP();
          });

        return {
          logs: newLogs,
          profileXP: Math.max(0, state.profileXP + xpDelta),
        };
      } else {
        const tempId = `temp-${Date.now()}`;
        const newLog: HabitLog = {
          id: tempId,
          habitId,
          userId: '',
          loggedDate: dateStr,
          completed: true,
          xpAwarded: habit.xpValue,
          xpPenalty: 0,
          xpRecovered: 0,
          proofVerified: false,
          createdAt: new Date().toISOString(),
        };

        const newLogs = [...state.logs, newLog];

        supabase.auth.getUser().then(({ data }) => {
          const userId = data.user?.id;
          if (!userId) return;

          supabase
            .from('habit_logs')
            .insert({
              habit_id: habitId,
              user_id: userId,
              logged_date: dateStr,
              completed: true,
              xp_awarded: habit.xpValue,
              xp_penalty: 0,
              xp_recovered: 0,
            })
            .select()
            .single()
            .then(({ data: inserted }) => {
              if (inserted) {
                set(s => ({
                  logs: s.logs.map(l =>
                    l.id === tempId ? mapDbLog(inserted) : l
                  ),
                }));
              }
              get().fetchProfileXP();
            });
        });

        return {
          logs: newLogs,
          profileXP: state.profileXP + habit.xpValue,
        };
      }
    });
  },

  completeHabitWithProof: async (habitId: string, dateStr: string, proofPhotoUrl?: string, proofLocationLat?: number, proofLocationLng?: number) => {
    const habit = get().habits.find(h => h.id === habitId);
    if (!habit) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if log already exists for this date
    const existingLog = get().logs.find(
      l => l.habitId === habitId && l.loggedDate === dateStr
    );

    if (existingLog) {
      // Update existing log with proof + mark completed
      const updatedLogs = get().logs.map(l =>
        l.id === existingLog.id
          ? {
              ...l,
              completed: true,
              xpAwarded: habit.xpValue,
              proofPhotoUrl: proofPhotoUrl ?? l.proofPhotoUrl,
              proofLocationLat: proofLocationLat ?? l.proofLocationLat,
              proofLocationLng: proofLocationLng ?? l.proofLocationLng,
              proofVerified: true,
            }
          : l
      );
      set({ logs: updatedLogs });

      await supabase
        .from('habit_logs')
        .update({
          completed: true,
          xp_awarded: habit.xpValue,
          proof_photo_url: proofPhotoUrl ?? existingLog.proofPhotoUrl,
          proof_location_lat: proofLocationLat ?? existingLog.proofLocationLat,
          proof_location_lng: proofLocationLng ?? existingLog.proofLocationLng,
          proof_verified: true,
        })
        .eq('id', existingLog.id);
    } else {
      // Create new log with proof attached
      const tempId = `temp-${Date.now()}`;
      const newLog: HabitLog = {
        id: tempId,
        habitId,
        userId: user.id,
        loggedDate: dateStr,
        completed: true,
        xpAwarded: habit.xpValue,
        xpPenalty: 0,
        xpRecovered: 0,
        proofPhotoUrl,
        proofLocationLat,
        proofLocationLng,
        proofVerified: true,
        createdAt: new Date().toISOString(),
      };

      set(state => ({ logs: [...state.logs, newLog] }));

      const { data: inserted } = await supabase
        .from('habit_logs')
        .insert({
          habit_id: habitId,
          user_id: user.id,
          logged_date: dateStr,
          completed: true,
          xp_awarded: habit.xpValue,
          xp_penalty: 0,
          xp_recovered: 0,
          proof_photo_url: proofPhotoUrl,
          proof_location_lat: proofLocationLat,
          proof_location_lng: proofLocationLng,
          proof_verified: true,
        })
        .select()
        .single();

      if (inserted) {
        set(s => ({
          logs: s.logs.map(l => l.id === tempId ? mapDbLog(inserted) : l),
        }));
      }
    }

    // Reconcile with authoritative profiles.xp (updated by DB trigger)
    await get().fetchProfileXP();
  },

  fetchProfileXP: async () => {
    // Read authoritative XP from profiles.xp — maintained by DB triggers.
    // No orphan cleanup here: trigger `habits_cleanup_xp_events` handles it
    // at DELETE time, and `trg_recompute_xp` keeps profiles.xp in sync.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[fetchProfileXP] Fetch error:', error.message);
      return;
    }
    if (data) set({ profileXP: data.xp ?? 0 });
  },

  addHabit: async (habitData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[addHabit] No authenticated user');
      return;
    }

    const habitCount = get().habits.length;
    const creationXP = getHabitCreationXP(habitCount);

    const insertData: Record<string, any> = {
      user_id: user.id,
      name: habitData.name,
      icon: habitData.icon,
      color: habitData.color,
      xp_value: habitData.xpValue,
      schedule_type: habitData.schedule.type,
      schedule_days: habitData.schedule.days ?? [],
      schedule_times_per_week: habitData.schedule.timesPerWeek ?? 0,
      proof_required: habitData.proofRequired,
      sort_order: habitCount,
    };

    // Include location data if provided
    if (habitData.proofLocationLat !== undefined) insertData.proof_location_lat = habitData.proofLocationLat;
    if (habitData.proofLocationLng !== undefined) insertData.proof_location_lng = habitData.proofLocationLng;
    if (habitData.proofLocationRadius !== undefined) insertData.proof_location_radius = habitData.proofLocationRadius;

    // Tracking fields
    insertData.tracking_enabled = habitData.trackingEnabled ?? false;
    if (habitData.trackingUnit !== undefined) insertData.tracking_unit = habitData.trackingUnit;
    if (habitData.trackingGoal !== undefined) insertData.tracking_goal = habitData.trackingGoal;

    const { data, error } = await supabase
      .from('habits')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[addHabit] Supabase error:', error.message);
      return;
    }

    if (data) {
      const newHabit = mapDbHabit(data);
      // Optimistic: add the habit. XP bump arrives from fetchProfileXP() below
      // after the DB trigger runs on xp_events insert.
      set(state => ({ habits: [...state.habits, newHabit] }));

      // Record creation XP as an xp_event — trigger will update profiles.xp
      await supabase.from('xp_events').insert({
        user_id: user.id,
        event_type: 'earned',
        xp_amount: creationXP,
        reference_id: data.id,
        description: `Created habit: ${habitData.name}`,
      });

      // Re-read authoritative XP from profiles.xp
      await get().fetchProfileXP();

      return { creationXP, habit: newHabit };
    }
  },

  updateHabit: async (id, updates) => {
    // Optimistic
    set(state => ({
      habits: state.habits.map(h =>
        h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h
      ),
    }));

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.xpValue !== undefined) dbUpdates.xp_value = updates.xpValue;
    if (updates.schedule !== undefined) {
      dbUpdates.schedule_type = updates.schedule.type;
      dbUpdates.schedule_days = updates.schedule.days ?? [];
      dbUpdates.schedule_times_per_week = updates.schedule.timesPerWeek ?? 0;
    }
    if (updates.proofRequired !== undefined) dbUpdates.proof_required = updates.proofRequired;
    if (updates.proofLocationLat !== undefined) dbUpdates.proof_location_lat = updates.proofLocationLat;
    if (updates.proofLocationLng !== undefined) dbUpdates.proof_location_lng = updates.proofLocationLng;
    if (updates.proofLocationRadius !== undefined) dbUpdates.proof_location_radius = updates.proofLocationRadius;
    if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    if (updates.trackingEnabled !== undefined) dbUpdates.tracking_enabled = updates.trackingEnabled;
    if (updates.trackingUnit !== undefined) dbUpdates.tracking_unit = updates.trackingUnit;
    if (updates.trackingGoal !== undefined) dbUpdates.tracking_goal = updates.trackingGoal;

    await supabase.from('habits').update(dbUpdates).eq('id', id);
  },

  deleteHabit: async (id) => {
    // Optimistic: drop habit + its logs locally.
    set(state => ({
      habits: state.habits.filter(h => h.id !== id),
      logs: state.logs.filter(l => l.habitId !== id),
    }));

    // DB side: the BEFORE DELETE trigger `habits_cleanup_xp_events` deletes
    // xp_events referencing this habit and recomputes profiles.xp.
    // habit_logs cascade via FK. One DELETE is all we need.
    const { error } = await supabase.from('habits').delete().eq('id', id);
    if (error) console.error('[deleteHabit] Delete error:', error.message);

    // Re-read authoritative XP
    await get().fetchProfileXP();
  },

  setTrackingValue: async (habitId, dateStr, value) => {
    const habit = get().habits.find(h => h.id === habitId);
    if (!habit) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existingLog = get().logs.find(
      l => l.habitId === habitId && l.loggedDate === dateStr
    );

    if (existingLog) {
      // Optimistic update — mark completed + store tracking value
      set(state => ({
        logs: state.logs.map(l =>
          l.id === existingLog.id
            ? { ...l, completed: true, xpAwarded: habit.xpValue, trackingValue: value }
            : l
        ),
      }));

      await supabase
        .from('habit_logs')
        .update({
          completed: true,
          xp_awarded: habit.xpValue,
          tracking_value: value,
        })
        .eq('id', existingLog.id);
    } else {
      const tempId = `temp-${Date.now()}`;
      const newLog: HabitLog = {
        id: tempId,
        habitId,
        userId: user.id,
        loggedDate: dateStr,
        completed: true,
        xpAwarded: habit.xpValue,
        xpPenalty: 0,
        xpRecovered: 0,
        proofVerified: false,
        trackingValue: value,
        createdAt: new Date().toISOString(),
      };

      set(state => ({ logs: [...state.logs, newLog] }));

      const { data: inserted } = await supabase
        .from('habit_logs')
        .insert({
          habit_id: habitId,
          user_id: user.id,
          logged_date: dateStr,
          completed: true,
          xp_awarded: habit.xpValue,
          xp_penalty: 0,
          xp_recovered: 0,
          tracking_value: value,
        })
        .select()
        .single();

      if (inserted) {
        set(s => ({
          logs: s.logs.map(l => l.id === tempId ? mapDbLog(inserted) : l),
        }));
      }
    }

    await get().fetchProfileXP();
  },

  archiveHabit: async (id) => {
    // Soft delete — hides habit but keeps all earned XP
    set(state => ({
      habits: state.habits.map(h =>
        h.id === id ? { ...h, isArchived: true } : h
      ),
    }));

    await supabase.from('habits').update({ is_archived: true }).eq('id', id);
  },
}));
