/**
 * Lightweight similarity checks used by the "Browse library" flow so we
 * never re-suggest a habit the user already has (or something close enough
 * to be confusing). Purely heuristic — never touches the DB.
 */

// Words that are too generic to count as a real overlap. All lowercase,
// all length >= 4 (so they'd otherwise pass the token filter).
const STOPWORDS = new Set([
  'daily', 'weekly', 'every', 'this', 'that', 'with', 'your', 'mine',
  'time', 'some', 'than', 'morning', 'evening', 'night', 'noon',
  'hour', 'hours', 'minute', 'minutes', 'week', 'weeks', 'month',
  'months', 'year', 'years', 'from', 'into', 'over', 'just', 'once',
  'twice', 'times',
]);

/** Lowercased, punctuation-stripped, collapsed whitespace. */
export function normalizeHabitName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // drop emojis, punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Meaningful content tokens from a habit name (length ≥ 4, minus stopwords). */
function contentTokens(name: string): Set<string> {
  const norm = normalizeHabitName(name);
  if (!norm) return new Set();
  const out = new Set<string>();
  for (const t of norm.split(' ')) {
    if (t.length >= 4 && !STOPWORDS.has(t)) out.add(t);
  }
  return out;
}

/**
 * Heuristically decide whether two habit names describe the same thing.
 * Used to hide library presets that would collide with what the user
 * already tracks.
 *
 * Matches when:
 *  - normalized names are equal
 *  - one normalized name contains the other as a substring
 *  - they share at least one content token (≥4 chars, not a stopword)
 */
export function areHabitsSimilar(a: string, b: string): boolean {
  const na = normalizeHabitName(a);
  const nb = normalizeHabitName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Substring catches "run" vs "morning run", "yoga" vs "yoga flow".
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

/** True if `presetName` is similar to anything in `existingNames`. */
export function isPresetAlreadyCovered(
  presetName: string,
  existingNames: string[],
): boolean {
  for (const name of existingNames) {
    if (areHabitsSimilar(presetName, name)) return true;
  }
  return false;
}
