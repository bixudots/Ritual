import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius } from '../constants/theme';
import { uploadPhotoProof } from '../lib/proof-service';

type Stage = 'choose' | 'camera' | 'preview';

interface PhotoProofCaptureProps {
  habitId: string;
  logDate: string;
  userId: string;
  onPhotoCapture: (photoUrl: string) => void;
  onCancel: () => void;
}

export default function PhotoProofCapture({
  habitId,
  logDate,
  userId,
  onPhotoCapture,
  onCancel,
}: PhotoProofCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isUploading, setIsUploading] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [stage, setStage] = useState<Stage>('choose');
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const uploadAndSubmit = async (uri: string) => {
    try {
      setIsUploading(true);
      const result = await uploadPhotoProof(habitId, logDate, uri, userId);
      onPhotoCapture(result.photoUrl);
    } catch (error) {
      console.error('Photo upload error:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
      setPreviewUri(null);
      setStage('choose');
    } finally {
      setIsUploading(false);
    }
  };

  const saveToCameraRoll = async (uri: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') return;
      const asset = await MediaLibrary.createAssetAsync(uri);
      try {
        const album = await MediaLibrary.getAlbumAsync('Ritual');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('Ritual', asset, false);
        }
      } catch {
        // Album ops can fail on iOS if user denied; asset is still saved to All Photos
      }
    } catch (error) {
      console.warn('Failed to save photo to library:', error);
    }
  };

  const takePicture = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo) {
        throw new Error('Failed to capture photo');
      }

      // Auto-save the captured photo to the user's Photos library (fire-and-forget)
      saveToCameraRoll(photo.uri);

      setPreviewUri(photo.uri);
      setStage('preview');
    } catch (error) {
      console.error('Photo capture error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        setPreviewUri(result.assets[0].uri);
        setStage('preview');
      }
    } catch (error) {
      console.error('Gallery picker error:', error);
      Alert.alert('Error', 'Failed to pick photo from gallery.');
    }
  };

  // Preview stage — show photo and confirm/retake
  if (stage === 'preview' && previewUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />

        {isUploading && (
          <View style={styles.uploadingOverlayFull}>
            <ActivityIndicator size="large" color={Colors.primaryContainer} />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}

        <View style={styles.previewControls}>
          <Pressable
            style={styles.retakeButton}
            onPress={() => { setPreviewUri(null); setStage('choose'); }}
            disabled={isUploading}
          >
            <Ionicons name="refresh" size={20} color={Colors.white} />
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>

          <Pressable
            style={[styles.confirmButton, isUploading && { opacity: 0.5 }]}
            onPress={() => uploadAndSubmit(previewUri)}
            disabled={isUploading}
          >
            <Ionicons name="checkmark" size={20} color={Colors.onPrimaryContainer} />
            <Text style={styles.confirmText}>Use Photo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Camera stage
  if (stage === 'camera') {
    if (!permission) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color={Colors.primaryContainer} />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.centeredContainer}>
          <Text style={styles.permissionText}>Camera permission needed</Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
          <Pressable style={styles.cancelTextButton} onPress={() => setStage('choose')}>
            <Text style={styles.cancelTextButtonText}>Go Back</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} ref={cameraRef} facing={cameraFacing}>
          <Pressable style={styles.closeButton} onPress={() => setStage('choose')}>
            <Ionicons name="chevron-back" size={28} color={Colors.white} />
          </Pressable>

          <Pressable
            style={styles.flipButton}
            onPress={() => setCameraFacing((c) => (c === 'back' ? 'front' : 'back'))}
          >
            <Ionicons name="camera-reverse" size={28} color={Colors.white} />
          </Pressable>

          <View style={styles.cameraControlsContainer}>
            <Text style={styles.instructionText}>Take a photo as proof</Text>
            <Pressable style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </Pressable>
          </View>
        </CameraView>
      </View>
    );
  }

  // Choose stage — pick camera or gallery
  return (
    <View style={styles.centeredContainer}>
      <Pressable style={styles.backFromChoose} onPress={onCancel}>
        <Ionicons name="close" size={24} color={Colors.zinc400} />
      </Pressable>

      <View style={styles.chooseIconContainer}>
        <Ionicons name="image" size={56} color={Colors.primaryContainer} />
      </View>

      <Text style={styles.chooseTitle}>Add Photo Proof</Text>
      <Text style={styles.chooseSubtitle}>Take a live photo or pick from your gallery</Text>

      <View style={styles.chooseOptions}>
        <Pressable style={styles.chooseCard} onPress={() => setStage('camera')}>
          <View style={[styles.chooseCardIcon, { backgroundColor: 'rgba(235,178,255,0.1)' }]}>
            <Ionicons name="camera" size={28} color={Colors.tertiary} />
          </View>
          <Text style={styles.chooseCardTitle}>Take Photo</Text>
          <Text style={styles.chooseCardDesc}>Live camera</Text>
        </Pressable>

        <Pressable style={styles.chooseCard} onPress={pickFromGallery}>
          <View style={[styles.chooseCardIcon, { backgroundColor: 'rgba(96,165,250,0.1)' }]}>
            <Ionicons name="images" size={28} color="#60a5fa" />
          </View>
          <Text style={styles.chooseCardTitle}>Upload</Text>
          <Text style={styles.chooseCardDesc}>From gallery</Text>
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
  centeredContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  camera: {
    flex: 1,
  },

  // Choose stage
  backFromChoose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    left: Spacing.xl,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,140,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  chooseTitle: {
    fontSize: FontSizes['2xl'],
    fontFamily: Fonts.headlineBold,
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  chooseSubtitle: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.body,
    color: Colors.zinc500,
    marginBottom: Spacing['3xl'],
  },
  chooseOptions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    width: '100%',
  },
  chooseCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
  },
  chooseCardIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  chooseCardTitle: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.headlineBold,
    color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  chooseCardDesc: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.body,
    color: Colors.zinc500,
  },

  // Camera stage
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    left: Spacing.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 22,
  },
  flipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    right: Spacing.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 22,
  },
  cameraControlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    paddingTop: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  instructionText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontFamily: Fonts.bodySemiBold,
    marginBottom: Spacing.lg,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryContainer,
  },

  // Preview stage
  previewImage: {
    flex: 1,
  },
  previewControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    paddingTop: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  retakeText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.white,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  confirmText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.headlineBold,
    color: Colors.onPrimaryContainer,
  },
  uploadingOverlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  uploadingText: {
    color: Colors.white,
    marginTop: Spacing.lg,
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
  },

  // Permission
  permissionText: {
    fontSize: FontSizes.lg,
    color: Colors.onSurface,
    fontFamily: Fonts.bodySemiBold,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: Colors.primaryContainer,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  permissionButtonText: {
    color: Colors.onPrimaryContainer,
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
  },
  cancelTextButton: {
    paddingVertical: Spacing.sm,
  },
  cancelTextButtonText: {
    color: Colors.zinc500,
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
  },
});
