/**
 * Badge Engine - Check and award badges based on user achievements
 */

import { BADGE_DEFINITIONS, BadgeDefinition } from '../constants/badges';

interface BadgeContext {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  totalXP: number;
  level: number;
  habitCount: number;
  hasPhotoProof: boolean;
  hasLocationProof: boolean;
  earnedBadgeIds: string[];
}

export interface BadgeAward {
  badge: BadgeDefinition;
  isNew: boolean;
}

/**
 * Check all badges and return newly earned ones
 */
export function checkBadges(context: BadgeContext): BadgeAward[] {
  const awards: BadgeAward[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    const alreadyEarned = context.earnedBadgeIds.includes(badge.id);
    const earned = isBadgeEarned(badge, context);

    if (earned) {
      awards.push({
        badge,
        isNew: !alreadyEarned,
      });
    }
  }

  return awards;
}

/**
 * Get only newly earned badges (not previously earned)
 */
export function getNewBadges(context: BadgeContext): BadgeDefinition[] {
  return checkBadges(context)
    .filter(a => a.isNew)
    .map(a => a.badge);
}

function isBadgeEarned(badge: BadgeDefinition, ctx: BadgeContext): boolean {
  switch (badge.id) {
    // Streak badges (use longest streak OR current)
    case 'streak_3':
      return Math.max(ctx.currentStreak, ctx.longestStreak) >= 3;
    case 'streak_7':
      return Math.max(ctx.currentStreak, ctx.longestStreak) >= 7;
    case 'streak_14':
      return Math.max(ctx.currentStreak, ctx.longestStreak) >= 14;
    case 'streak_30':
      return Math.max(ctx.currentStreak, ctx.longestStreak) >= 30;
    case 'streak_100':
      return Math.max(ctx.currentStreak, ctx.longestStreak) >= 100;
    case 'streak_365':
      return Math.max(ctx.currentStreak, ctx.longestStreak) >= 365;

    // Consistency
    case 'first_habit':
      return ctx.totalCompletions >= 1;
    case 'five_habits':
      return ctx.habitCount >= 5;
    case 'perfect_week':
      return ctx.currentStreak >= 7; // simplified: 7-day overall streak
    case 'perfect_month':
      return ctx.currentStreak >= 30;

    // Proof
    case 'first_photo':
      return ctx.hasPhotoProof;
    case 'first_checkin':
      return ctx.hasLocationProof;

    // Milestones
    case 'total_100':
      return ctx.totalCompletions >= 100;
    case 'total_500':
      return ctx.totalCompletions >= 500;
    case 'total_1000':
      return ctx.totalCompletions >= 1000;
    case 'level_5':
      return ctx.level >= 5;
    case 'level_10':
      return ctx.level >= 10;
    case 'xp_1000':
      return ctx.totalXP >= 1000;

    default:
      return false;
  }
}
