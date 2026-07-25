/**
 * Library Sync Retry
 *
 * A saved sequence's background Firestore sync (LibrarySaveService.syncToFirestore)
 * can fail - offline, a dropped connection, a transient Firestore error. When it
 * does, the sequence stays safe in Dexie but its `syncStatus` is left "pending" or
 * "failed" so the library UI can show a quiet badge instead of an unqualified
 * "Saved!" (see docs/superpowers/specs/active/2026-07-18-onboarding-silent-work-loss.md).
 *
 * This module re-attempts those syncs. Each trigger (browser reconnect, app boot)
 * makes exactly ONE bounded pass over the sequences currently marked pending/failed
 * - no retry loop, no polling timer, no unbounded recursion.
 */

import { db } from "$lib/shared/persistence/database/tka-database";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
import { networkStatusState } from "$lib/shared/offline/state/network-status-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { LibraryError } from "$lib/shared/library/domain/library-error";

export type SequenceSyncStatus = "synced" | "pending" | "failed";

/**
 * Update a single Dexie sequence's local-only syncStatus bookkeeping field.
 * Best-effort: a failure here just means the badge won't update until the
 * next retry pass reconciles it - never lets bookkeeping errors surface to
 * the caller of a save/retry.
 */
export async function markSequenceSyncStatus(
  sequenceId: string,
  status: SequenceSyncStatus
): Promise<void> {
  try {
    await db.sequences.update(sequenceId, { syncStatus: status });
  } catch (dexieError) {
    console.warn(
      "[LibrarySyncRetry] Failed to update sync status:",
      dexieError
    );
  }
}

// Fires at most once per session - a single transient failure never alarms
// the user; only a *retried* sync that fails again does (spec requirement:
// "Toast: only when a sync has failed AND a retry also failed. Max one such
// toast per session.").
let hasShownFailureToast = false;

// Guards against overlapping passes (e.g. reconnect firing while boot's pass
// is still in flight).
let retryInFlight = false;

/**
 * One bounded pass over every Dexie sequence currently marked pending/failed:
 * retry its Firestore sync once, update its syncStatus with the outcome.
 * No-ops if a pass is already running or there's nothing to retry.
 */
export async function retryPendingSyncs(): Promise<void> {
  if (retryInFlight) return;
  retryInFlight = true;

  try {
    const stale = await db.sequences
      .filter((s) => s.syncStatus === "pending" || s.syncStatus === "failed")
      .toArray();
    if (stale.length === 0) return;

    const repo = getLibraryRepository();

    for (const sequence of stale) {
      const wasAlreadyFailed = sequence.syncStatus === "failed";
      try {
        await repo.saveSequenceWithMetadata(sequence, {
          name: sequence.name,
          displayName: sequence.displayName,
          visibility: sequence.pendingSyncMetadata?.visibility ?? "public",
          tags: [...sequence.tags],
          notes: sequence.pendingSyncMetadata?.notes ?? "",
          thumbnailUrl: sequence.thumbnails[0],
        });
        await markSequenceSyncStatus(sequence.id, "synced");
      } catch (error) {
        if (error instanceof LibraryError && error.code === "ALREADY_EXISTS") {
          // Already safe in Firestore under an existing doc - nothing lost.
          await markSequenceSyncStatus(sequence.id, "synced");
          continue;
        }

        await markSequenceSyncStatus(sequence.id, "failed");
        console.warn("[LibrarySyncRetry] Retry failed for", sequence.id, error);

        if (wasAlreadyFailed && !hasShownFailureToast) {
          hasShownFailureToast = true;
          toast.info(
            "A saved sequence couldn't sync to the cloud. It's safe on this device and we'll keep retrying.",
            6000
          );
        }
      }
    }
  } finally {
    retryInFlight = false;
  }
}

let listenerAttached = false;

/**
 * Wire retry triggers: one pass now (call at app boot) and one more every
 * time the browser regains connectivity. Idempotent - safe to call more than
 * once. Returns an unsubscribe function for the reconnect listener.
 */
export function initLibrarySyncRetry(): () => void {
  void retryPendingSyncs();

  if (listenerAttached || typeof window === "undefined") {
    return () => {};
  }
  listenerAttached = true;

  return networkStatusState.onOnline(() => {
    void retryPendingSyncs();
  });
}
