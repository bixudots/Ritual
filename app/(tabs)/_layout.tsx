import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';
import CapsuleIcon from '../../src/components/CapsuleIcon';
import { useThemeStore } from '../../src/stores/theme-store';
import * as Haptics from 'expo-haptics';

export default function TabLayout() {
  // Subscribe so this re-renders on theme change (root layout remounts anyway via key)
  const themeId = useThemeStore((s) => s.themeId);
  const isLight = themeId === 'ivory';

  const tabBg = Colors.background;
  const tabBgAlpha = isLight ? `${tabBg}F2` : `${tabBg}E6`;
  const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
  const rippleColor = `${Colors.primaryContainer}14`;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primaryContainer,
        tabBarInactiveTintColor: Colors.zinc500,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: TAB_BAR_HEIGHT,
          borderTopWidth: 0,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : tabBgAlpha,
          elevation: 0,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFillObject, {
            backgroundColor: Platform.OS === 'ios' ? tabBgAlpha : 'transparent',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: borderColor,
            overflow: 'hidden',
          }]}>
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={40}
                tint={isLight ? 'light' : 'dark'}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </View>
        ),
        tabBarButton: (props) => {
          const { style, children, onPress } = props;
          return (
            <Pressable
              style={style}
              onPress={(e) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (onPress) onPress(e);
              }}
              android_ripple={{ color: rippleColor, borderless: true }}
            >
              {children}
            </Pressable>
          );
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'today' : 'today-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="capsules"
        options={{
          title: 'Capsules',
          tabBarIcon: ({ focused, color }) => (
            <CapsuleIcon size={24} color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 84 : 64;

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabIcon: {
    marginBottom: -2,
  },
});
