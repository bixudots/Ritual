import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useAuthStore } from '../stores/auth-store';
import { AvatarIconGlyph, getAvatarIconById } from '../constants/avatar-icons';
import { Colors, Fonts } from '../constants/theme';

// ── Avatar sizing config ──
// All avatar circle sizing in the app flows through this component, so any
// screen that renders the user avatar stays in sync when the icon changes.

const DEFAULT_SIZE = 40;
const INITIALS_FONT_RATIO = 0.4;
const EMOJI_FONT_RATIO = 0.5;
const ICON_SIZE_RATIO = 0.6;

function getUserInitials(user: any): string {
  const displayName: string = user?.user_metadata?.display_name || '';
  const email: string = user?.email || '';
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export type HeaderAvatarProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * Shared user avatar circle used in home, dashboard, capsules and profile
 * headers. Renders priority: picked icon → legacy emoji → initials.
 * Reads reactively from the auth store so a change in profile updates
 * every screen that mounts this component.
 */
export default function HeaderAvatar({
  size = DEFAULT_SIZE,
  style,
  textStyle,
}: HeaderAvatarProps) {
  const user = useAuthStore((s) => s.user);
  const avatarIconId: string | null = user?.user_metadata?.avatar_icon ?? null;
  const avatarEmoji: string | null = user?.user_metadata?.avatar_emoji ?? null;
  const initials = useMemo(() => getUserInitials(user), [user]);

  const iconDef = getAvatarIconById(avatarIconId);

  const circleStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return (
    <View style={[styles.avatar, circleStyle, style]}>
      {iconDef ? (
        <AvatarIconGlyph def={iconDef} size={Math.round(size * ICON_SIZE_RATIO)} />
      ) : avatarEmoji ? (
        <Text style={[styles.avatarEmoji, { fontSize: Math.round(size * EMOJI_FONT_RATIO) }, textStyle]}>
          {avatarEmoji}
        </Text>
      ) : (
        <Text
          style={[
            styles.avatarInitial,
            { fontSize: Math.round(size * INITIALS_FONT_RATIO) },
            textStyle,
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: Colors.primaryContainer + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { lineHeight: undefined },
  avatarInitial: {
    fontFamily: Fonts.headlineBold,
    color: Colors.primary,
  },
});
