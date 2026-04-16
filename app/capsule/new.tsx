import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { format, addDays } from 'date-fns';
import { useAuthStore } from '../../src/stores/auth-store';
import { useCapsuleStore } from '../../src/stores/capsule-store';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
} from '../../src/constants/theme';

const MIN_DATE = addDays(new Date(), 1);

export default function ComposeCapsuleScreen() {
  const user = useAuthStore((s) => s.user);
  const addCapsule = useCapsuleStore((s) => s.addCapsule);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [deliverOn, setDeliverOn] = useState<Date>(addDays(new Date(), 30));
  const [photos, setPhotos] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(deliverOn);
  const [saving, setSaving] = useState(false);

  // Optional exact-time delivery
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [deliverTime, setDeliverTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState<Date>(deliverTime);

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 6,
      });
      if (!result.canceled) {
        setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 6));
      }
    } catch (err) {
      console.error('Pick photos error:', err);
    }
  };

  const takeLivePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera access needed', 'Enable camera access in Settings to take a live photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled) {
        setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 6));
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const addPhotoPrompt = () => {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: takeLivePhoto },
      { text: 'Choose from library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const doSeal = async (deliverAtIso: string | null) => {
    if (!user) return;
    try {
      setSaving(true);
      const { reward } = await addCapsule({
        userId: user.id,
        title: title.trim(),
        message: message.trim(),
        deliverOn: format(deliverOn, 'yyyy-MM-dd'),
        deliverAt: deliverAtIso,
        localPhotoUris: photos.length ? photos : undefined,
      });

      // XP celebration
      const lines = [`+${reward.baseXP} XP · capsule sealed`];
      if (reward.photoBonus > 0) lines.push(`+${reward.photoBonus} XP · photo bonus`);
      if (reward.earnedPostman) lines.push(`+${reward.postmanBonus} XP · 🏅 Postman badge`);
      Alert.alert(
        `+${reward.totalXP} XP`,
        lines.join('\n'),
        [{ text: 'Nice', onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save capsule.');
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!user) return;
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing details', 'Add a title and a message.');
      return;
    }
    // If exact-time delivery is enabled, combine the chosen date + time
    // and reject anything that isn't in the future.
    let deliverAtIso: string | null = null;
    if (timeEnabled) {
      const combined = new Date(deliverOn);
      combined.setHours(deliverTime.getHours(), deliverTime.getMinutes(), 0, 0);
      if (combined.getTime() <= Date.now()) {
        Alert.alert('Time in the past', 'Pick a future time for delivery.');
        return;
      }
      deliverAtIso = combined.toISOString();
    }

    const whenLabel = timeEnabled
      ? format(
          (() => {
            const d = new Date(deliverOn);
            d.setHours(deliverTime.getHours(), deliverTime.getMinutes(), 0, 0);
            return d;
          })(),
          "EEEE, MMM d, yyyy 'at' h:mm a",
        )
      : format(deliverOn, 'EEEE, MMM d, yyyy');

    Alert.alert(
      'Seal this capsule?',
      `"${title.trim()}" will be locked until ${whenLabel}. You won't be able to read or edit it before then.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Seal it', style: 'default', onPress: () => doSeal(deliverAtIso) },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()} disabled={saving}>
          <Ionicons name="close" size={24} color={Colors.zinc400} />
        </Pressable>
        <Text style={styles.headerTitle}>New Capsule</Text>
        <Pressable
          style={[styles.saveBtn, (!title.trim() || !message.trim() || saving) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!title.trim() || !message.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.onPrimaryContainer} />
          ) : (
            <Text style={styles.saveBtnText}>Seal</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>TITLE</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="A letter to my future self"
          placeholderTextColor={Colors.zinc500}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        <Text style={styles.sectionLabel}>MESSAGE</Text>
        <TextInput
          style={styles.messageInput}
          placeholder="What do you want to remember? What's on your mind today?"
          placeholderTextColor={Colors.zinc500}
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.sectionLabel}>DELIVERY DATE</Text>
        <Pressable
          style={styles.dateRow}
          onPress={() => {
            setTempDate(deliverOn);
            setShowPicker(true);
          }}
        >
          <Ionicons name="calendar-outline" size={20} color={Colors.primaryContainer} />
          <Text style={styles.dateText}>{format(deliverOn, 'EEEE, MMMM d, yyyy')}</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.zinc500} />
        </Pressable>

        {/* Exact time toggle */}
        <Pressable
          style={styles.timeToggleRow}
          onPress={() => setTimeEnabled((v) => !v)}
        >
          <Ionicons name="time-outline" size={20} color={Colors.primaryContainer} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dateText}>Deliver at a specific time</Text>
            <Text style={styles.timeToggleSub}>
              {timeEnabled
                ? `Unlocks at ${format(deliverTime, 'h:mm a')}`
                : 'Otherwise unlocks any time that day'}
            </Text>
          </View>
          <View style={[styles.toggle, timeEnabled && styles.toggleOn]}>
            <View style={[styles.toggleKnob, timeEnabled && styles.toggleKnobOn]} />
          </View>
        </Pressable>
        {timeEnabled && (
          <Pressable
            style={styles.timePickRow}
            onPress={() => {
              setTempTime(deliverTime);
              setShowTimePicker(true);
            }}
          >
            <Text style={styles.timePickText}>{format(deliverTime, 'h:mm a')}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.zinc500} />
          </Pressable>
        )}

        <Text style={styles.sectionLabel}>PHOTOS (OPTIONAL)</Text>
        <View style={styles.photosGrid}>
          {photos.map((uri) => (
            <View key={uri} style={styles.photoTile}>
              <Image source={{ uri }} style={styles.photoImg} />
              <Pressable style={styles.photoRemove} onPress={() => removePhoto(uri)}>
                <Ionicons name="close" size={14} color={Colors.white} />
              </Pressable>
            </View>
          ))}
          {photos.length < 6 && (
            <Pressable style={styles.addPhoto} onPress={addPhotoPrompt}>
              <Ionicons name="add" size={28} color={Colors.zinc500} />
              <Text style={styles.addPhotoText}>Add</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.noteBox}>
          <Ionicons name="lock-closed" size={16} color={Colors.primaryContainer} />
          <Text style={styles.noteText}>
            Sealed until {format(deliverOn, 'MMM d, yyyy')}. You won't be able to preview it before then.
          </Text>
        </View>
      </ScrollView>

      {/* Date picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowPicker(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Delivery date</Text>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              minimumDate={MIN_DATE}
              onChange={(_, d) => {
                if (d) setTempDate(d);
                if (Platform.OS !== 'ios') {
                  if (d) setDeliverOn(d);
                  setShowPicker(false);
                }
              }}
              themeVariant="dark"
            />
            {Platform.OS === 'ios' && (
              <View style={styles.pickerActions}>
                <Pressable style={styles.pickerCancel} onPress={() => setShowPicker(false)}>
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.pickerConfirm}
                  onPress={() => {
                    setDeliverOn(tempDate);
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.pickerConfirmText}>Done</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Time picker modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowTimePicker(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Delivery time</Text>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
              onChange={(_, d) => {
                if (d) setTempTime(d);
                if (Platform.OS !== 'ios') {
                  if (d) setDeliverTime(d);
                  setShowTimePicker(false);
                }
              }}
              themeVariant="dark"
            />
            {Platform.OS === 'ios' && (
              <View style={styles.pickerActions}>
                <Pressable style={styles.pickerCancel} onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.pickerConfirm}
                  onPress={() => {
                    setDeliverTime(tempTime);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.pickerConfirmText}>Done</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'ios' ? 56 : 36 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.headlineBold, fontSize: FontSizes.xl, color: Colors.onSurface },
  saveBtn: {
    paddingHorizontal: Spacing.lg,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onPrimaryContainer,
  },
  scrollContent: { padding: Spacing.xl, paddingBottom: 120 },
  sectionLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    letterSpacing: 2,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.sm,
  },
  titleInput: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes['2xl'],
    color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  messageInput: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    minHeight: 180,
    lineHeight: 22,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  dateText: {
    flex: 1,
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
  },
  timeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  timeToggleSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surfaceContainerHigh,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: Colors.primaryContainer,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.zinc400,
  },
  toggleKnobOn: {
    backgroundColor: Colors.onPrimaryContainer,
    alignSelf: 'flex-end',
  },
  timePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  timePickText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.lg,
    color: Colors.primaryContainer,
  },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoTile: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.zinc500,
    marginTop: 2,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing['2xl'],
    padding: Spacing.md,
    backgroundColor: `${Colors.primaryContainer}14` as any,
    borderRadius: BorderRadius.sm,
  },
  noteText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc400,
    lineHeight: 18,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  pickerTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.lg,
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  pickerCancel: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  pickerCancelText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.zinc500,
  },
  pickerConfirm: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.sm,
  },
  pickerConfirmText: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onPrimaryContainer,
  },
});
