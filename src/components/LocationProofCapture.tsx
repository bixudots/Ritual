import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
} from '../constants/theme';
import {
  getCurrentLocation,
  verifyLocationProof,
  type LocationProofResult,
} from '../lib/proof-service';

interface LocationProofCaptureProps {
  habitId: string;
  requiredLat?: number;
  requiredLng?: number;
  radiusMeters?: number;
  onLocationCapture: (location: LocationProofResult) => void;
  onCancel: () => void;
}

export default function LocationProofCapture({
  habitId,
  requiredLat,
  requiredLng,
  radiusMeters,
  onLocationCapture,
  onCancel,
}: LocationProofCaptureProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationProofResult | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{
    valid: boolean;
    reason?: string;
  } | null>(null);

  const captureLocation = async () => {
    try {
      setIsLoading(true);
      const location = await getCurrentLocation();
      setCurrentLocation(location);

      // Verify location if required location is set
      if (requiredLat !== undefined && requiredLng !== undefined && radiusMeters !== undefined) {
        const verification = verifyLocationProof(
          location.lat,
          location.lng,
          requiredLat,
          requiredLng,
          radiusMeters
        );
        setVerificationStatus(verification);

        if (!verification.valid) {
          Alert.alert(
            'Location Verification Failed',
            verification.reason ||
            'You are not at the required location. Please move closer and try again.'
          );
          return;
        }
      }

      // Location is valid or no verification required
      onLocationCapture(location);
    } catch (error) {
      console.error('Location capture error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to get location';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.zinc400} />
        </Pressable>
        <Text style={styles.headerTitle}>Location Proof</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Location icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={64} color={Colors.primaryContainer} />
        </View>

        {/* Instructions */}
        <Text style={styles.instructionText}>
          {requiredLat !== undefined && requiredLng !== undefined
            ? `Check in at the required location within ${((radiusMeters ?? 100) / 1000).toFixed(2)}km`
            : 'Capture your current location as proof'}
        </Text>

        {/* Current location display */}
        {currentLocation && (
          <View style={styles.locationCard}>
            <Text style={styles.locationLabel}>Current Location</Text>
            <Text style={styles.locationCoords}>
              {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
            </Text>
            <Text style={styles.accuracyText}>
              Accuracy: ±{Math.round(currentLocation.accuracy)}m
            </Text>
          </View>
        )}

        {/* Verification status */}
        {verificationStatus && (
          <View
            style={[
              styles.statusCard,
              verificationStatus.valid ? styles.statusValid : styles.statusInvalid,
            ]}
          >
            <Ionicons
              name={verificationStatus.valid ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={verificationStatus.valid ? Colors.secondary : Colors.error}
            />
            <View style={styles.statusContent}>
              <Text
                style={[
                  styles.statusTitle,
                  { color: verificationStatus.valid ? Colors.secondary : Colors.error },
                ]}
              >
                {verificationStatus.valid ? 'Location Verified' : 'Location Not Verified'}
              </Text>
              {verificationStatus.reason && (
                <Text style={styles.statusReason}>{verificationStatus.reason}</Text>
              )}
            </View>
          </View>
        )}

        {/* Required location info */}
        {requiredLat !== undefined && requiredLng !== undefined && (
          <View style={styles.requiredLocationCard}>
            <Text style={styles.requiredLocationLabel}>Required Location</Text>
            <Text style={styles.requiredLocationCoords}>
              {requiredLat.toFixed(6)}, {requiredLng.toFixed(6)}
            </Text>
            <Text style={styles.radiusText}>
              Radius: {((radiusMeters ?? 100) / 1000).toFixed(2)}km
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Capture button */}
      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.captureButton, isLoading && styles.captureButtonDisabled]}
          onPress={captureLocation}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.onPrimaryContainer} />
          ) : (
            <>
              <Ionicons
                name="locate"
                size={20}
                color={Colors.onPrimaryContainer}
                style={{ marginRight: Spacing.sm }}
              />
              <Text style={styles.captureButtonText}>Capture Location</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontFamily: Fonts.headlineBold,
    color: Colors.primaryContainer,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  instructionText: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  locationCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  locationLabel: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.zinc500,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  locationCoords: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  accuracyText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.body,
    color: Colors.zinc500,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  statusValid: {
    backgroundColor: 'rgba(74, 225, 131, 0.1)',
  },
  statusInvalid: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.headlineBold,
    marginBottom: Spacing.xs,
  },
  statusReason: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.body,
    color: Colors.zinc500,
  },
  requiredLocationCard: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
  },
  requiredLocationLabel: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.primaryContainer,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  requiredLocationCoords: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  radiusText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.body,
    color: Colors.zinc500,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerLowest,
  },
  captureButton: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonText: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.headlineBold,
    color: Colors.onPrimaryContainer,
  },
});
