import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
} from '../constants/theme';
import { saveProofToLog, type LocationProofResult } from '../lib/proof-service';
import { useHabitStore } from '../stores/habit-store';
import PhotoProofCapture from './PhotoProofCapture';
import LocationProofCapture from './LocationProofCapture';
import type { Habit, HabitLog } from '../types/habit';

type ProofStage = 'menu' | 'photo' | 'location';

interface ProofSubmissionModalProps {
  visible: boolean;
  habit: Habit;
  habitLog?: HabitLog; // optional — if missing, we're in "complete with proof" mode
  userId: string;
  dateStr?: string; // required when habitLog is missing (for creating a new log)
  onClose: () => void;
  onProofSubmitted: () => void;
}

export default function ProofSubmissionModal({
  visible,
  habit,
  habitLog,
  userId,
  dateStr,
  onClose,
  onProofSubmitted,
}: ProofSubmissionModalProps) {
  const [stage, setStage] = useState<ProofStage>('menu');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<LocationProofResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const completeHabitWithProof = useHabitStore((s) => s.completeHabitWithProof);

  // "complete with proof" mode: no log yet, user must provide proof to complete
  const isCompleteMode = !habitLog;

  const needsPhoto = habit.proofRequired === 'photo' || habit.proofRequired === 'photo_or_location';
  const needsLocation = habit.proofRequired === 'location' || habit.proofRequired === 'photo_or_location';
  const requiresBoth = habit.proofRequired === 'photo_or_location';

  const handlePhotoCapture = (url: string) => {
    setPhotoUrl(url);
    if (needsLocation && !requiresBoth) {
      setStage('menu');
    } else if (requiresBoth && !locationData) {
      setStage('location');
    } else {
      submitProof(url, locationData);
    }
  };

  const handleLocationCapture = (location: LocationProofResult) => {
    setLocationData(location);
    if (requiresBoth && !photoUrl) {
      setStage('menu');
    } else if (needsPhoto && !photoUrl) {
      setStage('photo');
    } else {
      submitProof(photoUrl, location);
    }
  };

  const submitProof = async (photo: string | null, location: LocationProofResult | null) => {
    try {
      setIsSaving(true);

      if (isCompleteMode && dateStr) {
        // Complete-with-proof mode: create log + proof in one shot
        await completeHabitWithProof(
          habit.id,
          dateStr,
          photo ?? undefined,
          location?.lat,
          location?.lng
        );
      } else if (habitLog) {
        // Existing log: just attach proof
        await saveProofToLog(
          habitLog.id,
          photo ?? undefined,
          location?.lat,
          location?.lng
        );
      }

      onProofSubmitted();
      resetModal();
    } catch (error) {
      console.error('Proof submission error:', error);
      Alert.alert('Error', 'Failed to submit proof. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetModal = () => {
    setStage('menu');
    setPhotoUrl(null);
    setLocationData(null);
    onClose();
  };

  if (stage === 'photo') {
    return (
      <Modal visible={visible} animationType="slide">
        <PhotoProofCapture
          habitId={habit.id}
          logDate={habitLog?.loggedDate ?? dateStr ?? ''}
          userId={userId}
          onPhotoCapture={handlePhotoCapture}
          onCancel={() => setStage('menu')}
        />
      </Modal>
    );
  }

  if (stage === 'location') {
    return (
      <Modal visible={visible} animationType="slide">
        <LocationProofCapture
          habitId={habit.id}
          requiredLat={habit.proofLocationLat}
          requiredLng={habit.proofLocationLng}
          radiusMeters={habit.proofLocationRadius}
          onLocationCapture={handleLocationCapture}
          onCancel={() => setStage('menu')}
        />
      </Modal>
    );
  }

  // Menu stage
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isCompleteMode ? 'Prove It' : 'Submit Proof'}</Text>
            <Pressable onPress={resetModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.zinc400} />
            </Pressable>
          </View>

          {/* Proof options */}
          <View style={styles.optionsContainer}>
            {/* Photo proof option */}
            {needsPhoto && (
              <Pressable
                style={styles.optionCard}
                onPress={() => setStage('photo')}
              >
                <View style={styles.optionIconBg}>
                  {photoUrl ? (
                    <>
                      <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={28} color={Colors.secondary} />
                      </View>
                    </>
                  ) : (
                    <Ionicons
                      name="camera-outline"
                      size={40}
                      color={Colors.tertiary}
                    />
                  )}
                </View>
                <Text style={styles.optionTitle}>Photo Proof</Text>
                <Text style={styles.optionDescription}>
                  {photoUrl ? 'Photo captured' : 'Take or upload a photo'}
                </Text>
              </Pressable>
            )}

            {/* Location proof option */}
            {needsLocation && (
              <Pressable
                style={styles.optionCard}
                onPress={() => setStage('location')}
              >
                <View style={[styles.optionIconBg, { backgroundColor: 'rgba(96,165,250,0.15)' }]}>
                  {locationData ? (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={28} color={Colors.secondary} />
                    </View>
                  ) : (
                    <Ionicons
                      name="location-outline"
                      size={40}
                      color="#60a5fa"
                    />
                  )}
                </View>
                <Text style={styles.optionTitle}>Location Proof</Text>
                <Text style={styles.optionDescription}>
                  {locationData ? 'Location captured' : 'Check in at location'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Submit button */}
          <View style={styles.buttonContainer}>
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.onPrimaryContainer} />
            ) : (
              <>
                {requiresBoth && !photoUrl && !locationData && (
                  <Text style={styles.requiredText}>
                    Both photo and location proof required
                  </Text>
                )}
                {requiresBoth && photoUrl && locationData && (
                  <Pressable
                    style={styles.submitButton}
                    onPress={() => submitProof(photoUrl, locationData)}
                  >
                    <Text style={styles.submitButtonText}>Submit All Proof</Text>
                  </Pressable>
                )}
                {!requiresBoth && (photoUrl || locationData) && (
                  <Pressable
                    style={styles.submitButton}
                    onPress={() => submitProof(photoUrl, locationData)}
                  >
                    <Text style={styles.submitButtonText}>Submit Proof</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerLowest,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.headlineBold,
    color: Colors.onSurface,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
  },
  optionIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(235,178,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  checkmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.background,
    borderRadius: 14,
  },
  optionTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  optionDescription: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.body,
    color: Colors.zinc500,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  requiredText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.body,
    color: Colors.zinc500,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  submitButton: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.headlineBold,
    color: Colors.onPrimaryContainer,
  },
});
