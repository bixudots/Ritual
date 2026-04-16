import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'biometric_enabled_v1';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'biometric';

/**
 * True only when the device has biometric hardware AND the user has enrolled
 * at least one biometric identity (face/finger). A passcode alone doesn't count.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

export async function getBiometricKind(): Promise<BiometricKind> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
    return 'biometric';
  } catch {
    return 'biometric';
  }
}

export async function authenticate(
  promptMessage = 'Unlock Ritual',
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
      // Allow fallback to device passcode — matches banking/1Password behavior
      disableDeviceFallback: false,
    });
    if (res.success) return { success: true };
    return { success: false, error: (res as any).error ?? 'cancelled' };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'unknown' };
  }
}

export async function getBiometricEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ENABLED_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
}
