import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../constants/theme';
import type { ProofType } from '../types/habit';

interface ProofButtonProps {
  proofRequired: ProofType;
  proofVerified: boolean;
  onPress: () => void;
}

export default function ProofButton({
  proofRequired,
  proofVerified,
  onPress,
}: ProofButtonProps) {
  if (proofRequired === 'none') {
    return null;
  }

  const getIcon = () => {
    if (proofRequired === 'photo') return 'camera-outline';
    if (proofRequired === 'location') return 'location-outline';
    return 'camera-outline';
  };

  // Subtle, tucked-away when already verified — just a tiny tinted icon.
  // Louder when unverified, to draw the tap.
  if (proofVerified) {
    return (
      <Pressable style={styles.button} onPress={onPress} hitSlop={8}>
        <Ionicons
          name={proofRequired === 'location' ? 'location' : 'image-outline'}
          size={14}
          color={Colors.zinc500}
        />
      </Pressable>
    );
  }

  const iconColor = proofRequired === 'location' ? '#60a5fa' : Colors.tertiary;
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <View style={styles.pendingPill}>
        <Ionicons name={getIcon()} size={14} color={iconColor} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(235,178,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
