import { readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from './supabase';
import type { TimeCapsule } from '../types/capsule';

const BUCKET = 'capsule-photos';

function mapRow(row: any): TimeCapsule {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    photoUrls: row.photo_urls ?? [],
    deliverOn: row.deliver_on,
    deliverAt: row.deliver_at ?? null,
    openedAt: row.opened_at,
    saved: row.saved,
    createdAt: row.created_at,
  };
}

/** Fetch all capsules for a user, newest first. */
export async function getCapsules(userId: string): Promise<TimeCapsule[]> {
  const { data, error } = await supabase
    .from('time_capsules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/**
 * Upload a local photo URI to storage and return the stored PATH
 * (`<userId>/<filename>.jpg`). The bucket is private, so callers must mint
 * a signed URL via `getCapsulePhotoSignedUrl` before rendering.
 */
export async function uploadCapsulePhoto(
  userId: string,
  localUri: string,
): Promise<string> {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${userId}/${filename}`;

  const base64 = await readAsStringAsync(localUri, { encoding: 'base64' });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes.buffer, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  return path;
}

/**
 * Resolve a stored capsule photo reference (either a raw path or a legacy
 * public URL from an earlier build) to a short-lived signed URL.
 * Returns null if resolution fails so callers can render a placeholder.
 */
export async function getCapsulePhotoSignedUrl(
  stored: string | null | undefined,
): Promise<string | null> {
  if (!stored) return null;
  const marker = `/${BUCKET}/`;
  let path = stored;
  const idx = stored.indexOf(marker);
  if (idx !== -1) {
    path = stored.slice(idx + marker.length).split('?')[0];
  }
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export interface CreateCapsuleInput {
  userId: string;
  title: string;
  message: string;
  deliverOn: string; // YYYY-MM-DD
  deliverAt?: string | null; // optional ISO timestamp
  photoUrls?: string[];
}

/** Insert a new capsule. */
export async function createCapsule(input: CreateCapsuleInput): Promise<TimeCapsule> {
  const { data, error } = await supabase
    .from('time_capsules')
    .insert({
      user_id: input.userId,
      title: input.title,
      message: input.message,
      deliver_on: input.deliverOn,
      deliver_at: input.deliverAt ?? null,
      photo_urls: input.photoUrls ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Mark a capsule as opened. If `save` is false, the row is deleted after open. */
export async function openCapsule(id: string, save: boolean): Promise<TimeCapsule | null> {
  const { data, error } = await supabase
    .from('time_capsules')
    .update({
      opened_at: new Date().toISOString(),
      saved: save,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  if (!save) {
    // User chose not to keep — delete row and photos.
    await deleteCapsule(id, mapRow(data).photoUrls);
    return null;
  }
  return mapRow(data);
}

/** Permanently delete a capsule and its associated photos from storage. */
export async function deleteCapsule(id: string, photoUrls?: string[]): Promise<void> {
  // Gather photo paths if not supplied
  let urls = photoUrls;
  if (!urls) {
    const { data } = await supabase
      .from('time_capsules')
      .select('photo_urls')
      .eq('id', id)
      .single();
    urls = data?.photo_urls ?? [];
  }

  // Remove the DB row first
  const { error } = await supabase.from('time_capsules').delete().eq('id', id);
  if (error) throw error;

  // Best-effort cleanup of storage objects. `urls` can contain raw paths
  // (new installs) or legacy public URLs — handle both.
  if (urls && urls.length > 0) {
    const marker = `/${BUCKET}/`;
    const paths = urls
      .map((u) => {
        const idx = u.indexOf(marker);
        if (idx >= 0) return u.slice(idx + marker.length).split('?')[0];
        // No marker — assume it's already a raw path like "<userId>/<file>".
        return u;
      })
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
  }
}
