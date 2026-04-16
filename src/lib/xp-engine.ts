/**
 * XP Engine - Core gamification logic for The Ritual
 *
 * XP Rules:
 * - Complete a habit: +xpValue (5/10/15/20)
 * - Miss a habit: -xpValue
 * - Miss then complete next day: recover the penalty (+xpValue back)
 * - Miss 2 in a row: penalty becomes permanent (no recovery)
 * - Every 7-day streak: bonus +25 XP
 * - XP never goes below 0
 */

import { Habit, HabitLog } from '../types/habit';
import { XPEvent, XPBreakdown } from '../types/gamification';
import { getLevelFromXP, getStreakBonus, STREAK_BONUS_XP } from '../constants/xp';
import { format, subDays, parseISO, isEqual } from 'date-fns';

interface XPResult {
  xpAwarded: number;
  xpPenalty: number;
  xpRecovered: number;
  events: Omit<XPEvent, 'id' | 'createdAt'>[];
  newStreak: number;
  streakBonus: number;
}

/**
 * Calculate XP changes when a habit is completed
 */
export function calculateCompletionXP(
  habit: Habit,
  logDate: string,
  previousLogs: HabitLog[],
): XPResult {
  const xpValue = habit.xpValue;
  const events: Omit<XPEvent, 'id' | 'createdAt'>[] = [];
  let xpRecovered = 0;

  // 1. Base XP for completion
  events.push({
    userId: habit.userId,
    eventType: 'earned',
    xpAmount: xpValue,
    referenceId: habit.id,
    description: `Completed "${habit.name}"`,
  });

  // 2. Check if yesterday was missed (recovery logic)
  const yesterday = format(subDays(parseISO(logDate), 1), 'yyyy-MM-dd');
  const yesterdayLog = previousLogs.find(l => l.loggedDate === yesterday);
  const dayBeforeYesterday = format(subDays(parseISO(logDate), 2), 'yyyy-MM-dd');
  const dayBeforeLog = previousLogs.find(l => l.loggedDate === dayBeforeYesterday);

  if (yesterdayLog && !yesterdayLog.completed && yesterdayLog.xpPenalty > 0) {
    // Yesterday was missed — but did we miss 2 in a row?
    const wasDayBeforeMissed = dayBeforeLog && !dayBeforeLog.completed;

    if (!wasDayBeforeMissed) {
      // Only missed 1 day — recover the penalty!
      xpRecovered = yesterdayLog.xpPenalty;
      events.push({
        userId: habit.userId,
        eventType: 'recovered',
        xpAmount: xpRecovered,
        referenceId: habit.id,
        description: `Recovered penalty for "${habit.name}" — didn't miss 2 in a row`,
      });
    }
    // If 2 in a row were missed, penalty is permanent — no recovery
  }

  // 3. Streak calculation
  const newStreak = calculateStreak(habit, logDate, previousLogs);
  const streakBonus = getStreakBonus(newStreak);

  if (streakBonus > 0) {
    events.push({
      userId: habit.userId,
      eventType: 'streak_bonus',
      xpAmount: streakBonus,
      referenceId: habit.id,
      description: `${newStreak}-day streak bonus for "${habit.name}"!`,
    });
  }

  return {
    xpAwarded: xpValue,
    xpPenalty: 0,
    xpRecovered,
    events,
    newStreak,
    streakBonus,
  };
}

/**
 * Calculate XP penalty when a habit is missed
 */
export function calculateMissXP(
  habit: Habit,
  logDate: string,
): Omit<XPEvent, 'id' | 'createdAt'> {
  return {
    userId: habit.userId,
    eventType: 'penalty',
    xpAmount: -habit.xpValue,
    referenceId: habit.id,
    description: `Missed "${habit.name}"`,
  };
}

/**
 * Calculate consecutive streak for a habit
 */
export function calculateStreak(
  habit: Habit,
  completedDate: string,
  logs: HabitLog[],
): number {
  let streak = 1; // Today counts as 1
  let checkDate = subDays(parseISO(completedDate), 1);

  // Walk backwards through days
  for (let i = 0; i < 365; i++) {
    const dateStr = format(checkDate, 'yyyy-MM-dd');
    const log = logs.find(l => l.loggedDate === dateStr);

    // Was this day scheduled?
    const dayOfWeek = checkDate.getDay();
    const wasScheduled = isScheduledDay(habit, dayOfWeek);

    if (!wasScheduled) {
      // Skip non-scheduled days (don't break streak)
      checkDate = subDays(checkDate, 1);
      continue;
    }

    if (log && log.completed) {
      streak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break; // Streak broken
    }
  }

  return streak;
}

function isScheduledDay(habit: Habit, dayOfWeek: number): boolean {
  switch (habit.schedule.type) {
    case 'every_day':
      return true;
    case 'specific_days':
      return habit.schedule.days?.includes(dayOfWeek) ?? false;
    case 'days_per_week':
      return true; // Any day counts for "x per week"
    default:
      return true;
  }
}

/**
 * Calculate daily XP breakdown
 */
export function calculateDailyBreakdown(events: XPEvent[]): XPBreakdown {
  const earned = events
    .filter(e => e.eventType === 'earned')
    .reduce((sum, e) => sum + e.xpAmount, 0);

  const penalties = events
    .filter(e => e.eventType === 'penalty')
    .reduce((sum, e) => sum + Math.abs(e.xpAmount), 0);

  const recovered = events
    .filter(e => e.eventType === 'recovered')
    .reduce((sum, e) => sum + e.xpAmount, 0);

  const streakBonus = events
    .filter(e => e.eventType === 'streak_bonus')
    .reduce((sum, e) => sum + e.xpAmount, 0);

  return {
    earned: earned + streakBonus,
    penalties,
    recovered,
    streakBonus,
    net: earned + recovered + streakBonus - penalties,
  };
}

/**
 * Check if user should level up
 */
export function checkLevelUp(
  currentXP: number,
  previousXP: number,
): { leveledUp: boolean; newLevel: number; previousLevel: number } {
  const newLevel = getLevelFromXP(currentXP);
  const previousLevel = getLevelFromXP(previousXP);

  return {
    leveledUp: newLevel > previousLevel,
    newLevel,
    previousLevel,
  };
}

/**
 * Calculate overall streak (days where ALL scheduled habits were completed)
 */
export function calculateOverallStreak(
  habits: Habit[],
  logs: HabitLog[],
  fromDate: string,
): number {
  let streak = 0;
  let checkDate = parseISO(fromDate);

  for (let i = 0; i < 365; i++) {
    const dateStr = format(checkDate, 'yyyy-MM-dd');
    const dayOfWeek = checkDate.getDay();

    // Get habits scheduled for this day
    const scheduledHabits = habits.filter(h =>
      !h.isArchived && isScheduledDay(h, dayOfWeek)
    );

    if (scheduledHabits.length === 0) {
      checkDate = subDays(checkDate, 1);
      continue; // No habits scheduled, skip (don't break streak)
    }

    // Check if ALL scheduled habits were completed
    const allCompleted = scheduledHabits.every(habit => {
      const log = logs.find(
        l => l.habitId === habit.id && l.loggedDate === dateStr
      );
      return log?.completed === true;
    });

    if (allCompleted) {
      streak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Ensure XP never goes below 0
 */
export function clampXP(xp: number): number {
  return Math.max(0, xp);
}
