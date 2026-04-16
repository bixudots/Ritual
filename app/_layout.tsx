import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/stores/auth-store';
import { useThemeStore } from '../src/stores/theme-store';
import { Colors } from '../src/constants/theme';
import BiometricLockScreen from '../src/components/BiometricLockScreen';
import {
  loadWelcomeSeen,
  getWelcomeSeen,
  subscribeWelcomeSeen,
} from '../src/lib/welcome-flag';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, isInitialized, initialize, isLocked } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(getWelcomeSeen());

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    loadWelcomeSeen().then((v) => setWelcomeSeen(v));
    const unsub = subscribeWelcomeSeen(() => setWelcomeSeen(getWelcomeSeen()));
    return unsub;
  }, []);

  useEffect(() => {
    if (!isInitialized || welcomeSeen === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onWelcome = inAuthGroup && segments[1] === 'welcome';

    if (!session && !inAuthGroup) {
      router.replace(welcomeSeen ? '/(auth)/login' : '/(auth)/welcome');
    } else if (!session && inAuthGroup && !welcomeSeen && !onWelcome) {
      // First launch — force the tour before login/signup
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isInitialized, segments, welcomeSeen]);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primaryContainer} />
      </View>
    );
  }

  return (
    <>
      {children}
      {session && isLocked && (
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          <BiometricLockScreen />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  const themeId = useThemeStore((s) => s.themeId);
  const isLoaded = useThemeStore((s) => s.isLoaded);
  const loadTheme = useThemeStore((s) => s.loadTheme);

  useEffect(() => {
    loadTheme();
  }, []);

  // Wait for theme to load before rendering to avoid flash
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#131313' }}>
        <StatusBar style="light" />
      </View>
    );
  }

  const isLightTheme = themeId === 'ivory';

  return (
    <GestureHandlerRootView key={themeId} style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style={isLightTheme ? 'dark' : 'light'} />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="habit/new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="habit/[id]/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="habit/[id]/edit"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="capsule/new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="capsule/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="onboarding"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </AuthGate>
    </GestureHandlerRootView>
  );
}
