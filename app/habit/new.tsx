import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { XP_VALUES, type XPValue, getHabitCreationXP, getLevelProgress } from '../../src/constants/xp';
import { getBadgeById, type BadgeDefinition } from '../../src/constants/badges';
import { useHabitStore } from '../../src/stores/habit-store';
import { getCurrentLocation, type LocationProofResult } from '../../src/lib/proof-service';
import { supabase } from '../../src/lib/supabase';
import XPGainedScreen from '../../src/components/XPGainedScreen';
import type { ScheduleType, ProofType } from '../../src/types/habit';

const EMOJI_OPTIONS = [
  '🎯', '🏋️', '🏃', '🚴', '🧘', '💪',
  '📚', '✍️', '🧠', '💻', '🎨', '🎵',
  '💧', '🥗', '😴', '☀️', '🌙', '🔥',
  '💰', '🙏', '❤️', '🧹', '🌱', '⭐',
] as const;

const DIFFICULTY_META: Record<XPValue, { label: string; icon: string }> = {
  5: { label: 'Easy', icon: '⚡' },
  10: { label: 'Medium', icon: '🔥' },
  15: { label: 'Hard', icon: '💀' },
  20: { label: 'Beast', icon: '☠️' },
};

const SCHEDULE_OPTIONS: { key: ScheduleType; label: string }[] = [
  { key: 'every_day', label: 'Every day' },
  { key: 'specific_days', label: 'Specific days' },
];

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS_MONDAY_FIRST = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const RADIUS_OPTIONS = [
  { label: '100m', value: 100 },
  { label: '250m', value: 250 },
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
];

