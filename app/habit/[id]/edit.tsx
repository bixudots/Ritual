import React, { useState, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius, Shadows } from '../../../src/constants/theme';
import { XP_VALUES, type XPValue } from '../../../src/constants/xp';
import { useHabitStore } from '../../../src/stores/habit-store';
import { getCurrentLocation } from '../../../src/lib/proof-service';
import type { ScheduleType, ProofType } from '../../../src/types/habit';
import { scheduleHabitReminder, cancelHabitReminder, requestNotificationPermission } from '../../../src/lib/notifications';

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

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const getHabitById = useHabitStore((s) => s.getHabitById);
  const updateHabit = useHabitStore((s) => s.updateHabit);
  const deleteHabit = useHabitStore((s) => s.deleteHabit);
  const archiveHabit = useHabitStore((s) => s.archiveHabit);
  const habit = getHabitById(id);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>('🎯');
  const [xpValue, setXpValue] = useState<XPValue>(10);
  const [scheduleType, setScheduleType] = useState<ScheduleType>('every_day');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [photoProof, setPhotoProof] = useState(false);
  const [locationProof, setLocationProof] = useState(false);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationRadius, setLocationRadius] = useState(250);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [trackingUnit, setTrackingUnit] = useState('');
  const [trackingGoal, setTrackingGoal] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);
  const [reminderMinute, setReminderMinute] = useState(0);

  useEffect(() => {
    if (!habit) return;
    setName(habit.name);
    setEmoji(habit.icon);
    setXpValue(habit.xpValue as XPValue);
    setScheduleType(habit.schedule.type);
    setSelectedDays(habit.schedule.days ?? []);
    setPhotoProof(habit.proofRequired === 'photo' || habit.proofRequired === 'photo_or_location');
    setLocationProof(habit.proofRequired === 'location' || habit.proofRequired === 'photo_or_location');
    setLocationLat(habit.proofLocationLat ?? null);
    setLocationLng(habit.proofLocationLng ?? null);
    setLocationRadius(habit.proofLocationRadius ?? 250);
    setTrackingEnabled(habit.trackingEnabled ?? false);
    setTrackingUnit(habit.trackingUnit ?? '');
    setTrackingGoal(habit.trackingGoal != null ? String(habit.trackingGoal) : '');
    if (habit.reminderTime) {
      setReminderEnabled(true);
      const [h, m] = habit.reminderTime.split(':').map(Number);
      setReminderHour(h);
      setReminderMinute(m);
    } else {
      setReminderEnabled(false);
    }
  }, [habit]);

  if (!habit) {
    return (
      <View style={styles.container}>
        <Text style={{ color: Colors.zinc500, textAlign: 'center', marginTop: 100 }}>
          Habit not found
        </Text>
      </View>
    );
  }

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const useCurrentLocationHandler = async () => {
    try {
      setIsGettingLocation(true);
      const loc = await getCurrentLocation();
      setLocationLat(loc.lat);
      setLocationLng(loc.lng);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to get location';
      Alert.alert('Error', msg);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const schedule =
      scheduleType === 'every_day'
        ? { type: 'every_day' as const }
        : { type: 'specific_days' as const, days: selectedDays };

    let proofRequired: ProofType = 'none';
    if (photoProof && locationProof) proofRequired = 'photo_or_location';
    else if (photoProof) proofRequired = 'photo';
    else if (locationProof) proofRequired = 'location';

    const timeStr = reminderEnabled
      ? `${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}`
      : null;

    const parsedGoal = trackingGoal.trim() ? Number(trackingGoal) : undefined;
    updateHabit(id, {
      name: name.trim(),
      icon: emoji,
      xpValue,
      schedule,
      proofRequired,
      proofLocationLat: locationProof && locationLat !== null ? locationLat : undefined,
      proofLocationLng: locationProof && locationLng !== null ? locationLng : undefined,
      proofLocationRadius: locationProof && locationLat !== null ? locationRadius : undefined,
      trackingEnabled,
      trackingUnit: trackingEnabled && trackingUnit.trim() ? trackingUnit.trim() : undefined,
      trackingGoal: trackingEnabled && parsedGoal !== undefined && !isNaN(parsedGoal) ? parsedGoal : undefined,
      reminderTime: timeStr,
    });

    // Schedule or cancel notification
    if (reminderEnabled && timeStr) {
      const granted = await requestNotificationPermission();
      if (granted) {
        const days = scheduleType === 'specific_days' ? selectedDays : undefined;
        await scheduleHabitReminder(id, name.trim(), emoji, timeStr, days);
      }
    } else {
      await cancelHabitReminder(id);
    }

    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove Habit',
      `What would you like to do with "${habit.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive (keep XP)',
          onPress: () => {
            archiveHabit(id);
            router.back();
          },
        },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'This will permanently delete the habit and all its XP. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteHabit(id);
                    router.back();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.zinc400} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Habit</Text>
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color={Colors.error} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name + Emoji */}
        <Text style={styles.sectionLabel}>NAME</Text>
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

        {/* XP */}
        <Text style={styles.sectionLabel}>DIFFICULTY</Text>
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

        {/* Schedule */}
        <Text style={styles.sectionLabel}>SCHEDULE</Text>
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

        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <View style={[styles.toggleIconBg, { backgroundColor: 'rgba(235,178,255,0.1)' }]}>
              <Ionicons name="camera-outline" size={16} color={Colors.tertiary} />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Photo proof</Text>
              <Text style={styles.toggleDescription}>Take a live photo as proof</Text>
            </View>
          </View>
          <Pressable
            style={[styles.toggle, photoProof && styles.toggleOn]}
            onPress={() => setPhotoProof(!photoProof)}
          >
            <View style={[styles.toggleKnob, photoProof && styles.toggleKnobOn]} />
          </Pressable>
        </View>

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

        {locationProof && (
          <View style={styles.locationConfig}>
            <Text style={styles.locationConfigLabel}>SET LOCATION</Text>
            <Pressable
              style={styles.useLocationButton}
              onPress={useCurrentLocationHandler}
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

            {locationLat !== null && (
              <View style={styles.selectedLocation}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                <Text style={styles.selectedLocationText}>
                  {locationLat.toFixed(4)}, {locationLng?.toFixed(4)}
                </Text>
              </View>
            )}

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
          </View>
        )}

        {/* Reminder */}
        <Text style={styles.sectionLabel}>REMIND ME</Text>
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <View style={[styles.toggleIconBg, { backgroundColor: 'rgba(255,140,0,0.12)' }]}>
              <Ionicons name="notifications-outline" size={16} color={Colors.primaryContainer} />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Daily reminder</Text>
              <Text style={styles.toggleDescription}>Get nudged if you haven't done it yet</Text>
            </View>
          </View>
          <Pressable
            style={[styles.toggle, reminderEnabled && styles.toggleOn]}
            onPress={() => setReminderEnabled(!reminderEnabled)}
          >
            <View style={[styles.toggleKnob, reminderEnabled && styles.toggleKnobOn]} />
          </Pressable>
        </View>

        {reminderEnabled && (
          <View style={styles.reminderTimeRow}>
            <Text style={styles.reminderTimeLabel}>REMIND AT</Text>
            <View style={styles.reminderTimePicker}>
              <Pressable
                style={styles.reminderTimeBtn}
                onPress={() => setReminderHour(h => (h + 1) % 24)}
                onLongPress={() => setReminderHour(h => (h - 1 + 24) % 24)}
              >
                <Text style={styles.reminderTimeDigit}>{String(reminderHour).padStart(2, '0')}</Text>
              </Pressable>
              <Text style={styles.reminderTimeColon}>:</Text>
              <Pressable
                style={styles.reminderTimeBtn}
                onPress={() => setReminderMinute(m => (m + 15) % 60)}
                onLongPress={() => setReminderMinute(m => (m - 15 + 60) % 60)}
              >
                <Text style={styles.reminderTimeDigit}>{String(reminderMinute).padStart(2, '0')}</Text>
              </Pressable>
              <Text style={styles.reminderTimeAmPm}>
                {reminderHour < 12 ? 'AM' : 'PM'}
              </Text>
            </View>
            <Text style={styles.reminderTimeHint}>Tap to change · hold to go back</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Save button */}
      <View style={styles.saveButtonContainer}>
        <Pressable
          style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!name.trim()}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </Pressable>
      </View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'ios' ? 56 : 36 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.headlineBold, fontSize: FontSizes.xl, color: Colors.primaryContainer },
  deleteButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  sectionLabel: {
    fontSize: FontSizes.xs, color: Colors.zinc500, fontFamily: Fonts.bodySemiBold,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.md, marginTop: Spacing['2xl'],
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.xl, paddingLeft: Spacing.lg, paddingRight: Spacing.md,
  },
  emojiButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm,
  },
  emojiButtonText: { fontSize: 28 },
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
  nameInput: {
    flex: 1, fontSize: FontSizes['2xl'], color: Colors.onSurface, fontFamily: Fonts.headlineBold, padding: 0,
  },
  difficultyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  difficultyCard: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg,
    alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  difficultyCardSelected: {
    backgroundColor: 'rgba(255,140,0,0.1)', borderColor: Colors.primaryContainer,
  },
  difficultyIcon: { fontSize: 24, marginBottom: Spacing.xs },
  difficultyLabel: { fontSize: FontSizes.md, color: Colors.zinc400, fontFamily: Fonts.bodySemiBold, marginBottom: 2 },
  difficultyLabelSelected: { color: Colors.primary },
  difficultyXp: { fontSize: FontSizes.sm, color: Colors.zinc500, fontFamily: Fonts.body },
  difficultyXpSelected: { color: Colors.primaryContainer },
  segmentedControl: {
    flexDirection: 'row', backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm, padding: 3,
  },
  segment: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.sm - 2 },
  segmentActive: { backgroundColor: Colors.surfaceContainerHigh },
  segmentText: { fontSize: FontSizes.sm, color: Colors.zinc500, fontFamily: Fonts.bodySemiBold },
  segmentTextActive: { color: Colors.onSurface },
  dayRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg, paddingHorizontal: Spacing.xs,
  },
  dayCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleActive: { backgroundColor: Colors.secondaryContainer },
  dayText: { fontSize: FontSizes.md, color: Colors.zinc400, fontFamily: Fonts.bodySemiBold },
  dayTextActive: { color: Colors.white, fontFamily: Fonts.headlineBold },
  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(42,42,42,0.5)', borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginTop: Spacing.md,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  toggleIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toggleInfo: { flex: 1 },
  toggleTitle: { fontSize: FontSizes.md, color: Colors.onSurface, fontFamily: Fonts.bodySemiBold, marginBottom: 2 },
  toggleDescription: { fontSize: FontSizes.sm, color: Colors.zinc500, fontFamily: Fonts.body },
  toggle: {
    width: 48, height: 24, borderRadius: 12, backgroundColor: Colors.surfaceContainerHighest,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: Colors.secondaryContainer },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white },
  toggleKnobOn: { alignSelf: 'flex-end' },
  saveButtonContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    backgroundColor: Colors.background,
  },
  saveButton: {
    backgroundColor: Colors.primaryContainer, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xl, alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: FontSizes.lg, color: Colors.onPrimaryContainer, fontFamily: Fonts.headlineExtraBold },

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

  // Reminder
  reminderTimeRow: {
    backgroundColor: 'rgba(255,140,0,0.05)',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.15)',
    alignItems: 'center' as const,
  },
  reminderTimeLabel: {
    fontSize: FontSizes.xs, fontFamily: Fonts.bodySemiBold, color: Colors.primaryContainer,
    letterSpacing: 2, marginBottom: Spacing.md,
  },
  reminderTimePicker: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.xs,
  },
  reminderTimeBtn: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    minWidth: 64,
    alignItems: 'center' as const,
  },
  reminderTimeDigit: {
    fontSize: FontSizes['2xl'], fontFamily: Fonts.headlineExtraBold, color: Colors.onSurface,
  },
  reminderTimeColon: {
    fontSize: FontSizes['2xl'], fontFamily: Fonts.headlineExtraBold, color: Colors.zinc500,
  },
  reminderTimeAmPm: {
    fontSize: FontSizes.md, fontFamily: Fonts.headlineBold, color: Colors.primaryContainer,
    marginLeft: Spacing.sm,
  },
  reminderTimeHint: {
    fontSize: FontSizes.xs, fontFamily: Fonts.body, color: Colors.zinc600, marginTop: Spacing.sm,
  },
});
