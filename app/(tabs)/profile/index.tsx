import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  isBiometricAvailable,
  getBiometricKind,
  authenticate as bioAuthenticate,
} from '../../../src/lib/biometric';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
// SVG imports kept for potential future use
// import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {
  AVATAR_ICONS,
  AvatarIconGlyph,
  getAvatarIconById,
} from '../../../src/constants/avatar-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useHabitStore } from '../../../src/stores/habit-store';
import { useCapsuleStore } from '../../../src/stores/capsule-store';
import { useAuthStore } from '../../../src/stores/auth-store';
import { supabase } from '../../../src/lib/supabase';
import { getLevelProgress } from '../../../src/constants/xp';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius, Shadows } from '../../../src/constants/theme';
import { subDays, format } from 'date-fns';
import { isHabitScheduledForDay } from '../../../src/types/habit';
import AddHabitSheet from '../../../src/components/AddHabitSheet';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 84 : 64;
// ── Badge definitions ──
// `repeat: false` = one-time unlock (shown in "Unlockables")
// `repeat: true`  = stackable reward (shown in "Ongoing rewards")
type BadgeDef = {
  id: string;
  icon: string;
  label: string;
  requirement: string;
  bonusXP: number;
  bonusDesc: string;
  color: string;
  repeat: boolean;
};

const BADGE_DEFS: BadgeDef[] = [
  // ── One-time unlocks ──
  {
    id: 'starter',
    icon: 'rocket',
    label: 'Starter',
    requirement: 'Set up your first habit',
    bonusXP: 25,
    bonusDesc: '+25 XP · one-time',
    color: Colors.primaryContainer,
    repeat: false,
  },
  {
    id: 'postman',
    icon: 'mail',
    label: 'Postman',
    requirement: 'Send your first time capsule',
    bonusXP: 200,
    bonusDesc: '+200 XP · one-time',
    color: '#F59E0B',
    repeat: false,
  },
  {
    id: 'time-traveler',
    icon: 'hourglass',
    label: 'Time Traveler',
    requirement: 'Open & save your first capsule',
    bonusXP: 200,
    bonusDesc: '+200 XP · one-time',
    color: '#38BDF8',
    repeat: false,
  },
  {
    id: 'star',
    icon: 'star',
    label: 'Star',
    requirement: 'Track 10+ active habits',
    bonusXP: 0,
    bonusDesc: 'Achievement · one-time',
    color: '#FBBF24',
    repeat: false,
  },
  {
    id: 'lightning',
    icon: 'flash',
    label: 'Lightning',
    requirement: 'Track 5+ active habits',
    bonusXP: 0,
    bonusDesc: 'Achievement · one-time',
    color: '#A78BFA',
    repeat: false,
  },

  // ── Repeating / stackable rewards ──
  {
    id: 'writer',
    icon: 'create',
    label: 'Writer',
    requirement: 'Seal a time capsule',
    bonusXP: 100,
    bonusDesc: '+100 XP per capsule (+25 with photo)',
    color: '#34D399',
    repeat: true,
  },
  {
    id: 'photogenic',
    icon: 'camera',
    label: 'Photogenic',
    requirement: 'Create a habit with photo proof',
    bonusXP: 50,
    bonusDesc: '+50 XP per habit',
    color: '#D58FF0',
    repeat: true,
  },
  {
    id: 'live',
    icon: 'location',
    label: 'LIVE',
    requirement: 'Create a habit with location proof',
    bonusXP: 50,
    bonusDesc: '+50 XP per habit',
    color: '#60A5FA',
    repeat: true,
  },
  {
    id: 'on-fire',
    icon: 'flame',
    label: 'On Fire',
    requirement: '7-day streak on any habit',
    bonusXP: 50,
    bonusDesc: '+50 XP every 7 days',
    color: '#FF6B35',
    repeat: true,
  },
  {
    id: 'veteran',
    icon: 'medal',
    label: 'Veteran',
    requirement: '30-day streak on any habit',
    bonusXP: 200,
    bonusDesc: '+200 XP every 30 days',
    color: Colors.secondary,
    repeat: true,
  },
  {
    id: 'champion',
    icon: 'trophy',
    label: 'Champion',
    requirement: 'Complete all habits in a day',
    bonusXP: 50,
    bonusDesc: '+50 XP per perfect day',
    color: Colors.primary,
    repeat: true,
  },
  {
    id: 'diamond',
    icon: 'diamond',
    label: 'Diamond',
    requirement: 'All habits done for a full week',
    bonusXP: 200,
    bonusDesc: '+200 XP every 7 days',
    color: '#60A5FA',
    repeat: true,
  },
];

