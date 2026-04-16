export interface TimeCapsule {
  id: string;
  userId: string;
  title: string;
  message: string;
  photoUrls: string[];
  deliverOn: string; // YYYY-MM-DD (date portion — always set)
  deliverAt: string | null; // ISO timestamp — set only if user picked an exact time
  openedAt: string | null;
  saved: boolean;
  createdAt: string;
}

/** The moment when the capsule becomes openable, as a Date. */
export function getCapsuleUnlockDate(c: TimeCapsule): Date {
  if (c.deliverAt) return new Date(c.deliverAt);
  // Midnight local on deliver_on — ready any time that day
  return new Date(c.deliverOn + 'T00:00:00');
}

export function isCapsuleReady(c: TimeCapsule, now: Date = new Date()): boolean {
  if (c.openedAt !== null) return false;
  return now.getTime() >= getCapsuleUnlockDate(c).getTime();
}

export function isCapsuleSealed(c: TimeCapsule, now: Date = new Date()): boolean {
  if (c.openedAt !== null) return false;
  return now.getTime() < getCapsuleUnlockDate(c).getTime();
}
