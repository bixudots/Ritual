import type { XPValue } from './xp';
import type { HabitSchedule, ProofType } from '../types/habit';

/**
 * Preset habit recommended during onboarding. Users can pick any, edit
 * them before saving, or skip.
 */
export interface HabitPreset {
  name: string;
  icon: string; // emoji
  xpValue: XPValue;
  schedule: HabitSchedule;
  proofRequired: ProofType;
  trackingEnabled?: boolean;
  trackingUnit?: string;
  trackingGoal?: number;
}

/**
 * A life area the user might want to improve. Each goal exposes a
 * curated set of preset habits tuned to that intention.
 */
export interface GoalCategory {
  id: string;
  title: string;
  tagline: string;
  emoji: string;
  color: string;
  presets: HabitPreset[];
}

const EVERY_DAY: HabitSchedule = { type: 'every_day' };
const WEEKDAYS: HabitSchedule = { type: 'specific_days', days: [1, 2, 3, 4, 5] };
const THREE_X_WEEK: HabitSchedule = { type: 'specific_days', days: [1, 3, 5] };
const WEEKENDS: HabitSchedule = { type: 'specific_days', days: [0, 6] };

export const GOAL_CATEGORIES: GoalCategory[] = [
  {
    id: 'fitness',
    title: 'Get fit',
    tagline: 'Move your body, feel stronger',
    emoji: '💪',
    color: '#FB923C',
    presets: [
      { name: 'Workout', icon: '🏋️', xpValue: 15, schedule: THREE_X_WEEK, proofRequired: 'none' },
      { name: 'Morning run', icon: '🏃', xpValue: 15, schedule: WEEKDAYS, proofRequired: 'none' },
      { name: 'Stretch', icon: '🧘', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: '10k steps', icon: '👟', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Yoga', icon: '🧘‍♀️', xpValue: 10, schedule: THREE_X_WEEK, proofRequired: 'none' },
    ],
  },
  {
    id: 'mind',
    title: 'Calm the mind',
    tagline: 'Less noise, more clarity',
    emoji: '🧘',
    color: '#A78BFA',
    presets: [
      { name: 'Meditate', icon: '🧘', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Journal', icon: '📓', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Breathwork', icon: '🌬️', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Gratitude list', icon: '🙏', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Digital detox hour', icon: '📵', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
    ],
  },
  {
    id: 'learn',
    title: 'Learn & grow',
    tagline: 'Get sharper every day',
    emoji: '📚',
    color: '#60A5FA',
    presets: [
      { name: 'Read 20 pages', icon: '📖', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Study / course', icon: '🎓', xpValue: 15, schedule: WEEKDAYS, proofRequired: 'none' },
      { name: 'Duolingo', icon: '🗣️', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Practice instrument', icon: '🎸', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Write notes', icon: '✍️', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
    ],
  },
  {
    id: 'health',
    title: 'Eat & sleep better',
    tagline: 'Fuel your body right',
    emoji: '🥗',
    color: '#34D399',
    presets: [
      { name: 'Drink 2L water', icon: '💧', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Eat veggies', icon: '🥦', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'No junk food', icon: '🚫', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Sleep by 11pm', icon: '🌙', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Morning sunlight', icon: '☀️', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'No phone in bed', icon: '📴', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
    ],
  },
  {
    id: 'work',
    title: 'Do deep work',
    tagline: 'Ship the things that matter',
    emoji: '💻',
    color: '#F472B6',
    presets: [
      { name: 'Deep work block', icon: '🎯', xpValue: 15, schedule: WEEKDAYS, proofRequired: 'none' },
      { name: 'Inbox to zero', icon: '📧', xpValue: 5, schedule: WEEKDAYS, proofRequired: 'none' },
      { name: 'Plan tomorrow', icon: '🗓️', xpValue: 5, schedule: WEEKDAYS, proofRequired: 'none' },
      { name: 'No social media morning', icon: '🚫', xpValue: 10, schedule: WEEKDAYS, proofRequired: 'none' },
      { name: 'Side project', icon: '🚀', xpValue: 15, schedule: EVERY_DAY, proofRequired: 'none' },
    ],
  },
  {
    id: 'money',
    title: 'Build wealth',
    tagline: 'Small steps, big compounding',
    emoji: '💰',
    color: '#FBBF24',
    presets: [
      { name: 'Track expenses', icon: '📊', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'No impulse spend', icon: '🛑', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Read finance news', icon: '📰', xpValue: 5, schedule: WEEKDAYS, proofRequired: 'none' },
      { name: 'Review portfolio', icon: '📈', xpValue: 5, schedule: WEEKENDS, proofRequired: 'none' },
    ],
  },
  {
    id: 'relationships',
    title: 'Nurture people',
    tagline: 'Show up for the ones you love',
    emoji: '❤️',
    color: '#F87171',
    presets: [
      { name: 'Text a friend', icon: '💬', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Call family', icon: '📞', xpValue: 10, schedule: WEEKENDS, proofRequired: 'none' },
      { name: 'Compliment someone', icon: '💝', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Date night', icon: '🌹', xpValue: 15, schedule: { type: 'specific_days', days: [5] }, proofRequired: 'none' },
    ],
  },
  {
    id: 'creative',
    title: 'Create every day',
    tagline: 'Make something, anything',
    emoji: '🎨',
    color: '#C084FC',
    presets: [
      { name: 'Draw / sketch', icon: '✏️', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Write 500 words', icon: '📝', xpValue: 15, schedule: EVERY_DAY, proofRequired: 'none' },
      { name: 'Photo a day', icon: '📷', xpValue: 5, schedule: EVERY_DAY, proofRequired: 'photo' },
      { name: 'Make music', icon: '🎵', xpValue: 10, schedule: EVERY_DAY, proofRequired: 'none' },
    ],
  },
];

export function getGoalById(id: string): GoalCategory | undefined {
  return GOAL_CATEGORIES.find((g) => g.id === id);
}
