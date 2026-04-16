import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Colors,
  Fonts,
  FontSizes,
  Spacing,
  BorderRadius,
} from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreateOwn: () => void;
  onBrowse: () => void;
}

/**
 * Bottom-sheet chooser shown when a user who already has habits taps the
 * add button. Two paths: `Create your own` → blank new-habit form, or
 * `Browse library` → onboarding preset picker (with dedup against what
 * they already have).
 */
export default function AddHabitSheet({
  visible,
  onClose,
  onCreateOwn,
  onBrowse,
}: Props) {
  const handleCreate = () => {
    Haptics.selectionAsync();
    onCreateOwn();
  };
  const handleBrowse = () => {
    Haptics.selectionAsync();
    onBrowse();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add a habit</Text>

          <Pressable style={styles.option} onPress={handleCreate}>
            <View style={[styles.iconBubble, styles.iconBubbleCreate]}>
              <Ionicons name="add" size={24} color={Colors.onPrimaryContainer} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Create your own</Text>
              <Text style={styles.optionSub}>
                Name, schedule, difficulty — tailor it end to end
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.zinc500} />
          </Pressable>

          <Pressable style={styles.option} onPress={handleBrowse}>
            <View style={[styles.iconBubble, styles.iconBubbleBrowse]}>
              <Ionicons name="library" size={22} color={Colors.secondary} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Browse library</Text>
              <Text style={styles.optionSub}>
                Pick from curated starters for different life areas
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.zinc500} />
          </Pressable>

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceContainer,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? Spacing['3xl'] : Spacing['2xl'],
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.zinc700,
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Fonts.headlineExtraBold,
    fontSize: FontSizes.xl,
    color: Colors.onSurface,
    marginBottom: Spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleCreate: {
    backgroundColor: Colors.primaryContainer,
  },
  iconBubbleBrowse: {
    backgroundColor: 'rgba(74,225,131,0.15)',
  },
  optionBody: { flex: 1 },
  optionTitle: {
    fontFamily: Fonts.headlineBold,
    fontSize: FontSizes.md,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  optionSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.zinc500,
    lineHeight: 18,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancelText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.zinc500,
  },
});
