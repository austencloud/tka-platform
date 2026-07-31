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

import { FirebaseError } from "firebase/app";
import { db } from "$lib/shared/persistence/database/tka-database";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
import { networkStatusState } from "$lib/shared/offline/state/network-status-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { LibraryError } from "$lib/shared/library/domain/library-error";
import { IncompleteWordError } from "$lib/shared/foundation/services/word-deriver";
import { SequenceNormalizationError } from "$lib/shared/library/services/sequence-persistence-normalizer";
import { PublicDuplicateError } from "$lib/shared/library/services/public-sequence-persister";
import { ContentModerationError } from "$lib/features/moderation/errors/content-moderation-error";
import { isSequenceDeletionIntended } from "$lib/shared/library/services/sequence-persistence-coordinator";

export type SequenceSyncStatus = "synced" | "pending" | "failed";

/**
 * A typed PERMANENT rejection: retrying cannot succeed until the user changes
 * something, so it must never spin in the background queue (parity-repair
 * spec, section 6). Transient failures (offline, contention) return null and
 * keep the normal retry path.
 */
function permanentPublishRejection(
  error: unknown
): { code: string; message: string } | null {
  if (error instanceof IncompleteWordError) {
    return {
      code: error.code,
      message:
        "A saved sequence has unresolved steps and can't publish. Open it to finish them.",
    };
  }
  if (error instanceof SequenceNormalizationError) {
    return {
      code: error.code,
      message:
        "A saved sequence can't be published in its current form. Open it in your library for details.",
    };
  }
  if (error instanceof PublicDuplicateError) {
    return {
      code: error.code,
      message:
        "This exact sequence is already in the community gallery. Your copy stays safe on this device.",
    };
  }
  if (error instanceof ContentModerationError) {
    return {
      code: "CONTENT_MODERATION",
      message: "A saved sequence was flagged by moderation and won't publish.",
    };
  }
  // Phase-4 strict rules reject any publish that does not prove the full
  // transaction shape. The current client always produces that shape, so a
  // rules denial on publish means this BUNDLE predates the contract (an old
  // cached SPA) — retrying the same code cannot succeed. The spec's required
  // UX: identify the client-version failure and ask for a reload. Local
  // saves are untouched; an explicit re-save after reload clears the block.
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return {
      code: "CLIENT_VERSION_REJECTED",
      message:
        "Cloud sync was rejected — this app version is out of date. Reload the page to update; your work is safe on this device.",
    };
  }
  return null;
}

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
      .filter(
        (s) =>
          (s.syncStatus === "pending" || s.syncStatus === "failed") &&
          // A typed permanent rejection needs a user action, not another
          // attempt — skip until the next explicit save clears the reason.
          !s.pendingSyncMetadata?.blockedReason
      )
      .toArray();
    if (stale.length === 0) return;

    const repo = getLibraryRepository();

    for (const sequence of stale) {
      if (isSequenceDeletionIntended(sequence.id)) continue;
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

        const permanent = permanentPublishRejection(error);
        if (permanent) {
          // Record the typed blocked reason so future passes skip this record,
          // and tell the user ONCE what action is needed. The sequence stays
          // safe in Dexie; nothing was published.
          try {
            await db.sequences.update(sequence.id, {
              syncStatus: "failed",
              pendingSyncMetadata: {
                visibility:
                  sequence.pendingSyncMetadata?.visibility ?? "public",
                notes: sequence.pendingSyncMetadata?.notes ?? "",
                blockedReason: permanent.code,
              },
            });
          } catch (dexieError) {
            console.warn(
              "[LibrarySyncRetry] Failed to record blocked reason:",
              dexieError
            );
          }
          if (!hasShownFailureToast) {
            hasShownFailureToast = true;
            toast.info(permanent.message, 6000);
          }
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
