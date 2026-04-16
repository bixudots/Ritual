import { XPValue } from '../constants/xp';

export type ScheduleType = 'specific_days' | 'every_day' | 'days_per_week';
export type ProofType = 'none' | 'photo' | 'location' | 'photo_or_location';

export interface HabitSchedule {
  type: ScheduleType;
  /** For `specific_days` — 0=Sun, 1=Mon, …, 6=Sat */
  days?: number[];
  /** For `days_per_week` — target number of completions per week */
  timesPerWeek?: number;
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  icon: string; // emoji
  color: string; // hex color
  xpValue: XPValue;
  schedule: HabitSchedule;
  proofRequired: ProofType;
  proofLocationLat?: number;
  proofLocationLng?: number;
  proofLocationRadius?: number; // meters
  currentStreak: number;
  longestStreak: number;
  sortOrder: number;
  isArchived: boolean;
  trackingEnabled: boolean;
  trackingUnit?: string;
  trackingGoal?: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  loggedDate: string; // YYYY-MM-DD
  completed: boolean;
  xpAwarded: number;
  xpPenalty: number;
  xpRecovered: number;
  proofPhotoUrl?: string;
  proofLocationLat?: number;
  proofLocationLng?: number;
  proofVerified: boolean;
  note?: string;
  trackingValue?: number;
  createdAt: string;
}

// For the Today screen
export interface TodayHabit extends Habit {
  todayLog?: HabitLog;
  isScheduledToday: boolean;
  missedYesterday: boolean;
  consecutiveMisses: number; // how many days missed in a row before today
}

export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const DAY_LABELS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Check if a habit is scheduled for a given day of week (0=Sun)
 */
export function isHabitScheduledForDay(habit: Habit, dayOfWeek: number): boolean {
  switch (habit.schedule.type) {
    case 'every_day':
      return true;
    case 'specific_days':
      return habit.schedule.days?.includes(dayOfWeek) ?? false;
    default:
      return true;
  }
}
