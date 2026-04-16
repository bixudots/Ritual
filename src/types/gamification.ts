export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  pushToken?: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface XPEvent {
  id: string;
  userId: string;
  eventType: 'earned' | 'penalty' | 'recovered' | 'streak_bonus' | 'badge_reward';
  xpAmount: number; // positive for gain, negative for loss
  referenceId?: string; // habit_id or badge_id
  description?: string;
  createdAt: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
}

export interface XPBreakdown {
  earned: number;
  penalties: number;
  recovered: number;
  streakBonus: number;
  net: number;
}
