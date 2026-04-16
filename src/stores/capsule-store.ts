import { create } from 'zustand';
import type { TimeCapsule } from '../types/capsule';
import {
  getCapsules,
  createCapsule as svcCreate,
  openCapsule as svcOpen,
  deleteCapsule as svcDelete,
  uploadCapsulePhoto,
  type CreateCapsuleInput,
} from '../lib/capsule-service';
import { supabase } from '../lib/supabase';
import { useHabitStore } from './habit-store';
import { scheduleCapsuleNotification, cancelCapsuleNotification } from '../lib/notifications';
import { getCapsuleUnlockDate } from '../types/capsule';

// ── Capsule XP rewards ──
// Kept as constants so the UI and store stay in lock-step.
export const CAPSULE_XP = {
  LOCK_BASE: 100,        // each capsule locked (Writer — repeat)
  LOCK_PHOTO_BONUS: 25,  // extra if any photo attached
  SAVE_AFTER_OPEN: 50,   // saving a capsule after opening it
  POSTMAN_BONUS: 200,    // first ever capsule sent (one-time)
  TIME_TRAVELER_BONUS: 200, // first capsule opened AND saved (one-time)
} as const;

export interface CapsuleSealReward {
  baseXP: number;
  photoBonus: number;
  postmanBonus: number;
  totalXP: number;
  writerCount: number; // total sent after this one
  earnedPostman: boolean;
}

export interface CapsuleSaveReward {
  saveXP: number;
  timeTravelerBonus: number;
  totalXP: number;
  earnedTimeTraveler: boolean;
}

async function recordCapsuleXP(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string | null,
  eventType: 'earned' | 'badge_reward' = 'earned',
) {
  if (amount <= 0) return;
  await supabase.from('xp_events').insert({
    user_id: userId,
    event_type: eventType,
    xp_amount: amount,
    reference_id: referenceId ?? null,
    description,
  });
}

interface CapsuleState {
  capsules: TimeCapsule[];
  loading: boolean;
  loaded: boolean;

  fetchCapsules: (userId: string) => Promise<void>;
  addCapsule: (
    input: Omit<CreateCapsuleInput, 'photoUrls'> & { localPhotoUris?: string[] },
  ) => Promise<{ capsule: TimeCapsule; reward: CapsuleSealReward }>;
  openAndSave: (id: string, save: boolean) => Promise<CapsuleSaveReward | null>;
  deleteCapsule: (id: string) => Promise<void>;

  reset: () => void;
}

export const useCapsuleStore = create<CapsuleState>((set, get) => ({
  capsules: [],
  loading: false,
  loaded: false,

  fetchCapsules: async (userId: string) => {
    set({ loading: true });
    try {
      const capsules = await getCapsules(userId);
      set({ capsules, loading: false, loaded: true });
    } catch (err) {
      console.error('fetchCapsules error:', err);
      set({ loading: false, loaded: true });
    }
  },

  addCapsule: async ({ userId, title, message, deliverOn, deliverAt, localPhotoUris }) => {
    // Upload photos first (if any)
    let photoUrls: string[] = [];
    if (localPhotoUris && localPhotoUris.length > 0) {
      photoUrls = await Promise.all(
        localPhotoUris.map((uri) => uploadCapsulePhoto(userId, uri)),
      );
    }
    const capsule = await svcCreate({
      userId,
      title,
      message,
      deliverOn,
      deliverAt: deliverAt ?? null,
      photoUrls,
    });

    // Determine if this is the user's first ever capsule
    // (count capsules already in the store before we add the new one)
    const priorCount = get().capsules.length;
    const isFirstEver = priorCount === 0;

    set((state) => ({ capsules: [capsule, ...state.capsules] }));

    // Schedule delivery notification
    try {
      const unlockDate = getCapsuleUnlockDate(capsule);
      await scheduleCapsuleNotification(capsule.id, capsule.title, unlockDate);
    } catch (err) {
      console.warn('capsule notification error:', err);
    }

    // ── XP rewards ──
    const baseXP = CAPSULE_XP.LOCK_BASE;
    const photoBonus = photoUrls.length > 0 ? CAPSULE_XP.LOCK_PHOTO_BONUS : 0;
    const postmanBonus = isFirstEver ? CAPSULE_XP.POSTMAN_BONUS : 0;
    const totalXP = baseXP + photoBonus + postmanBonus;

    try {
      await recordCapsuleXP(
        userId,
        baseXP,
        `Capsule sealed: ${title}`,
        capsule.id,
      );
      if (photoBonus > 0) {
        await recordCapsuleXP(
          userId,
          photoBonus,
          'Photo attached to capsule',
          capsule.id,
        );
      }
      if (postmanBonus > 0) {
        await recordCapsuleXP(
          userId,
          postmanBonus,
          'Badge: Postman (first capsule sent)',
          capsule.id,
          'badge_reward',
        );
      }
      // Pull authoritative XP from profiles.xp
      await useHabitStore.getState().fetchProfileXP();
    } catch (err) {
      console.error('capsule XP award error:', err);
    }

    const reward: CapsuleSealReward = {
      baseXP,
      photoBonus,
      postmanBonus,
      totalXP,
      writerCount: priorCount + 1,
      earnedPostman: isFirstEver,
    };

    return { capsule, reward };
  },

  openAndSave: async (id, save) => {
    const existingCapsule = get().capsules.find((c) => c.id === id);
    const userId = existingCapsule?.userId;

    const updated = await svcOpen(id, save);
    set((state) => ({
      capsules: save && updated
        ? state.capsules.map((c) => (c.id === id ? updated : c))
        : state.capsules.filter((c) => c.id !== id),
    }));

    if (!save || !userId) return null;

    // Has the user ever opened-and-saved before THIS one?
    // At this point state is already updated, so we check: count of prior
    // saved+opened capsules excluding this one.
    const priorSavedCount = get()
      .capsules.filter((c) => c.id !== id && c.saved && !!c.openedAt)
      .length;
    const earnedTimeTraveler = priorSavedCount === 0;

    const saveXP = CAPSULE_XP.SAVE_AFTER_OPEN;
    const timeTravelerBonus = earnedTimeTraveler ? CAPSULE_XP.TIME_TRAVELER_BONUS : 0;
    const totalXP = saveXP + timeTravelerBonus;

    try {
      await recordCapsuleXP(userId, saveXP, 'Capsule opened & saved', id);
      if (timeTravelerBonus > 0) {
        await recordCapsuleXP(
          userId,
          timeTravelerBonus,
          'Badge: Time Traveler (first capsule opened & saved)',
          id,
          'badge_reward',
        );
      }
      await useHabitStore.getState().fetchProfileXP();
    } catch (err) {
      console.error('capsule save XP error:', err);
    }

    return { saveXP, timeTravelerBonus, totalXP, earnedTimeTraveler };
  },

  deleteCapsule: async (id) => {
    await svcDelete(id);
    set((state) => ({ capsules: state.capsules.filter((c) => c.id !== id) }));
  },

  reset: () => set({ capsules: [], loading: false, loaded: false }),
}));
