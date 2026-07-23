/**
 * Per-uid ledger of locally-saved sequence ids.
 *
 * Dexie's library table is flat, not uid-scoped, and is never cleared on
 * sign-out (tka-database.clearAllData has no auth-change caller). So "every
 * local row" is NOT "this user's saves" on a shared/public device — a prior
 * user's library sits in the same table.
 *
 * This ledger records which sequence ids a given uid actually saved, so a
 * guest→account upgrade can capture EXACTLY that guest's own drafts for import
 * (anonymous-upgrade.captureAnonymousDrafts) instead of sweeping up a prior
 * user's sequences into the colliding account. Keyed by uid; best-effort
 * (a storage failure degrades to "capture nothing", which is safe).
 */
const PREFIX = "tka-saved-seq-ids:";

export function recordSavedSequenceId(
  uid: string | null | undefined,
  id: string
): void {
  if (!uid || !id || typeof window === "undefined") return;
  try {
    const ids = new Set(getSavedSequenceIds(uid));
    ids.add(id);
    localStorage.setItem(PREFIX + uid, JSON.stringify([...ids]));
  } catch {
    // Private browsing / quota — capture falls back to [] (safe), never a leak.
  }
}

export function getSavedSequenceIds(uid: string | null | undefined): string[] {
  if (!uid || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFIX + uid);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}
