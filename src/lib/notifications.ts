import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Setup ───────────────────────────────────────────────────────────────────

/** Call once at app startup to configure notification behaviour. */
export async function initNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('habit-reminders', {
      name: 'Habit Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('capsules', {
      name: 'Time Capsules',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('xp-milestones', {
      name: 'XP Milestones',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

/** Ask for notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ─── Habit Reminders ─────────────────────────────────────────────────────────

/**
 * Schedule (or reschedule) a daily reminder for a habit.
 * `reminderTime` is "HH:mm" (24h).  Pass `null` to cancel.
 */
export async function scheduleHabitReminder(
  habitId: string,
  habitName: string,
  habitIcon: string,
  reminderTime: string | null,
  scheduledDays?: number[], // 0=Sun..6=Sat; undefined = every day
) {
  // Always cancel existing notifications for this habit first
  await cancelHabitReminder(habitId);

  if (!reminderTime) return;

  const [hours, minutes] = reminderTime.split(':').map(Number);

  // If specific days, schedule one per day; otherwise a single daily trigger
  const daysToSchedule = scheduledDays && scheduledDays.length > 0 && scheduledDays.length < 7
    ? scheduledDays
    : [undefined]; // undefined = every day

  for (const day of daysToSchedule) {
    if (day !== undefined) {
      // Per-day weekly trigger
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${habitIcon} Time for ${habitName}`,
          body: 'Don\'t break the streak — tap to complete!',
          data: { type: 'habit-reminder', habitId },
          ...(Platform.OS === 'android' ? { channelId: 'habit-reminders' } : {}),
        },
        trigger: {
          type: SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // our 0=Sun → expo 1=Sun
          hour: hours,
          minute: minutes,
        },
        identifier: `habit-${habitId}-day${day}`,
      });
    } else {
      // Daily trigger
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${habitIcon} Time for ${habitName}`,
          body: 'Don\'t break the streak — tap to complete!',
          data: { type: 'habit-reminder', habitId },
          ...(Platform.OS === 'android' ? { channelId: 'habit-reminders' } : {}),
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
        identifier: `habit-${habitId}`,
      });
    }
  }
}

/** Cancel all scheduled notifications for a habit. */
export async function cancelHabitReminder(habitId: string) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (n.identifier.startsWith(`habit-${habitId}`)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// ─── Capsule Notifications ───────────────────────────────────────────────────

/**
 * Schedule a notification for when a time capsule unlocks.
 * `deliverAt` is an ISO timestamp or date string.
 */
export async function scheduleCapsuleNotification(
  capsuleId: string,
  title: string,
  deliverAt: Date,
) {
  // Cancel any existing
  await cancelCapsuleNotification(capsuleId);

  const now = new Date();
  if (deliverAt.getTime() <= now.getTime()) return; // already past

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔮 A Time Capsule has arrived!',
      body: `"${title}" is ready to open`,
      data: { type: 'capsule-delivery', capsuleId },
      ...(Platform.OS === 'android' ? { channelId: 'capsules' } : {}),
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: deliverAt,
    },
    identifier: `capsule-${capsuleId}`,
  });
}

export async function cancelCapsuleNotification(capsuleId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(`capsule-${capsuleId}`);
  } catch {
    // May not exist
  }
}

// ─── XP Level-Up Proximity ──────────────────────────────────────────────────

const XP_NOTIFY_KEY = 'xp_level_notify_last';

/**
 * Check if the user is close to levelling up, and fire a notification
 * at most once per week.
 */
export async function checkXPLevelNotification(
  currentXP: number,
  nextLevelXP: number,
  nextLevel: number,
) {
  const remaining = nextLevelXP - currentXP;
  if (remaining <= 0) return; // already there

  // Only fire when within 15% of the next level
  const threshold = (nextLevelXP) * 0.15;
  if (remaining > threshold) return;

  // Max once per week
  const lastStr = await AsyncStorage.getItem(XP_NOTIFY_KEY);
  if (lastStr) {
    const last = new Date(lastStr);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (last > weekAgo) return; // fired within last week
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚡ Level Up is close!',
      body: `You're only ${remaining} XP away from Level ${nextLevel}. Keep going!`,
      data: { type: 'xp-milestone' },
      ...(Platform.OS === 'android' ? { channelId: 'xp-milestones' } : {}),
    },
    trigger: null, // immediate
  });

  await AsyncStorage.setItem(XP_NOTIFY_KEY, new Date().toISOString());
}

// ─── Reschedule All ──────────────────────────────────────────────────────────

/**
 * Reschedule all habit reminders. Call after completing a habit so
 * today's reminder is suppressed if already done.
 * Only schedules reminders for incomplete habits for the rest of today.
 */
export async function rescheduleAllHabitReminders(
  habits: Array<{
    id: string;
    name: string;
    icon: string;
    reminderTime: string | null;
    schedule: { type: string; days?: number[] };
    isArchived: boolean;
  }>,
) {
  for (const h of habits) {
    if (h.isArchived || !h.reminderTime) continue;
    const days = h.schedule.type === 'specific_days' ? h.schedule.days : undefined;
    await scheduleHabitReminder(h.id, h.name, h.icon, h.reminderTime, days);
  }
}
