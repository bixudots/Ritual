import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius } from '../src/constants/theme';
import { GOAL_CATEGORIES, type HabitPreset, type GoalCategory } from '../src/constants/habit-presets';
import { useHabitStore } from '../src/stores/habit-store';
import { isPresetAlreadyCovered } from '../src/lib/habit-dedup';

type Step = 'goals' | 'presets';

function presetKey(goalId: string, idx: number) {
  return `${goalId}:${idx}`;
}

export default function OnboardingScreen() {
  const addHabit = useHabitStore((s) => s.addHabit);
  const existingHabits = useHabitStore((s) => s.habits);

  const [step, setStep] = useState<Step>('goals');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Names the user already tracks — used to hide duplicate/similar presets
  // so the library never re-suggests something that's already in their list.
  const existingNames = useMemo(
    () => existingHabits.filter((h) => !h.isArchived).map((h) => h.name),
    [existingHabits],
  );

  // Goals filtered to only the ones the user picked. Each goal's presets
  // are further filtered to drop anything similar to a habit they already
  // have — no duplicates, no confusingly-close names.
  const visibleGoals = useMemo(() => {
    return GOAL_CATEGORIES
      .filter((g) => selectedGoals.includes(g.id))
      .map((g) => ({
        ...g,
        presets: g.presets.filter(
          (p) => !isPresetAlreadyCovered(p.name, existingNames),
        ),
      }))
      // Hide a whole goal if every preset in it got filtered out.
      .filter((g) => g.presets.length > 0);
  }, [selectedGoals, existingNames]);

  const toggleGoal = (id: string) => {
    Haptics.selectionAsync();
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const togglePreset = (goalId: string, idx: number) => {
    Haptics.selectionAsync();
    const key = presetKey(goalId, idx);
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const goNext = () => {
    if (selectedGoals.length === 0) {
      Alert.alert('Pick at least one', 'Choose the areas you want to improve.');
      return;
    }
    // Pre-select every preset under each chosen goal so the user just
    // has to un-tick what they don't want.
    const preselected = new Set<string>();
    visibleGoals.forEach((g) => {
      g.presets.forEach((_, i) => preselected.add(presetKey(g.id, i)));
    });
    // Only preselect the first time the user lands on this step — don't
    // clobber manual edits if they bounce back.
    if (selectedPresets.size === 0) {
      setSelectedPresets(preselected);
    }
    setStep('presets');
  };

  const goBack = () => setStep('goals');

  const skip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const createSelected = async () => {
    if (selectedPresets.size === 0) {
      Alert.alert('Nothing to create', 'Select at least one habit, or skip.');
      return;
    }

    setSaving(true);
    try {
      // Collect presets in stable order. Iterate `visibleGoals` (not the raw
      // catalog) so anything already covered by an existing habit — even if
      // it was somehow ticked — never gets created.
      const toCreate: HabitPreset[] = [];
      visibleGoals.forEach((g) => {
        g.presets.forEach((p, i) => {
          if (selectedPresets.has(presetKey(g.id, i))) toCreate.push(p);
        });
      });

      // Final safety net: drop anything whose name became similar to an
      // existing habit while the sheet was open.
      const safeToCreate = toCreate.filter(
        (p) => !isPresetAlreadyCovered(p.name, existingNames),
      );
      if (safeToCreate.length === 0) {
        Alert.alert(
          'Nothing new to add',
          'All the habits you picked overlap with ones you already have.',
        );
        setSaving(false);
        return;
      }

      // Create sequentially so sortOrder stays deterministic and
      // creation XP events fire in order. `addHabit` always appends —
      // existing habits are never replaced or overwritten.
      for (const p of safeToCreate) {
        await addHabit({
          name: p.name,
          icon: p.icon,
          color: Colors.primaryContainer,
          xpValue: p.xpValue,
          schedule: p.schedule,
          proofRequired: p.proofRequired,
          trackingEnabled: p.trackingEnabled ?? false,
          trackingUnit: p.trackingUnit,
          trackingGoal: p.trackingGoal,
          reminderTime: null,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        `${safeToCreate.length} habit${safeToCreate.length === 1 ? '' : 's'} added`,
        'You can edit, remove, or add more any time.',
        [
          {
            text: 'Let\u2019s go',
            onPress: () =>
              router.canGoBack() ? router.back() : router.replace('/(tabs)'),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to create habits.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={step === 'presets' ? goBack : skip}
          hitSlop={12}
          style={styles.headerBtn}
        >
          <Ionicons
            name={step === 'presets' ? 'chevron-back' : 'close'}
            size={22}
            color={Colors.onSurface}
          />
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === 'goals' ? 'What do you want?' : 'Pick your starters'}
        </Text>
        <Pressable onPress={skip} hitSlop={12} style={styles.headerBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Step: Goals */}
      {step === 'goals' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeIn.duration(400)}>
            <Text style={styles.intro}>
              Pick the areas you want to improve. We'll suggest habits you can start with right away.
            </Text>
          </Animated.View>

          <View style={styles.goalGrid}>
            {GOAL_CATEGORIES.map((g, i) => {
              const picked = selectedGoals.includes(g.id);
              return (
                <Animated.View
                  key={g.id}
                  entering={FadeInDown.duration(400).delay(i * 40)}
                  style={styles.goalCellWrap}
                >
                  <Pressable
                    style={[
                      styles.goalCell,
                      picked && {
                        borderColor: g.color,
                        backgroundColor: `${g.color}14`,
                      },
                    ]}
                    onPress={() => toggleGoal(g.id)}
                  >
                    <Text style={styles.goalEmoji}>{g.emoji}</Text>
                    <Text style={styles.goalTitle}>{g.title}</Text>
                    <Text style={styles.goalTagline}>{g.tagline}</Text>
                    {picked && (
                      <View style={[styles.goalCheck, { backgroundColor: g.color }]}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Step: Presets */}
      {step === 'presets' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.intro}>
            Tap any habit to toggle it. You'll still get the creation XP for each one you keep.
          </Text>

          {visibleGoals.length === 0 && (
            <View style={styles.emptyFiltered}>
              <Text style={styles.emptyFilteredEmoji}>✨</Text>
              <Text style={styles.emptyFilteredTitle}>You're already on it</Text>
              <Text style={styles.emptyFilteredSub}>
                Every starter in the areas you picked overlaps with habits you
                already track. Try picking a different area, or create a
                custom one from scratch.
              </Text>
            </View>
          )}

          {visibleGoals.map((g) => (
            <View key={g.id} style={styles.presetSection}>
              <View style={styles.presetSectionHeader}>
                <Text style={styles.presetSectionEmoji}>{g.emoji}</Text>
                <Text style={styles.presetSectionTitle}>{g.title}</Text>
              </View>
              {g.presets.map((p, i) => {
                const key = presetKey(g.id, i);
                const picked = selectedPresets.has(key);
                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.presetRow,
                      picked && {
                        borderColor: g.color,
                        backgroundColor: `${g.color}10`,
                      },
                    ]}
                    onPress={() => togglePreset(g.id, i)}
                  >
                    <Text style={styles.presetEmoji}>{p.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetName}>{p.name}</Text>
                      <Text style={styles.presetMeta}>
                        {scheduleLabel(p)} · +{p.xpValue} XP each
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.presetCheckbox,
                        picked && { backgroundColor: g.color, borderColor: g.color },
                      ]}
                    >
                      {picked && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Footer CTA */}
      <View style={styles.footer}>
        {step === 'goals' ? (
          <Pressable
            style={[
              styles.primaryBtn,
              selectedGoals.length === 0 && styles.primaryBtnDisabled,
            ]}
            disabled={selectedGoals.length === 0}
            onPress={goNext}
          >
            <Text style={styles.primaryBtnText}>
              {selectedGoals.length === 0
                ? 'Pick at least one'
                : `Continue · ${selectedGoals.length} selected`}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            disabled={saving}
            onPress={createSelected}
          >
            {saving ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>
                Create {selectedPresets.size} habit{selectedPresets.size === 1 ? '' : 's'}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function scheduleLabel(p: HabitPreset): string {
  if (p.schedule.type === 'every_day') return 'Every day';
  const days = p.schedule.days ?? [];
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return days.map((d) => labels[d]).join(' · ');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingBottom: Spacing.md,
  },
  headerBtn: { minWidth: 44, alignItems: 'center' },
  headerTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.lg,
    color: Colors.onSurface,
    flex: 1,
    textAlign: 'center',
  },
  skipText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
  },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  intro: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.zinc400,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },

  // Goal grid
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
  },
  goalCellWrap: { width: '50%', padding: Spacing.xs },
  goalCell: {
    borderWidth: 1.5,
    borderColor: Colors.zinc800,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 120,
  },
  goalEmoji: { fontSize: 28, marginBottom: Spacing.xs },
  goalTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  goalTagline: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    lineHeight: 16,
  },
  goalCheck: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Preset list
  presetSection: { marginBottom: Spacing.lg },
  presetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  presetSectionEmoji: { fontSize: 20 },
  presetSectionTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
  },
  emptyFiltered: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
  },
  emptyFilteredEmoji: { fontSize: 40, marginBottom: Spacing.md },
  emptyFilteredTitle: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes.xl,
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  emptyFilteredSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
    textAlign: 'center',
    lineHeight: 20,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.zinc800,
    backgroundColor: Colors.surfaceContainer,
    marginBottom: Spacing.sm,
  },
  presetEmoji: { fontSize: 22 },
  presetName: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
  },
  presetMeta: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    marginTop: 2,
  },
  presetCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.zinc600,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Footer
  footer: {
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.zinc800,
    backgroundColor: Colors.background,
  },
  primaryBtn: {
    backgroundColor: Colors.primaryContainer,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onPrimary,
  },
});
