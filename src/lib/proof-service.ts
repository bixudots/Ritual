import { readAsStringAsync } from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { supabase } from './supabase';

export interface PhotoProofResult {
  photoUrl: string;
  uploadedAt: string;
}

export interface LocationProofResult {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
}

export interface ProofVerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Upload a photo to Supabase storage (proof-photos bucket)
 * File structure: {userId}/{habitId}/{logDate}/{filename}
 */
export async function uploadPhotoProof(
  habitId: string,
  logDate: string,
  photoUri: string,
  userId: string
): Promise<PhotoProofResult> {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${logDate}-${timestamp}.jpg`;
    const filepath = `${userId}/${habitId}/${logDate}/${filename}`;

    // Read photo as base64 and convert to ArrayBuffer for RN compatibility
    const base64 = await readAsStringAsync(photoUri, {
      encoding: 'base64',
    });
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase storage
    const { error } = await supabase.storage
      .from('proof-photos')
      .upload(filepath, bytes.buffer, {
        contentType: 'image/jpeg',
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data } = supabase.storage
      .from('proof-photos')
      .getPublicUrl(filepath);

    return {
      photoUrl: data.publicUrl,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Photo upload error:', error);
    throw error;
  }
}

/**
 * Resolve a stored proof photo URL to a short-lived signed URL so it loads
 * even when the `proof-photos` bucket is private.
 * Accepts either a stored public URL or a raw path, and returns null if resolution fails.
 */
export async function getProofPhotoSignedUrl(
  storedUrl: string | null | undefined
): Promise<string | null> {
  if (!storedUrl) return null;
  const marker = '/proof-photos/';
  let path = storedUrl;
  const idx = storedUrl.indexOf(marker);
  if (idx !== -1) {
    path = storedUrl.slice(idx + marker.length).split('?')[0];
  }
  try {
    const { data, error } = await supabase.storage
      .from('proof-photos')
      .createSignedUrl(path, 60 * 60);
    if (error || !data) {
      console.warn('Signed URL error:', error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.warn('Signed URL exception:', e);
    return null;
  }
}

/**
 * Get current device location
 * Requires location permissions to be granted
 */
export async function getCurrentLocation(): Promise<LocationProofResult> {
  try {
    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Location retrieval error:', error);
    throw error;
  }
}

/**
 * Verify that current location is within the required radius of the proof location
 */
export function verifyLocationProof(
  currentLat: number,
  currentLng: number,
  requiredLat: number,
  requiredLng: number,
  radiusMeters: number
): ProofVerificationResult {
  // Haversine formula to calculate distance between two coordinates
  const R = 6371000; // Earth's radius in meters
  const dLat = (requiredLat - currentLat) * (Math.PI / 180);
  const dLng = (requiredLng - currentLng) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(currentLat * (Math.PI / 180)) *
    Math.cos(requiredLat * (Math.PI / 180)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  const isValid = distance <= radiusMeters;
  
  return {
    valid: isValid,
    reason: isValid
      ? undefined
      : `Location ${(distance / 1000).toFixed(2)}km away (max: ${(radiusMeters / 1000).toFixed(2)}km)`,
  };
}

/**
 * Save proof data to habit log
 */
export async function saveProofToLog(
  habitLogId: string,
  proofPhotoUrl?: string,
  proofLocationLat?: number,
  proofLocationLng?: number
): Promise<void> {
  try {
    const updateData: Record<string, any> = {
      proof_verified: true,
      updated_at: new Date().toISOString(),
    };

    if (proofPhotoUrl) {
      updateData.proof_photo_url = proofPhotoUrl;
    }
    if (proofLocationLat !== undefined && proofLocationLng !== undefined) {
      updateData.proof_location_lat = proofLocationLat;
      updateData.proof_location_lng = proofLocationLng;
    }

    const { error } = await supabase
      .from('habit_logs')
      .update(updateData)
      .eq('id', habitLogId);

    if (error) {
      throw new Error(`Save proof error: ${error.message}`);
    }
  } catch (error) {
    console.error('Save proof error:', error);
    throw error;
  }
}
