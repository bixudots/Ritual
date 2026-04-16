import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// ── Avatar icons ──────────────────────────────────────────────
// Shared catalog used by profile, home, dashboard, and capsules.
// Stored as `<lib>:<name>` in user_metadata.avatar_icon.
// `ion` = Ionicons, `mci` = MaterialCommunityIcons.

export type AvatarIconLib = 'ion' | 'mci';

export type AvatarIconDef = {
  id: string;
  lib: AvatarIconLib;
  name: string;
  color: string;
};

export const AVATAR_ICONS: AvatarIconDef[] = [
  { id: 'mci:bat',     lib: 'mci', name: 'bat',           color: '#A78BFA' },
  { id: 'mci:ghost',   lib: 'mci', name: 'ghost-outline', color: '#E0E0E0' },
  { id: 'ion:skull',   lib: 'ion', name: 'skull',         color: '#F472B6' },
  { id: 'ion:rocket',  lib: 'ion', name: 'rocket',        color: '#FB923C' },
  { id: 'ion:flame',   lib: 'ion', name: 'flame',         color: '#FF6B35' },
  { id: 'ion:flash',   lib: 'ion', name: 'flash',         color: '#FBBF24' },
  { id: 'ion:paw',     lib: 'ion', name: 'paw',           color: '#34D399' },
  { id: 'ion:star',    lib: 'ion', name: 'star',          color: '#FCD34D' },
  { id: 'ion:trophy',  lib: 'ion', name: 'trophy',        color: '#F59E0B' },
  { id: 'ion:diamond', lib: 'ion', name: 'diamond',       color: '#60A5FA' },
];

export function getAvatarIconById(id: string | null | undefined): AvatarIconDef | null {
  if (!id) return null;
  return AVATAR_ICONS.find((i) => i.id === id) ?? null;
}

export function AvatarIconGlyph({
  def,
  size,
  color,
}: {
  def: AvatarIconDef;
  size: number;
  color?: string;
}) {
  const c = color ?? def.color;
  if (def.lib === 'mci') {
    return <MaterialCommunityIcons name={def.name as any} size={size} color={c} />;
  }
  return <Ionicons name={def.name as any} size={size} color={c} />;
}
