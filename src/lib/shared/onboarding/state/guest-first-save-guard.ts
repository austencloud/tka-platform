/**
 * Guest First-Save Guard
 *
 * Per-guest-UID once-only guard for the post-save activation prompt (SP3).
 * Keyed by uid so a guest who signs out/back in (or the app assigns a new
 * anonymous uid) doesn't get skipped by another guest's stale flag, and a
 * shared browser doesn't leak the "seen" state across different guests.
 *
 * Versioned key (`-v1`) so a future copy/behavior change can invalidate every
 * existing guest's guard by bumping the suffix, without touching this file's
 * read/write logic.
 *
 * localStorage can throw (private browsing, quota, disabled storage) or can
 * simply not persist. Either way we fall back to an in-memory Set for the
 * current tab so a single session never re-prompts on every save — the
 * fallback only fails to survive a reload, it never fails to survive a save.
 */

const STORAGE_KEY_PREFIX = "tka-guest-first-save-prompt-v1:";

/** In-memory fallback, keyed by uid, for when localStorage is unavailable. */
const _memoryFallback = new Set<string>();

function storageKey(uid: string): string {
  return `${STORAGE_KEY_PREFIX}${uid}`;
}

/** Whether this guest uid has already seen (or been marked past) the prompt. */
export function hasSeen(uid: string): boolean {
  if (_memoryFallback.has(uid)) return true;

  try {
    return localStorage.getItem(storageKey(uid)) === "1";
  } catch {
    // localStorage unavailable - the in-memory fallback is authoritative for
    // this tab; we already checked it above, so this guest hasn't been
    // marked seen yet.
    return false;
  }
}

/** Mark this guest uid as having seen the prompt. Idempotent. */
export function markSeen(uid: string): void {
  _memoryFallback.add(uid);

  try {
    localStorage.setItem(storageKey(uid), "1");
  } catch {
    // Ignore - the in-memory fallback above still prevents a re-prompt for
    // the rest of this tab's lifetime.
  }
}
