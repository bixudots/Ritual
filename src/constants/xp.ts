// XP System Constants

// User-selectable XP values per habit
export const XP_VALUES = [5, 10, 15, 20] as const;
export type XPValue = typeof XP_VALUES[number];

export const XP_LABELS: Record<XPValue, string> = {
  5: 'Easy',
  10: 'Medium',
  15: 'Hard',
  20: 'Beast',
};

export const XP_ICONS: Record<XPValue, string> = {
  5: 'filter_1',
  10: 'local_fire_department',
  15: 'filter_3',
  20: 'temp_preferences_custom',
};

// Level thresholds - total XP needed to reach each level
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  200,    // Level 3
  500,    // Level 4
  1000,   // Level 5
  1500,   // Level 6
  2000,   // Level 7
  3000,   // Level 8
  5000,   // Level 9
  7500,   // Level 10
  10000,  // Level 11
  15000,  // Level 12
  20000,  // Level 13
  30000,  // Level 14
  50000,  // Level 15
] as const;

// 7-day streak bonus XP
export const STREAK_BONUS_XP = 25;
export const STREAK_BONUS_INTERVAL = 7; // every 7 days

// XP awarded for creating a new habit (decreasing with count)
export const HABIT_CREATION_XP = [50, 40, 20, 10] as const;

/**
 * Get XP reward for creating the Nth habit (0-indexed count of existing habits)
 */
export function getHabitCreationXP(existingHabitCount: number): number {
  if (existingHabitCount >= HABIT_CREATION_XP.length) {
    return HABIT_CREATION_XP[HABIT_CREATION_XP.length - 1];
  }
  return HABIT_CREATION_XP[existingHabitCount];
}

/**
 * Calculate level from total XP
 */
export function getLevelFromXP(totalXP: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Get XP progress within current level
 */
export function getLevelProgress(totalXP: number): {
  level: number;
  currentXP: number;
  nextLevelXP: number;
  progress: number;
} {
  const level = getLevelFromXP(totalXP);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? currentThreshold + 10000;

  const currentXP = totalXP - currentThreshold;
  const nextLevelXP = nextThreshold - currentThreshold;
  const progress = Math.min(currentXP / nextLevelXP, 1);

  return { level, currentXP: totalXP, nextLevelXP: nextThreshold, progress };
}

/**
 * Calculate streak bonus for reaching a milestone
 */
export function getStreakBonus(streakDays: number): number {
  if (streakDays > 0 && streakDays % STREAK_BONUS_INTERVAL === 0) {
    return STREAK_BONUS_XP;
  }
  return 0;
}