export default function ProfileScreen() {
  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const getTotalXP = useHabitStore((s) => s.getTotalXP);
  const getOverallStreak = useHabitStore((s) => s.getOverallStreak);
  const getHabitStreak = useHabitStore((s) => s.getHabitStreak);
  const fetchHabits = useHabitStore((s) => s.fetchHabits);
  const fetchLogs = useHabitStore((s) => s.fetchLogs);
  const fetchProfileXP = useHabitStore((s) => s.fetchProfileXP);
  const deleteHabit = useHabitStore((s) => s.deleteHabit);
  const updateHabit = useHabitStore((s) => s.updateHabit);
  const capsules = useCapsuleStore((s) => s.capsules);
  const user = useAuthStore((s) => s.user);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const setBiometricPreference = useAuthStore((s) => s.setBiometricPreference);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioKind, setBioKind] = useState<'face' | 'fingerprint' | 'iris' | 'biometric'>('biometric');

  useEffect(() => {
    (async () => {
      const avail = await isBiometricAvailable();
      setBioAvailable(avail);
      if (avail) setBioKind(await getBiometricKind());
    })();
  }, []);

  const bioLabel =
    bioKind === 'face' ? 'Face ID' : bioKind === 'fingerprint' ? 'Touch ID' : 'Biometric';
  const bioIcon =
    bioKind === 'face' ? 'scan-outline' : bioKind === 'fingerprint' ? 'finger-print' : 'lock-closed';

  const toggleBiometric = async () => {
    if (!bioAvailable) {
      Alert.alert(
        'Not available',
        'Your device has no biometric hardware enrolled. Set up Face ID or Touch ID in Settings first.',
      );
      return;
    }
    if (biometricEnabled) {
      // Disabling — confirm with a biometric check so a thief can't flip it off
      const res = await bioAuthenticate(`Disable ${bioLabel}`);
      if (!res.success) return;
      await setBiometricPreference(false);
      return;
    }
    // Enabling — confirm identity first
    const res = await bioAuthenticate(`Enable ${bioLabel} for Ritual`);
    if (!res.success) return;
    await setBiometricPreference(true);
    Alert.alert(`${bioLabel} enabled`, `Ritual will require ${bioLabel} to unlock.`);
  };

  const [habitsModalVisible, setHabitsModalVisible] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<typeof BADGE_DEFS[0] | null>(null);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(
    user?.user_metadata?.avatar_emoji || null
  );
  const [avatarIconId, setAvatarIconId] = useState<string | null>(
    user?.user_metadata?.avatar_icon || null
  );
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [userGoal, setUserGoal] = useState<string>(user?.user_metadata?.goal || '');

  // Edit profile modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIconId, setEditIconId] = useState<string | null>(null);
  const [editGoal, setEditGoal] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const totalXP = getTotalXP();
  const streak = getOverallStreak();
  const activeHabits = habits.filter(h => !h.isArchived);
  const archivedHabits = habits.filter(h => h.isArchived);
  const activeCount = activeHabits.length;
  const { level, nextLevelXP, progress: levelProgress } = getLevelProgress(totalXP);

  const displayName = user?.user_metadata?.display_name || 'Ritualist';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const openEditProfile = () => {
    setEditName(displayName);
    setEditIconId(avatarIconId);
    setEditGoal(userGoal);
    setEditModalVisible(true);
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    setIsSavingProfile(true);
    try {
      // Update auth user metadata (name, avatar icon, goal).
      // `avatar_emoji` is cleared when user picks an icon so the icon
      // takes precedence on future loads.
      await supabase.auth.updateUser({
        data: {
          display_name: editName.trim(),
          avatar_icon: editIconId,
          avatar_emoji: editIconId ? null : avatarEmoji,
          goal: editGoal.trim(),
        },
      });
      // Update profiles table bio
      if (user) {
        await supabase.from('profiles').update({ bio: editGoal.trim() }).eq('id', user.id);
      }
      setAvatarIconId(editIconId);
      if (editIconId) setAvatarEmoji(null);
      setUserGoal(editGoal.trim());
      setEditModalVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Re-fetch data when screen regains focus (e.g. after editing a habit)
  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        await Promise.all([fetchHabits(), fetchLogs(), fetchProfileXP()]);
      };
      refresh();
    }, [])
  );

  // Badge earned status + times earned
  // NOTE: streak computation is done inline with a shared completed-dates Set
  // to avoid calling getHabitStreak (which rebuilds a Set from logs) per habit.
  const badgeStatus = useMemo(() => {
    // Build one shared lookup of completed dates per habit
    const completedByHabit = new Map<string, Set<string>>();
    for (const l of logs) {
      if (!l.completed) continue;
      let s = completedByHabit.get(l.habitId);
      if (!s) { s = new Set(); completedByHabit.set(l.habitId, s); }
      s.add(l.loggedDate);
    }

    // Compute max streak across all active habits in one pass
    let maxHabitStreak = 0;
    const today = new Date();
    for (const h of activeHabits) {
      const dates = completedByHabit.get(h.id);
      let hStreak = 0;
      for (let daysAgo = 0; daysAgo < 730; daysAgo++) {
        const date = subDays(today, daysAgo);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dow = date.getDay();
        if (!isHabitScheduledForDay(h, dow)) continue;
        if (dates?.has(dateStr)) {
          hStreak++;
        } else if (daysAgo === 0) {
          continue;
        } else {
          break;
        }
      }
      if (hStreak > maxHabitStreak) maxHabitStreak = hStreak;
    }

    const onFireTimes = maxHabitStreak >= 7 ? Math.floor(maxHabitStreak / 7) : 0;
    const veteranTimes = maxHabitStreak >= 30 ? Math.floor(maxHabitStreak / 30) : 0;
    const championTimes = streak >= 1 ? streak : 0;
    const diamondTimes = streak >= 7 ? Math.floor(streak / 7) : 0;

    const hasAnyHabit = activeCount > 0;
    const photoProofHabits = activeHabits.filter(h =>
      h.proofRequired === 'photo' || h.proofRequired === 'photo_or_location'
    ).length;
    const locationProofHabits = activeHabits.filter(h =>
      h.proofRequired === 'location' || h.proofRequired === 'photo_or_location'
    ).length;

    const sentCapsuleCount = capsules.length;
    const savedOpenedCount = capsules.filter((c) => c.saved && !!c.openedAt).length;

    return {
      'starter': { earned: hasAnyHabit, times: hasAnyHabit ? 1 : 0 },
      'photogenic': { earned: photoProofHabits > 0, times: photoProofHabits },
      'live': { earned: locationProofHabits > 0, times: locationProofHabits },
      'on-fire': { earned: maxHabitStreak >= 7, times: onFireTimes },
      'veteran': { earned: maxHabitStreak >= 30, times: veteranTimes },
      'champion': { earned: streak >= 1, times: championTimes },
      'diamond': { earned: streak >= 7, times: diamondTimes },
      'star': { earned: activeCount >= 10, times: activeCount >= 10 ? 1 : 0 },
      'lightning': { earned: activeCount >= 5, times: activeCount >= 5 ? 1 : 0 },
      'postman': { earned: sentCapsuleCount >= 1, times: sentCapsuleCount >= 1 ? 1 : 0 },
      'time-traveler': { earned: savedOpenedCount >= 1, times: savedOpenedCount >= 1 ? 1 : 0 },
      'writer': { earned: sentCapsuleCount >= 1, times: sentCapsuleCount },
    } as Record<string, { earned: boolean; times: number }>;
  }, [activeHabits, logs, streak, activeCount, capsules]);

  const openBadgeModal = useCallback((badge: typeof BADGE_DEFS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedBadge(badge);
    setBadgeModalVisible(true);
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Level Hero */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.profileHero}>
          <Pressable style={styles.avatarLarge} onPress={openEditProfile}>
            <View style={styles.avatarCircle}>
              {(() => {
                const iconDef = getAvatarIconById(avatarIconId);
                if (iconDef) {
                  return <AvatarIconGlyph def={iconDef} size={40} />;
                }
                if (avatarEmoji) {
                  return <Text style={styles.avatarEmojiLarge}>{avatarEmoji}</Text>;
                }
                return <Text style={styles.avatarInitialsLarge}>{initials}</Text>;
              })()}
            </View>
            <View style={styles.avatarEditBadge}>
              <Ionicons name="pencil" size={10} color={Colors.white} />
            </View>
          </Pressable>

          <Pressable onPress={openEditProfile}>
            <Text style={styles.profileName}>{displayName}</Text>
            {userGoal ? (
              <Text style={styles.profileGoal}>{userGoal}</Text>
            ) : (
              <Text style={styles.profileGoalPlaceholder}>Tap to set your goal</Text>
            )}
          </Pressable>

          {/* Level display */}
          <View style={styles.levelDisplay}>
            <View style={styles.levelShield}>
              <Ionicons name="shield" size={28} color={Colors.primaryContainer} />
              <Text style={styles.levelNumberOverlay}>{level}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>Level {level}</Text>
              <View style={styles.levelBarTrack}>
                <Animated.View
                  entering={FadeIn.duration(800).delay(300)}
                  style={[styles.levelBarFill, { width: `${Math.min(levelProgress * 100, 100)}%` }]}
                />
              </View>
              <Text style={styles.levelSub}>
                {totalXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Manage Habits ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <Text style={styles.settingsSectionTitle}>Manage Habits</Text>
          <Pressable
            style={styles.settingsRow}
            onPress={() => setHabitsModalVisible(true)}
          >
            <View style={styles.settingsRowLeft}>
              <Ionicons name="list-outline" size={20} color={Colors.primaryContainer} />
              <View>
                <Text style={styles.settingsRowLabel}>My Habits</Text>
                <Text style={styles.settingsRowSub}>
                  {activeCount} active{archivedHabits.length > 0 ? ` · ${archivedHabits.length} archived` : ''}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.zinc600} />
          </Pressable>
          <Pressable
            style={styles.settingsRow}
            onPress={() => {
              if (habits.length === 0) {
                router.push('/habit/new');
              } else {
                setShowAddSheet(true);
              }
            }}
          >
            <View style={styles.settingsRowLeft}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.secondary} />
              <Text style={styles.settingsRowLabel}>Add New Habit</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.zinc600} />
          </Pressable>
        </Animated.View>

        {/* ── Rewards ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(300)}>
          <Text style={styles.sectionTitle}>Rewards</Text>

          {/* One-time unlocks */}
          <View style={styles.rewardGroupHeader}>
            <View style={styles.rewardGroupIconWrap}>
              <Ionicons name="lock-open" size={14} color={Colors.primaryContainer} />
            </View>
            <Text style={styles.rewardGroupTitle}>Unlockables</Text>
            <Text style={styles.rewardGroupSub}>
              {BADGE_DEFS.filter(b => !b.repeat && badgeStatus[b.id]?.earned).length}
              /
              {BADGE_DEFS.filter(b => !b.repeat).length}
            </Text>
          </View>
          <View style={styles.badgeGrid}>
            {BADGE_DEFS
              .filter(b => !b.repeat)
              .slice()
              .sort((a, b) => {
                const aEarned = badgeStatus[a.id]?.earned ? 1 : 0;
                const bEarned = badgeStatus[b.id]?.earned ? 1 : 0;
                if (aEarned !== bEarned) return bEarned - aEarned; // earned first
                return a.bonusXP - b.bonusXP; // then low → high XP
              })
              .map((badge) => {
              const status = badgeStatus[badge.id] ?? { earned: false, times: 0 };
              return (
                <Pressable
                  key={badge.id}
                  style={styles.badgeCell}
                  onPress={() => openBadgeModal(badge)}
                >
                  <View
                    style={[
                      styles.badgeCircle,
                      {
                        backgroundColor: status.earned ? `${badge.color}18` : Colors.surfaceContainerHigh,
                        ...(status.earned ? {
                          shadowColor: badge.color,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.4,
                          shadowRadius: 12,
                          elevation: 6,
                        } : {}),
                      },
                    ]}
                  >
                    <Ionicons
                      name={badge.icon as any}
                      size={28}
                      color={status.earned ? badge.color : Colors.zinc600}
                      style={{ opacity: status.earned ? 1 : 0.35 }}
                    />
                  </View>
                  <Text style={[styles.badgeName, !status.earned && { color: Colors.zinc600 }]}>
                    {badge.label}
                  </Text>
                  {!status.earned && badge.bonusXP > 0 && (
                    <Text style={styles.badgeTeaser}>+{badge.bonusXP} XP</Text>
                  )}
                  {status.earned && (
                    <View style={[styles.badgeCountPill, { backgroundColor: `${badge.color}25` }]}>
                      <Text style={[styles.badgeCountText, { color: badge.color }]}>
                        UNLOCKED
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Repeating / stackable */}
          <View style={[styles.rewardGroupHeader, { marginTop: Spacing.lg }]}>
            <View style={[styles.rewardGroupIconWrap, { backgroundColor: `${Colors.secondary}20` }]}>
              <Ionicons name="infinite" size={14} color={Colors.secondary} />
            </View>
            <Text style={styles.rewardGroupTitle}>Ongoing rewards</Text>
            <Text style={styles.rewardGroupSub}>Stack forever</Text>
          </View>
          <View style={styles.badgeGrid}>
            {BADGE_DEFS
              .filter(b => b.repeat)
              .slice()
              .sort((a, b) => {
                const aEarned = badgeStatus[a.id]?.earned ? 1 : 0;
                const bEarned = badgeStatus[b.id]?.earned ? 1 : 0;
                if (aEarned !== bEarned) return bEarned - aEarned;
                return a.bonusXP - b.bonusXP;
              })
              .map((badge) => {
              const status = badgeStatus[badge.id] ?? { earned: false, times: 0 };
              return (
                <Pressable
                  key={badge.id}
                  style={styles.badgeCell}
                  onPress={() => openBadgeModal(badge)}
                >
                  <View
                    style={[
                      styles.badgeCircle,
                      {
                        backgroundColor: status.earned ? `${badge.color}18` : Colors.surfaceContainerHigh,
                        ...(status.earned ? {
                          shadowColor: badge.color,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.4,
                          shadowRadius: 12,
                          elevation: 6,
                        } : {}),
                      },
                    ]}
                  >
                    <Ionicons
                      name={badge.icon as any}
                      size={28}
                      color={status.earned ? badge.color : Colors.zinc600}
                      style={{ opacity: status.earned ? 1 : 0.35 }}
                    />
                  </View>
                  <Text style={[styles.badgeName, !status.earned && { color: Colors.zinc600 }]}>
                    {badge.label}
                  </Text>
                  {!status.earned && badge.bonusXP > 0 && (
                    <Text style={styles.badgeTeaser}>+{badge.bonusXP} XP</Text>
                  )}
                  {status.earned && status.times > 0 && (
                    <View style={[styles.badgeCountPill, { backgroundColor: `${badge.color}25` }]}>
                      <Text style={[styles.badgeCountText, { color: badge.color }]}>
                        ×{status.times}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Settings ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(400)} style={styles.accountActions}>
          <Text style={styles.settingsSectionTitle}>Settings</Text>
          {/* Biometric lock */}
          {bioAvailable && (
            <Pressable style={styles.bioRow} onPress={toggleBiometric}>
              <View style={styles.bioIconWrap}>
                <Ionicons name={bioIcon as any} size={20} color={Colors.primaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bioLabel}>{bioLabel} lock</Text>
                <Text style={styles.bioSub}>
                  {biometricEnabled
                    ? `Ritual unlocks with ${bioLabel}`
                    : `Require ${bioLabel} to open Ritual`}
                </Text>
              </View>
              <View style={[styles.bioToggle, biometricEnabled && styles.bioToggleOn]}>
                <View style={[styles.bioKnob, biometricEnabled && styles.bioKnobOn]} />
              </View>
            </Pressable>
          )}

          {/* Sign Out */}
          <Pressable
            style={styles.signOutBtn}
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: () => useAuthStore.getState().signOut() },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={16} color={Colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>

          {/* Danger Zone — hidden behind a subtle toggle */}
          <Pressable
            style={styles.advancedToggle}
            onPress={() => setShowDangerZone((v) => !v)}
            hitSlop={8}
          >
            <Text style={styles.advancedToggleText}>
              {showDangerZone ? 'Hide advanced' : 'Advanced'}
            </Text>
          </Pressable>

          {showDangerZone && (
          <>
          <Text style={styles.dangerHeader}>Danger Zone</Text>

          {/* Reset All Data */}
          <Pressable
            style={styles.dangerBtn}
            onPress={() => {
              Alert.alert(
                'Reset All Data',
                'This will permanently delete every habit, log, and XP event. Your account stays. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset Everything',
                    style: 'destructive',
                    onPress: async () => {
                      const { error } = await useAuthStore.getState().resetMyData();
                      if (error) {
                        Alert.alert('Error', error);
                        return;
                      }
                      // Refresh local stores so UI shows empty state immediately
                      await Promise.all([
                        fetchHabits(),
                        fetchLogs(),
                        fetchProfileXP(),
                      ]);
                      Alert.alert('Done', 'Your data has been reset.');
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="refresh-outline" size={16} color={Colors.error} />
            <Text style={styles.dangerBtnText}>Reset All Data</Text>
          </Pressable>

          {/* Delete Account */}
          <Pressable
            style={styles.dangerBtnSolid}
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'This permanently deletes your account and all data. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete Forever',
                    style: 'destructive',
                    onPress: () => {
                      // Second confirmation — this is unrecoverable
                      Alert.alert(
                        'Are you sure?',
                        'Last chance. Your account will be gone forever.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Yes, delete my account',
                            style: 'destructive',
                            onPress: async () => {
                              const { error } = await useAuthStore.getState().deleteAccount();
                              if (error) {
                                Alert.alert('Error', error);
                              }
                              // On success, AuthGate kicks user back to /login automatically
                            },
                          },
                        ]
                      );
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.white} />
            <Text style={styles.dangerBtnSolidText}>Delete Account</Text>
          </Pressable>
          </>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Habits List Modal ── */}
      <Modal
        visible={habitsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHabitsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My Habits</Text>
            <Pressable onPress={() => setHabitsModalVisible(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={Colors.zinc400} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {activeHabits.map((habit) => {
              const scheduleText =
                habit.schedule.type === 'every_day'
                  ? 'Every day'
                  : `${(habit.schedule.days ?? []).length} days / week`;
              const streakInfo = getHabitStreak(habit.id);

              return (
                <Pressable
                  key={habit.id}
                  style={styles.habitRow}
                  onPress={() => {
                    router.push(`/habit/${habit.id}/edit`);
                  }}
                >
                  <View style={styles.habitRowLeft}>
                    <View style={[styles.habitEmojiCircle, { backgroundColor: `${habit.color}18` }]}>
                      <Text style={styles.habitEmojiText}>{habit.icon}</Text>
                    </View>
                    <View style={styles.habitRowInfo}>
                      <Text style={styles.habitRowName}>{habit.name}</Text>
                      <Text style={styles.habitRowSub}>
                        {habit.xpValue} XP  ·  {scheduleText}
                        {streakInfo.count > 0 ? `  ·  ${streakInfo.count}d streak` : ''}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.zinc600} />
                </Pressable>
              );
            })}

            {/* Add habit button — close modal first, then show chooser */}
            <Pressable
              style={styles.addHabitRow}
              onPress={() => {
                setHabitsModalVisible(false);
                if (habits.length === 0) {
                  router.push('/habit/new');
                  return;
                }
                // Small delay so the modal dismisses before the sheet appears
                setTimeout(() => setShowAddSheet(true), 350);
              }}
            >
              <View style={styles.addHabitCircle}>
                <Ionicons name="add" size={22} color={Colors.primaryContainer} />
              </View>
              <Text style={styles.addHabitText}>Add New Habit</Text>
            </Pressable>

            {/* Archived habits section */}
            {archivedHabits.length > 0 && (
              <>
                <View style={styles.archivedHeader}>
                  <Ionicons name="archive-outline" size={14} color={Colors.zinc500} />
                  <Text style={styles.archivedHeaderText}>
                    ARCHIVED ({archivedHabits.length})
                  </Text>
                </View>

                {archivedHabits.map((habit) => (
                  <View key={habit.id} style={styles.archivedRow}>
                    <View style={styles.habitRowLeft}>
                      <View style={[styles.habitEmojiCircle, { backgroundColor: Colors.surfaceContainerLowest, opacity: 0.6 }]}>
                        <Text style={styles.habitEmojiText}>{habit.icon}</Text>
                      </View>
                      <View style={styles.habitRowInfo}>
                        <Text style={[styles.habitRowName, { color: Colors.zinc500 }]}>{habit.name}</Text>
                        <Text style={styles.habitRowSub}>{habit.xpValue} XP · Archived</Text>
                      </View>
                    </View>
                    <View style={styles.archivedActions}>
                      <Pressable
                        style={styles.archivedActionBtn}
                        hitSlop={8}
                        onPress={() => {
                          Alert.alert('Restore Habit', `Bring "${habit.name}" back to your daily rituals?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Restore',
                              onPress: () => updateHabit(habit.id, { isArchived: false }),
                            },
                          ]);
                        }}
                      >
                        <Ionicons name="refresh" size={16} color={Colors.secondary} />
                      </Pressable>
                      <Pressable
                        style={styles.archivedActionBtn}
                        hitSlop={8}
                        onPress={() => {
                          Alert.alert(
                            'Delete Forever',
                            `Permanently delete "${habit.name}" and all its XP? This cannot be undone.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => deleteHabit(habit.id),
                              },
                            ]
                          );
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.error} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Badge Detail Modal ── */}
      <Modal
        visible={badgeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBadgeModalVisible(false)}
      >
        <Pressable
          style={styles.badgeModalOverlay}
          onPress={() => setBadgeModalVisible(false)}
        >
          <Pressable style={styles.badgeModalCard} onPress={() => {}}>
            {selectedBadge && (() => {
              const status = badgeStatus[selectedBadge.id] ?? { earned: false, times: 0 };
              return (
                <>
                  {/* Badge icon */}
                  <View
                    style={[
                      styles.badgeModalIcon,
                      {
                        backgroundColor: status.earned
                          ? `${selectedBadge.color}20`
                          : Colors.surfaceContainerHighest,
                        ...(status.earned ? {
                          shadowColor: selectedBadge.color,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.5,
                          shadowRadius: 20,
                          elevation: 10,
                        } : {}),
                      },
                    ]}
                  >
                    <Ionicons
                      name={selectedBadge.icon as any}
                      size={40}
                      color={status.earned ? selectedBadge.color : Colors.zinc600}
                      style={{ opacity: status.earned ? 1 : 0.4 }}
                    />
                  </View>

                  {/* Badge name + status */}
                  <Text style={styles.badgeModalName}>{selectedBadge.label}</Text>
                  <View style={[
                    styles.badgeModalStatusPill,
                    { backgroundColor: status.earned ? `${selectedBadge.color}20` : Colors.surfaceContainerHighest },
                  ]}>
                    <Text style={[
                      styles.badgeModalStatusText,
                      { color: status.earned ? selectedBadge.color : Colors.zinc500 },
                    ]}>
                      {status.earned ? 'ACTIVE' : 'LOCKED'}
                    </Text>
                  </View>

                  {/* Requirement */}
                  <View style={styles.badgeModalSection}>
                    <Text style={styles.badgeModalSectionLabel}>REQUIREMENT</Text>
                    <Text style={styles.badgeModalSectionValue}>{selectedBadge.requirement}</Text>
                  </View>

                  {/* Bonus */}
                  {selectedBadge.bonusXP > 0 && (
                    <View style={styles.badgeModalSection}>
                      <Text style={styles.badgeModalSectionLabel}>BONUS</Text>
                      <Text style={[styles.badgeModalBonusValue, { color: selectedBadge.color }]}>
                        {selectedBadge.bonusDesc}
                      </Text>
                    </View>
                  )}

                  {/* Times earned */}
                  {status.times > 0 && (
                    <View style={styles.badgeModalSection}>
                      <Text style={styles.badgeModalSectionLabel}>EARNED</Text>
                      <Text style={styles.badgeModalSectionValue}>
                        {status.times} {status.times === 1 ? 'time' : 'times'}
                      </Text>
                    </View>
                  )}

                  {/* Total bonus XP */}
                  {status.times > 0 && selectedBadge.bonusXP > 0 && (
                    <View style={[styles.badgeModalTotalRow, { borderTopColor: Colors.zinc700 }]}>
                      <Text style={styles.badgeModalTotalLabel}>Total bonus XP</Text>
                      <Text style={[styles.badgeModalTotalValue, { color: selectedBadge.color }]}>
                        +{status.times * selectedBadge.bonusXP} XP
                      </Text>
                    </View>
                  )}
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Edit Profile Modal ── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.editModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.editModalHeader}>
            <Pressable onPress={() => setEditModalVisible(false)} hitSlop={12}>
              <Text style={styles.editModalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.editModalTitle}>Edit Profile</Text>
            <Pressable onPress={saveProfile} disabled={isSavingProfile || !editName.trim()} hitSlop={12}>
              <Text style={[
                styles.editModalSave,
                (!editName.trim() || isSavingProfile) && { opacity: 0.4 },
              ]}>
                {isSavingProfile ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.editModalScroll} contentContainerStyle={styles.editModalScrollContent}>
            {/* Avatar preview */}
            <View style={styles.editAvatarSection}>
              <View style={styles.editAvatarCircle}>
                {(() => {
                  const iconDef = getAvatarIconById(editIconId);
                  if (iconDef) {
                    return <AvatarIconGlyph def={iconDef} size={44} />;
                  }
                  return (
                    <Text style={styles.editAvatarInitials}>
                      {editName.trim()
                        ? editName.trim().split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                        : initials}
                    </Text>
                  );
                })()}
              </View>
              <Text style={styles.editAvatarHint}>Pick an icon</Text>
            </View>

            {/* Icon grid */}
            <View style={styles.iconPickerGrid}>
              {AVATAR_ICONS.map((icon) => {
                const picked = editIconId === icon.id;
                return (
                  <Pressable
                    key={icon.id}
                    style={[
                      styles.iconPickerCell,
                      picked && {
                        borderColor: icon.color,
                        backgroundColor: `${icon.color}1A`,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setEditIconId(picked ? null : icon.id);
                    }}
                  >
                    <AvatarIconGlyph
                      def={icon}
                      size={26}
                      color={picked ? icon.color : Colors.zinc400}
                    />
                  </Pressable>
                );
              })}
            </View>
            {editIconId && (
              <Pressable onPress={() => setEditIconId(null)} style={{ alignSelf: 'center' }}>
                <Text style={styles.editRemoveEmoji}>Clear icon</Text>
              </Pressable>
            )}

            {/* Name */}
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>NAME</Text>
              <TextInput
                style={styles.editFieldInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={Colors.zinc600}
                autoCapitalize="words"
                maxLength={40}
              />
            </View>

            {/* Goal */}
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>GOAL</Text>
              <TextInput
                style={styles.editFieldInput}
                value={editGoal}
                onChangeText={setEditGoal}
                placeholder="e.g. Build unbreakable discipline"
                placeholderTextColor={Colors.zinc600}
                maxLength={80}
              />
            </View>
          </ScrollView>

        </KeyboardAvoidingView>
      </Modal>

      {/* Add-habit chooser */}
      <AddHabitSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onCreateOwn={() => {
          setShowAddSheet(false);
          setHabitsModalVisible(false);
          router.push('/habit/new');
        }}
        onBrowse={() => {
          setShowAddSheet(false);
          setHabitsModalVisible(false);
          router.push('/onboarding');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: TAB_BAR_HEIGHT + 30,
  },

  // ── Profile Hero ──
  profileHero: { alignItems: 'center', marginBottom: Spacing['2xl'] },
  avatarLarge: { position: 'relative', marginBottom: Spacing.md },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: Colors.primaryContainer,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmojiLarge: { fontSize: 36 },
  avatarInitialsLarge: {
    fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes['2xl'],
    color: Colors.primary,
  },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  profileName: {
    fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes['2xl'],
    color: Colors.onSurface, marginBottom: 2, textAlign: 'center',
  },
  profileGoal: {
    fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.zinc400,
    textAlign: 'center', marginBottom: Spacing.lg,
  },
  profileGoalPlaceholder: {
    fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.zinc600,
    textAlign: 'center', marginBottom: Spacing.lg, fontStyle: 'italic',
  },

  // Level display
  levelDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, width: '100%',
  },
  levelShield: {
    width: 52, height: 52, alignItems: 'center', justifyContent: 'center',
  },
  levelNumberOverlay: {
    position: 'absolute', fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes.sm, color: Colors.onPrimaryContainer,
  },
  levelInfo: { flex: 1 },
  levelTitle: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.lg, color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  levelBarTrack: {
    height: 6, borderRadius: 3, backgroundColor: Colors.surfaceContainerHighest,
    overflow: 'hidden', marginBottom: 4,
  },
  levelBarFill: {
    height: '100%', borderRadius: 3, backgroundColor: Colors.primaryContainer,
  },
  levelSub: {
    fontFamily: Fonts.body, fontSize: FontSizes.xs, color: Colors.zinc500,
  },

  // ── Settings sections ──
  settingsSectionTitle: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.lg, color: Colors.onSurface,
    marginBottom: Spacing.md, marginTop: Spacing.lg,
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginBottom: Spacing.sm,
  },
  settingsRowLeft: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1,
  },
  settingsRowLabel: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.md, color: Colors.onSurface,
  },
  settingsRowSub: {
    fontFamily: Fonts.body, fontSize: FontSizes.xs, color: Colors.zinc500, marginTop: 1,
  },

  // ── Bento row (legacy, kept for modal use) ──
  bentoRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing['2xl'] },
  bentoCard: {
    flex: 1, backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.md,
    padding: Spacing.lg, minHeight: 130,
  },
  bentoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bentoLabel: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs, letterSpacing: 2, textTransform: 'uppercase',
  },
  bentoValue: { fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes['3xl'], marginTop: Spacing.sm },
  bentoSub: { fontFamily: Fonts.body, fontSize: FontSizes.xs, color: Colors.zinc500, marginTop: 2 },
  addBtn: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center',
  },

  // Week dots (last 7 days)
  weekDotsRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm,
    paddingHorizontal: 2,
  },
  weekDotCol: { alignItems: 'center', gap: 3 },
  weekDotCircle: {
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  weekDotFilled: { backgroundColor: Colors.secondary },
  weekDotPartial: {
    backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.secondary,
  },
  weekDotEmpty: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.zinc600,
  },
  weekDotNoSchedule: { backgroundColor: Colors.zinc800, width: 6, height: 6, borderRadius: 3 },
  weekDotToday: { borderWidth: 2, borderColor: Colors.primaryContainer },
  weekDotLabel: { fontFamily: Fonts.body, fontSize: 8, color: Colors.zinc600 },

  // ── Chart ──
  sectionTitle: {
    color: Colors.onSurface, fontFamily: Fonts.headlineBold, fontSize: FontSizes.xl,
  },
  chartCard: {
    backgroundColor: Colors.surfaceContainerLow, borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginBottom: Spacing['2xl'],
  },
  chartTotal: {
    fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes['2xl'], color: Colors.onSurface,
    marginBottom: Spacing.lg,
  },
  chartLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 6,
  },
  chartLabel: {
    textAlign: 'center',
    fontFamily: Fonts.bodySemiBold, fontSize: 10, color: Colors.zinc500,
  },
  chartEmpty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing['2xl'], gap: Spacing.sm,
  },
  chartEmptyText: {
    fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.zinc500,
    textAlign: 'center',
  },

  // ── Badges / Rewards ──
  rewardGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  rewardGroupIconWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: `${Colors.primaryContainer}20`,
    alignItems: 'center', justifyContent: 'center',
  },
  rewardGroupTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.sm,
    color: Colors.onSurface,
    letterSpacing: 0.3,
    flex: 1,
  },
  rewardGroupSub: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  badgeTeaser: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 10,
    color: Colors.zinc600,
    marginTop: 2,
  },
  badgeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  badgeCell: { width: '30%', alignItems: 'center', marginBottom: Spacing.sm },
  badgeCircle: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.sm,
  },
  badgeName: {
    color: Colors.onSurfaceVariant, fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs, textAlign: 'center',
  },
  badgeCountPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  badgeCountText: {
    fontFamily: Fonts.headlineBold, fontSize: 10,
  },

  // ── Sign out ──
  // ── Theme Picker ──
  themeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  themeCard: {
    width: '47%' as any, backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    borderWidth: 2, borderColor: 'transparent', position: 'relative',
  },
  themeCardActive: {
    borderColor: Colors.primaryContainer,
  },
  themePreview: {
    height: 56, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm,
    padding: Spacing.sm, justifyContent: 'center', gap: 4,
    overflow: 'hidden',
  },
  themePreviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  themePreviewDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  themePreviewBar: {
    flex: 1, height: 4, borderRadius: 2, marginLeft: 4,
  },
  themePreviewLine: {
    height: 3, borderRadius: 1.5, width: '80%',
  },
  themeName: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.md,
    color: Colors.onSurface, marginBottom: 2,
  },
  themeDesc: {
    fontFamily: Fonts.body, fontSize: FontSizes.xs, color: Colors.zinc500,
  },
  themeCheck: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
  },

  accountActions: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    marginTop: Spacing.lg,
  },
  dangerHeader: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  dangerBtnText: {
    color: Colors.error,
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
  },
  dangerBtnSolid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  dangerBtnSolidText: {
    color: Colors.white,
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
  },
  signOutBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.surfaceContainerHigh,
    paddingVertical: Spacing.lg, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.outlineVariant,
  },
  signOutText: { color: Colors.error, fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.md },

  // ── Biometric row ──
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  bioIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primaryContainer}1A` as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioLabel: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
  },
  bioSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
    marginTop: 2,
  },
  bioToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surfaceContainerHigh,
    padding: 3,
    justifyContent: 'center',
  },
  bioToggleOn: { backgroundColor: Colors.primaryContainer },
  bioKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.zinc400,
  },
  bioKnobOn: {
    backgroundColor: Colors.onPrimaryContainer,
    alignSelf: 'flex-end',
  },

  // ── Habits Modal ──
  modalContainer: {
    flex: 1, backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.zinc700,
  },
  modalTitle: {
    fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes.xl, color: Colors.onSurface,
  },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  habitRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginBottom: Spacing.sm,
  },
  habitRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  habitEmojiCircle: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', marginRight: Spacing.md,
  },
  habitEmojiText: { fontSize: 20 },
  habitRowInfo: { flex: 1 },
  habitRowName: { fontFamily: Fonts.headlineBold, fontSize: FontSizes.md, color: Colors.onSurface },
  habitRowSub: { fontFamily: Fonts.body, fontSize: FontSizes.xs, color: Colors.zinc500, marginTop: 2 },
  addHabitRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  addHabitCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHigh, borderWidth: 2,
    borderColor: Colors.primaryContainer, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addHabitText: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.md, color: Colors.primaryContainer,
  },

  // ── Archived Habits ──
  archivedHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing['2xl'], marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  archivedHeaderText: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs,
    color: Colors.zinc500, letterSpacing: 1.5,
  },
  archivedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceContainerHigh, borderStyle: 'dashed',
  },
  archivedActions: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  archivedActionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Badge Detail Modal ──
  badgeModalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  badgeModalCard: {
    width: '85%', backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.lg, padding: Spacing['2xl'],
    alignItems: 'center', ...Shadows.cardShadow,
  },
  badgeModalIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
  },
  badgeModalName: {
    fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes.xl,
    color: Colors.onSurface, marginBottom: Spacing.sm,
  },
  badgeModalStatusPill: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, marginBottom: Spacing.xl,
  },
  badgeModalStatusText: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.xs, letterSpacing: 2,
  },
  badgeModalSection: {
    width: '100%', marginBottom: Spacing.lg,
  },
  badgeModalSectionLabel: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs, color: Colors.zinc500,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
  },
  badgeModalSectionValue: {
    fontFamily: Fonts.body, fontSize: FontSizes.md, color: Colors.onSurface,
  },
  badgeModalBonusValue: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.md,
  },
  badgeModalTotalRow: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: Spacing.lg, borderTopWidth: 1,
  },
  badgeModalTotalLabel: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.sm, color: Colors.zinc400,
  },
  badgeModalTotalValue: {
    fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes.lg,
  },

  // ── Edit Profile Modal ──
  editModalContainer: {
    flex: 1, backgroundColor: Colors.background,
  },
  editModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 16 : Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainerHighest,
  },
  editModalCancel: {
    fontFamily: Fonts.body, fontSize: FontSizes.md, color: Colors.zinc400,
  },
  editModalTitle: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.lg, color: Colors.onSurface,
  },
  editModalSave: {
    fontFamily: Fonts.headlineBold, fontSize: FontSizes.md, color: Colors.primaryContainer,
  },
  editModalScroll: { flex: 1 },
  editModalScrollContent: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing['2xl'],
  },
  editAvatarSection: {
    alignItems: 'center', marginBottom: Spacing['2xl'],
  },
  editAvatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 3, borderColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  editAvatarEmoji: { fontSize: 40 },
  editAvatarInitials: {
    fontFamily: Fonts.headlineExtraBold, fontSize: FontSizes['3xl'], color: Colors.primaryContainer,
  },
  editAvatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  editAvatarHint: {
    fontFamily: Fonts.body, fontSize: FontSizes.xs, color: Colors.zinc500,
  },
  editRemoveEmoji: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs, color: Colors.error, marginTop: 4,
  },
  iconPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconPickerCell: {
    width: 56, height: 56, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.zinc800,
    backgroundColor: Colors.surfaceContainer,
  },
  advancedToggle: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  advancedToggleText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.zinc600,
    letterSpacing: 1,
  },
  editField: { marginBottom: Spacing.xl },
  editFieldLabel: {
    fontFamily: Fonts.bodySemiBold, fontSize: FontSizes.xs, color: Colors.zinc500,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.sm,
  },
  editFieldInput: {
    fontFamily: Fonts.body, fontSize: FontSizes.lg, color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceContainerHighest,
  },
});