export default function NewHabitScreen() {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>('🎯');
  const [xpValue, setXpValue] = useState<XPValue>(10);
  const [scheduleType, setScheduleType] = useState<ScheduleType>('every_day');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [photoProof, setPhotoProof] = useState(false);
  const [locationProof, setLocationProof] = useState(false);

  // Tracking
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [trackingUnit, setTrackingUnit] = useState('');
  const [trackingGoal, setTrackingGoal] = useState('');

  // Location proof config
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationRadius, setLocationRadius] = useState(250);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // XP screen state
  const [showXPScreen, setShowXPScreen] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [totalXPAfter, setTotalXPAfter] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<BadgeDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const habitCount = useHabitStore((s) => s.habits.length);
  const getTotalXP = useHabitStore((s) => s.getTotalXP);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const useCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);
      const loc = await getCurrentLocation();
      setLocationLat(loc.lat);
      setLocationLng(loc.lng);
      setLocationName(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to get location';
      Alert.alert('Error', msg);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);

    const schedule =
      scheduleType === 'every_day'
        ? { type: 'every_day' as const }
        : { type: 'specific_days' as const, days: selectedDays };

    let proofRequired: ProofType = 'none';
    if (photoProof && locationProof) proofRequired = 'photo_or_location';
    else if (photoProof) proofRequired = 'photo';
    else if (locationProof) proofRequired = 'location';

    // Capture count before addHabit mutates the store
    const countBeforeAdd = useHabitStore.getState().habits.length;

    const parsedGoal = trackingGoal.trim() ? Number(trackingGoal) : undefined;
    const result = await useHabitStore.getState().addHabit({
      name: name.trim(),
      icon: emoji,
      color: Colors.primaryContainer,
      xpValue,
      schedule,
      proofRequired,
      proofLocationLat: locationProof && locationLat !== null ? locationLat : undefined,
      proofLocationLng: locationProof && locationLng !== null ? locationLng : undefined,
      proofLocationRadius: locationProof && locationLat !== null ? locationRadius : undefined,
      trackingEnabled,
      trackingUnit: trackingEnabled && trackingUnit.trim() ? trackingUnit.trim() : undefined,
      trackingGoal: trackingEnabled && parsedGoal !== undefined && !isNaN(parsedGoal) ? parsedGoal : undefined,
    });

    setIsSaving(false);

    if (result) {
      // Calculate badges earned
      const badges: BadgeDefinition[] = [];
      let bonusXP = 0;

      // Starter badge: first habit ever
      if (countBeforeAdd === 0) {
        const starter = getBadgeById('starter');
        if (starter) {
          badges.push(starter);
          bonusXP += starter.xpReward;
        }
      }

      // Photogenic badge: habit with photo proof
      if (photoProof) {
        const photogenic = getBadgeById('photogenic');
        if (photogenic) {
          badges.push(photogenic);
          bonusXP += photogenic.xpReward;
        }
      }

      // LIVE badge: habit with location proof
      if (locationProof) {
        const live = getBadgeById('live');
        if (live) {
          badges.push(live);
          bonusXP += live.xpReward;
        }
      }

      // Persist badge XP to xp_events. DB trigger updates profiles.xp,
      // then fetchProfileXP() pulls the authoritative total.
      if (bonusXP > 0) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) {
          await Promise.all(
            badges.map((badge: BadgeDefinition) =>
              supabase.from('xp_events').insert({
                user_id: userId,
                event_type: 'badge_reward',
                xp_amount: badge.xpReward,
                reference_id: result.habit.id,
                description: `Badge: ${badge.name}`,
              })
            )
          );
        }
        await useHabitStore.getState().fetchProfileXP();
      }

      const totalGained = result.creationXP + bonusXP;

      setXpGained(totalGained);
      setTotalXPAfter(getTotalXP()); // reads from profiles.xp via store
      setEarnedBadges(badges);
      setShowXPScreen(true);
    } else {
      router.back();
    }
  };

  const handleXPDismiss = () => {
    setShowXPScreen(false);
    router.back();
  };

  const previewCreationXP = getHabitCreationXP(habitCount);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={22} color={Colors.zinc500} />
        </Pressable>
        <Text style={styles.headerTitle}>New Habit</Text>
        <View style={styles.xpPreview}>
          <Text style={styles.xpPreviewText}>+{previewCreationXP} XP</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Habit Identity */}
        <Text style={styles.sectionLabel}>THE RITUAL IDENTITY</Text>
        <View style={styles.inputContainer}>
          <View style={styles.emojiButton}>
            <Text style={styles.emojiButtonText}>{emoji}</Text>
          </View>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Habit name..."
            placeholderTextColor={Colors.zinc600}
            selectionColor={Colors.primaryContainer}
          />
        </View>

        {/* Emoji Picker Grid */}
        <View style={styles.emojiGrid}>
          {EMOJI_OPTIONS.map((e) => {
            const selected = e === emoji;
            return (
              <Pressable
                key={e}
                style={[styles.emojiCell, selected && styles.emojiCellSelected]}
                onPress={() => setEmoji(e)}
              >
                <Text style={styles.emojiCellText}>{e}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Difficulty Selector */}
        <Text style={styles.sectionLabel}>CELESTIAL WEIGHT</Text>
        <View style={styles.difficultyGrid}>
          {XP_VALUES.map((xp) => {
            const isSelected = xp === xpValue;
            const meta = DIFFICULTY_META[xp];
            return (
              <Pressable
                key={xp}
                style={[styles.difficultyCard, isSelected && styles.difficultyCardSelected]}
                onPress={() => setXpValue(xp)}
              >
                <Text style={styles.difficultyIcon}>{meta.icon}</Text>
                <Text style={[styles.difficultyLabel, isSelected && styles.difficultyLabelSelected]}>
                  {meta.label}
                </Text>
                <Text style={[styles.difficultyXp, isSelected && styles.difficultyXpSelected]}>
                  {xp}XP
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Schedule Section */}
        <Text style={styles.sectionLabel}>TEMPORAL SCHEDULE</Text>
        <View style={styles.segmentedControl}>
          {SCHEDULE_OPTIONS.map((opt) => {
            const isActive = opt.key === scheduleType;
            return (
              <Pressable
                key={opt.key}
                style={[styles.segment, isActive && styles.segmentActive]}
                onPress={() => setScheduleType(opt.key)}
              >
                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {scheduleType === 'specific_days' && (
          <View style={styles.dayRow}>
            {DAY_ORDER.map((day, idx) => {
              const isActive = selectedDays.includes(day);
              return (
                <Pressable
                  key={day}
                  style={[styles.dayCircle, isActive && styles.dayCircleActive]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayText, isActive && styles.dayTextActive]}>
                    {DAY_LABELS_MONDAY_FIRST[idx]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Tracking */}
        <Text style={styles.sectionLabel}>TRACK A NUMBER</Text>
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <View style={[styles.toggleIconBg, { backgroundColor: 'rgba(74,225,131,0.12)' }]}>
              <Ionicons name="stats-chart-outline" size={16} color={Colors.secondary} />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Track amount</Text>
              <Text style={styles.toggleDescription}>e.g. pushups, hours slept, km run</Text>
            </View>
          </View>
          <Pressable
            style={[styles.toggle, trackingEnabled && styles.toggleOn]}
            onPress={() => setTrackingEnabled(!trackingEnabled)}
          >
            <View style={[styles.toggleKnob, trackingEnabled && styles.toggleKnobOn]} />
          </Pressable>
        </View>

        {trackingEnabled && (
          <View style={styles.trackingConfig}>
            <View style={styles.trackingRow}>
              <View style={styles.trackingField}>
                <Text style={styles.trackingLabel}>UNIT</Text>
                <TextInput
                  style={styles.trackingInput}
                  value={trackingUnit}
                  onChangeText={setTrackingUnit}
                  placeholder="reps, hrs, km…"
                  placeholderTextColor={Colors.zinc600}
                  selectionColor={Colors.secondary}
                />
              </View>
              <View style={styles.trackingField}>
                <Text style={styles.trackingLabel}>GOAL (OPTIONAL)</Text>
                <TextInput
                  style={styles.trackingInput}
                  value={trackingGoal}
                  onChangeText={setTrackingGoal}
                  placeholder="50"
                  placeholderTextColor={Colors.zinc600}
                  keyboardType="numeric"
                  selectionColor={Colors.secondary}
                />
              </View>
            </View>
          </View>
        )}

        {/* Proof Toggles */}
        <Text style={styles.sectionLabel}>PROOF</Text>

        {/* Photo proof toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <View style={[styles.toggleIconBg, { backgroundColor: 'rgba(235,178,255,0.1)' }]}>
              <Ionicons name="camera-outline" size={16} color={Colors.tertiary} />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Photo proof</Text>
              <Text style={styles.toggleDescription}>Take a photo or upload as proof</Text>
            </View>
          </View>
          <Pressable
            style={[styles.toggle, photoProof && styles.toggleOn]}
            onPress={() => setPhotoProof(!photoProof)}
          >
            <View style={[styles.toggleKnob, photoProof && styles.toggleKnobOn]} />
          </Pressable>
        </View>
        {photoProof && (
          <View style={styles.proofBadgeHint}>
            <Text style={styles.proofBadgeHintText}>📸 Earns "Photogenic" badge (+50 XP)</Text>
          </View>
        )}

        {/* Location proof toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <View style={[styles.toggleIconBg, { backgroundColor: 'rgba(96,165,250,0.1)' }]}>
              <Ionicons name="location-outline" size={16} color="#60a5fa" />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Location proof</Text>
              <Text style={styles.toggleDescription}>Check in at a specific location</Text>
            </View>
          </View>
          <Pressable
            style={[styles.toggle, locationProof && styles.toggleOn]}
            onPress={() => setLocationProof(!locationProof)}
          >
            <View style={[styles.toggleKnob, locationProof && styles.toggleKnobOn]} />
          </Pressable>
        </View>

        {/* Location config (shown when location proof is on) */}
        {locationProof && (
          <View style={styles.locationConfig}>
            <Text style={styles.locationConfigLabel}>SET LOCATION</Text>

            {/* Use current location button */}
            <Pressable
              style={styles.useLocationButton}
              onPress={useCurrentLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <ActivityIndicator size="small" color={Colors.primaryContainer} />
              ) : (
                <>
                  <Ionicons name="locate" size={18} color={Colors.primaryContainer} />
                  <Text style={styles.useLocationText}>
                    {locationLat !== null ? 'Update to current location' : 'Use current location'}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Show selected location */}
            {locationLat !== null && (
              <View style={styles.selectedLocation}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                <Text style={styles.selectedLocationText}>
                  {locationName || `${locationLat.toFixed(4)}, ${locationLng?.toFixed(4)}`}
                </Text>
              </View>
            )}

            {/* Radius picker */}
            <Text style={styles.radiusLabel}>RADIUS</Text>
            <View style={styles.radiusRow}>
              {RADIUS_OPTIONS.map((opt) => {
                const isActive = locationRadius === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.radiusChip, isActive && styles.radiusChipActive]}
                    onPress={() => setLocationRadius(opt.value)}
                  >
                    <Text style={[styles.radiusChipText, isActive && styles.radiusChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.proofBadgeHint}>
              <Text style={styles.proofBadgeHintText}>📍 Earns "LIVE" badge (+50 XP)</Text>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed Save Button */}
      <View style={styles.saveButtonContainer}>
        <Pressable
          style={[styles.saveButton, (!name.trim() || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.onPrimaryContainer} />
          ) : (
            <Text style={styles.saveButtonText}>Add Habit</Text>
          )}
        </Pressable>
      </View>

      <XPGainedScreen
        visible={showXPScreen}
        xpGained={xpGained}
        totalXP={totalXPAfter}
        badges={earnedBadges}
        onDismiss={handleXPDismiss}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'ios' ? 56 : 36 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: FontSizes.xl, color: Colors.primaryContainer, fontFamily: Fonts.headlineBold,
  },
  xpPreview: {
    backgroundColor: 'rgba(255,140,0,0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  xpPreviewText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.headlineBold, color: Colors.primaryContainer,
  },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },

  // Section Labels
  sectionLabel: {
    fontSize: FontSizes.xs, color: Colors.zinc500, fontFamily: Fonts.bodySemiBold,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.md, marginTop: Spacing['2xl'],
  },

  // Habit Identity Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md, paddingVertical: Spacing['2xl'],
    paddingLeft: Spacing.lg, paddingRight: Spacing.md,
  },
  emojiButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm,
  },
  emojiButtonText: { fontSize: 28 },
  nameInput: {
    flex: 1, fontSize: FontSizes['2xl'], color: Colors.onSurface,
    fontFamily: Fonts.headlineBold, padding: 0,
  },

  // Difficulty Grid
  difficultyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  difficultyCard: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg,
    alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  difficultyCardSelected: {
    backgroundColor: 'rgba(255,140,0,0.1)', borderColor: Colors.primaryContainer,
    ...Shadows.streakGlow,
  },
  difficultyIcon: { fontSize: 24, marginBottom: Spacing.xs },
  difficultyLabel: {
    fontSize: FontSizes.md, color: Colors.zinc400, fontFamily: Fonts.bodySemiBold, marginBottom: 2,
  },
  difficultyLabelSelected: { color: Colors.primary },
  difficultyXp: { fontSize: FontSizes.sm, color: Colors.zinc500, fontFamily: Fonts.body },
  difficultyXpSelected: { color: Colors.primaryContainer },

  // Segmented Control
  segmentedControl: {
    flexDirection: 'row', backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm, padding: 3,
  },
  segment: {
    flex: 1, paddingVertical: Spacing.sm, alignItems: 'center',
    borderRadius: BorderRadius.sm - 2,
  },
  segmentActive: { backgroundColor: Colors.surfaceContainerHigh },
  segmentText: { fontSize: FontSizes.sm, color: Colors.zinc500, fontFamily: Fonts.bodySemiBold },
  segmentTextActive: { color: Colors.onSurface },

  // Day Circles
  dayRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: Spacing.lg, paddingHorizontal: Spacing.xs,
  },
  dayCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleActive: { backgroundColor: Colors.secondaryContainer, ...Shadows.completionGlow },
  dayText: { fontSize: FontSizes.md, color: Colors.zinc400, fontFamily: Fonts.bodySemiBold },
  dayTextActive: { color: Colors.white, fontFamily: Fonts.headlineBold },

  // Toggle Cards
  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(42,42,42,0.5)', borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginTop: Spacing.md,
  },
  toggleLeft: {
    flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md,
  },
  toggleIconBg: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  toggleInfo: { flex: 1 },
  toggleTitle: {
    fontSize: FontSizes.md, color: Colors.onSurface, fontFamily: Fonts.bodySemiBold, marginBottom: 2,
  },
  toggleDescription: { fontSize: FontSizes.sm, color: Colors.zinc500, fontFamily: Fonts.body },
  toggle: {
    width: 48, height: 24, borderRadius: 12, backgroundColor: Colors.surfaceContainerHighest,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: Colors.secondaryContainer },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white },
  toggleKnobOn: { alignSelf: 'flex-end' },

  // Proof badge hint
  proofBadgeHint: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  proofBadgeHintText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.bodySemiBold, color: Colors.tertiary,
  },

  // Location config
  locationConfig: {
    backgroundColor: 'rgba(96,165,250,0.05)',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.15)',
  },
  locationConfigLabel: {
    fontSize: FontSizes.xs, fontFamily: Fonts.bodySemiBold, color: '#60a5fa',
    letterSpacing: 1.5, marginBottom: Spacing.md,
  },
  useLocationButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.sm, paddingVertical: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderStyle: 'dashed',
  },
  useLocationText: {
    fontSize: FontSizes.md, fontFamily: Fonts.bodySemiBold, color: Colors.primaryContainer,
  },
  selectedLocation: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.md, paddingVertical: Spacing.xs,
  },
  selectedLocationText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.bodySemiBold, color: Colors.secondary,
  },
  radiusLabel: {
    fontSize: FontSizes.xs, fontFamily: Fonts.bodySemiBold, color: Colors.zinc500,
    letterSpacing: 1.5, marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  radiusRow: {
    flexDirection: 'row', gap: Spacing.sm,
  },
  radiusChip: {
    flex: 1, paddingVertical: Spacing.sm, alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: 'transparent',
  },
  radiusChipActive: {
    borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.15)',
  },
  radiusChipText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.bodySemiBold, color: Colors.zinc400,
  },
  radiusChipTextActive: { color: '#60a5fa' },

  // Emoji grid
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  emojiCell: {
    width: 48, height: 48, borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  emojiCellSelected: {
    borderColor: Colors.primaryContainer,
    backgroundColor: 'rgba(255,140,0,0.1)',
  },
  emojiCellText: { fontSize: 24 },

  // Tracking config
  trackingConfig: {
    backgroundColor: 'rgba(74,225,131,0.05)',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(74,225,131,0.15)',
  },
  trackingRow: { flexDirection: 'row', gap: Spacing.md },
  trackingField: { flex: 1 },
  trackingLabel: {
    fontSize: FontSizes.xs, fontFamily: Fonts.bodySemiBold, color: Colors.zinc500,
    letterSpacing: 1.5, marginBottom: Spacing.sm,
  },
  trackingInput: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
    fontFamily: Fonts.bodySemiBold,
  },

  // Save Button
  saveButtonContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    backgroundColor: Colors.background,
  },
  saveButton: {
    backgroundColor: Colors.primaryContainer, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xl, alignItems: 'center', justifyContent: 'center',
    ...Shadows.fabShadow,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: {
    fontSize: FontSizes.lg, color: Colors.onPrimaryContainer, fontFamily: Fonts.headlineExtraBold,
  },
});
