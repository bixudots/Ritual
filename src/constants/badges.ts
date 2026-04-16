export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // Material Symbol name
  category: 'streak' | 'consistency' | 'proof' | 'social' | 'milestone';
  xpReward: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Streak badges
  { id: 'streak_3', name: 'Getting Started', description: '3-day streak', icon: 'local_fire_department', category: 'streak', xpReward: 25 },
  { id: 'streak_7', name: 'One Week Strong', description: '7-day streak', icon: 'local_fire_department', category: 'streak', xpReward: 50 },
  { id: 'streak_14', name: 'Fortnight Focus', description: '14-day streak', icon: 'local_fire_department', category: 'streak', xpReward: 100 },
  { id: 'streak_30', name: 'Monthly Master', description: '30-day streak', icon: 'workspace_premium', category: 'streak', xpReward: 200 },
  { id: 'streak_100', name: 'Centurion', description: '100-day streak', icon: 'military_tech', category: 'streak', xpReward: 500 },
  { id: 'streak_365', name: 'Year of Ritual', description: '365-day streak', icon: 'diamond', category: 'streak', xpReward: 2000 },

  // Consistency
  { id: 'starter', name: 'Starter', description: 'Set up your first habit', icon: 'rocket_launch', category: 'consistency', xpReward: 25 },
  { id: 'first_habit', name: 'First Step', description: 'Complete your first habit', icon: 'check_circle', category: 'consistency', xpReward: 10 },
  { id: 'five_habits', name: 'Habit Builder', description: 'Create 5 habits', icon: 'construction', category: 'consistency', xpReward: 30 },
  { id: 'perfect_week', name: 'Perfect Week', description: '100% completion for 7 days', icon: 'star', category: 'consistency', xpReward: 100 },
  { id: 'perfect_month', name: 'Perfect Month', description: '100% completion for 30 days', icon: 'auto_awesome', category: 'consistency', xpReward: 500 },

  // Proof
  { id: 'photogenic', name: 'Photogenic', description: 'Create a habit with photo proof', icon: 'photo_camera', category: 'proof', xpReward: 50 },
  { id: 'live', name: 'LIVE', description: 'Create a habit with location proof', icon: 'location_on', category: 'proof', xpReward: 50 },
  { id: 'first_photo', name: 'Pic or It Didn\'t Happen', description: 'Submit first photo proof', icon: 'photo_camera', category: 'proof', xpReward: 15 },
  { id: 'first_checkin', name: 'On Location', description: 'First location check-in', icon: 'location_on', category: 'proof', xpReward: 15 },

  // Milestones
  { id: 'total_100', name: 'Century', description: '100 total completions', icon: 'emoji_events', category: 'milestone', xpReward: 100 },
  { id: 'total_500', name: 'Half Grand', description: '500 total completions', icon: 'emoji_events', category: 'milestone', xpReward: 300 },
  { id: 'total_1000', name: 'Grand Master', description: '1000 total completions', icon: 'emoji_events', category: 'milestone', xpReward: 1000 },
  { id: 'level_5', name: 'Apprentice', description: 'Reach level 5', icon: 'bolt', category: 'milestone', xpReward: 50 },
  { id: 'level_10', name: 'Adept', description: 'Reach level 10', icon: 'bolt', category: 'milestone', xpReward: 100 },
  { id: 'xp_1000', name: 'XP Hunter', description: 'Earn 1000 total XP', icon: 'paid', category: 'milestone', xpReward: 50 },
];

export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.id === id);
}

export function getBadgesByCategory(category: BadgeDefinition['category']): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter(b => b.category === category);
}
