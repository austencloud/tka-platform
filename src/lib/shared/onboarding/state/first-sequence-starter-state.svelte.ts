/**
 * First-Sequence Starter State (SP3, Part A)
 *
 * Module singleton — same pattern as firstRunState / appEntryState, not a
 * factory/context. Owns dismissal for the one-tap "make your first sequence"
 * starter card that renders on an empty Construct workspace for accounts
 * that have never saved anything.
 *
 * Mirrors first-run-state.svelte.ts's cloud-sync shape: localStorage first,
 * then a Firestore doc at users/{uid}/onboarding/firstSequenceStarter synced
 * on markDismissed(), with a missing-doc read resetting local state (so a
 * shared/reused browser never inherits a prior account's dismissal).
 *
 * `sessionRearm` is intentionally volatile (in-memory only, never persisted)
 * - it's how the Library empty-state CTA ("Make your first sequence") can
 * force the starter to show again for THIS visit even though it was
 * dismissed earlier, without permanently un-dismissing it. It's consumed
 * (cleared) the moment it's used: either markDismissed() consumes it (the
 * rearmed showing was itself dismissed/completed) or a successful keep
 * consumes it (see the host, which calls consumeSessionRearm() on save).
 *
 * resolveHasSavedAnything() is the account-aware "does this account have
 * anything saved yet" check used for eligibility. It intentionally does NOT
 * reuse the full library-loading path (getLibraryRepository().getSequences()
 * / BrowseEngine) - those hydrate the whole library for display. This is a
 * cheap existence probe:
 *   - guest -> Dexie db.sequences.count() > 0 (guests keep their library
 *     locally; reading Firestore here would race the best-effort save sync)
 *   - full account -> Firestore users/{uid}/sequences limit(1) (NEVER local
 *     Dexie for a full account - it isn't uid-scoped and could leak another
 *     account's local cache on a shared device, see create-browse-engine.svelte.ts)
 *
 * No-uid path (signed-out visitor, effectiveUserId === null): there is no
 * cloud doc to read and no auth state change coming that would ever trigger
 * one, so cloudSynced resolves LOCALLY and immediately rather than waiting
 * on a sync that will never fire (mirrors app-entry-state's no-uid
 * resolveCloudSync() branch, NOT first-run-state's plain early-return, which
 * would leave cloudSynced stuck false for a visitor forever).
 */

import {
  safeLocalStorageSetItem,
  removeLocalStorageItem,
} from "$lib/shared/foundation/services/storage-manager";
import { postHogFeatureFlagService } from "$lib/shared/auth/services/post-hog-feature-flag-service.svelte";

const DISMISSED_KEY = "tka-first-sequence-starter-dismissed";

/** The single SP3-wide rollout flag (Part A + Part B), defaulted off. Read
 *  synchronously so the eligibility getter can gate at render time without an
 *  async gap (matches post-save-activation-state.svelte.ts's ACTIVATION_FLAG). */
const STARTER_FLAG = "capability:onboarding:first-session-activation" as const;

/**
 * Three-state eligibility for the starter card:
 *  - `unknown`    — the account-aware library existence check hasn't resolved
 *                   yet; the card renders NOTHING (no flash) while here.
 *  - `eligible`   — resolved, the account has saved nothing.
 *  - `ineligible` — resolved, the account already has a saved sequence.
 *
 * A Firestore/Dexie failure leaves this at `unknown` on purpose (never assume
 * "empty"): the card stays hidden and a later resolve() can retry.
 */
export type StarterEligibility = "unknown" | "eligible" | "ineligible";

interface FirstSequenceStarterState {
  /** Whether the starter card has been dismissed (persisted). */
  dismissed: boolean;
  /** Whether we've resolved the FROM-cloud read this session (or determined
   *  none is needed, e.g. no-uid). */
  cloudSynced: boolean;
  /** True while a cloud pull is in flight. */
  syncInProgress: boolean;
  /** Volatile per-visit override - see file header. Never persisted. */
  sessionRearm: boolean;
  /** Resolved-library eligibility - see StarterEligibility. */
  eligibility: StarterEligibility;
}

function createFirstSequenceStarterState() {
  const isBrowser = typeof window !== "undefined";

  const dismissedFlag = isBrowser
    ? localStorage.getItem(DISMISSED_KEY) === "true"
    : false;

  const state = $state<FirstSequenceStarterState>({
    dismissed: dismissedFlag,
    cloudSynced: false,
    syncInProgress: false,
    sessionRearm: false,
    eligibility: "unknown",
  });

  interface EpochTask {
    epoch: number;
    promise: Promise<void>;
  }

  // Every reset starts a new account/session generation. Async work captures
  // the generation it belongs to and must prove it is still current before it
  // can update reactive state or account-scoped storage.
  let epoch = 0;

  // The workspace mount and tutorial arbitration can race the auth boot sync.
  // Each kind of work is shared within one epoch, while a reset immediately
  // detaches the old task so the new account can begin its own reads.
  let resolveTask: EpochTask | null = null;
  let cloudSyncTask: EpochTask | null = null;

  function isCurrentEpoch(taskEpoch: number): boolean {
    return epoch === taskEpoch;
  }

  function invalidateAsyncWork() {
    epoch += 1;
    resolveTask = null;
    cloudSyncTask = null;
  }

  function resolveCloudSync(taskEpoch = epoch) {
    if (!isCurrentEpoch(taskEpoch)) return;
    state.cloudSynced = true;
    state.syncInProgress = false;
  }

  return {
    get dismissed() {
      return state.dismissed;
    },
    get cloudSynced() {
      return state.cloudSynced;
    },
    get syncInProgress() {
      return state.syncInProgress;
    },
    get sessionRearm() {
      return state.sessionRearm;
    },
    get eligibility() {
      return state.eligibility;
    },

    /**
     * The single predicate the starter card mount AND the tutorial arbitration
     * share (SP3): should the one-tap starter own this first-run moment?
     *
     * True only when the rollout flag is on, the async library check has
     * resolved to "empty", and the card isn't dismissed (a Library-CTA session
     * rearm forces it back even after a dismissal). `unknown` eligibility reads
     * as false, so nothing renders and no tutorial is suppressed until we
     * actually know - that's what makes the surface flash-free.
     *
     * The tab / empty-workspace gate lives at the mount site
     * (StandardWorkspaceLayout), not here - this predicate is tab-agnostic so
     * the arbitration in CreateModule can consume it directly.
     */
    get isEligible() {
      if (!postHogFeatureFlagService.canAccess(STARTER_FLAG)) return false;
      if (state.sessionRearm) return true;
      if (state.eligibility !== "eligible") return false;
      return !state.dismissed;
    },

    /**
     * Resolve the account-aware library existence check (and the cloud
     * dismissal read it depends on) so eligibility settles from `unknown`.
     * Idempotent + guarded: it only does async work once per resolved state,
     * short-circuits when the flag is off (feature dark - spend no read), and
     * leaves eligibility `unknown` on failure so we never assume "empty".
     */
    resolve(): Promise<void> {
      if (!isBrowser) return Promise.resolve();
      // Feature dark: the getter's own flag check keeps isEligible false, so
      // there's nothing to gain from a Firestore/Dexie read here.
      if (!postHogFeatureFlagService.canAccess(STARTER_FLAG))
        return Promise.resolve();
      if (state.eligibility !== "unknown") return Promise.resolve();
      // A resolve is already in flight - join it so awaiters see the settled
      // eligibility, not a half-resolved `unknown`.
      const resolveEpoch = epoch;
      if (resolveTask?.epoch === resolveEpoch) return resolveTask.promise;

      const task = (async () => {
        try {
          // Respect a dismissal made on another device before we ever show.
          await this.syncFromCloud();
          if (!isCurrentEpoch(resolveEpoch)) return;

          const hasSaved = await resolveHasSavedAnything();
          if (!isCurrentEpoch(resolveEpoch)) return;

          state.eligibility = hasSaved ? "ineligible" : "eligible";
        } catch (error) {
          if (!isCurrentEpoch(resolveEpoch)) return;

          // Stay `unknown` (never "empty") - the card stays hidden and a later
          // resolve() can retry.
          console.warn(
            "[firstSequenceStarterState] Failed to resolve eligibility:",
            error
          );
        }
      })();

      const joinedTask: Promise<void> = task.finally(() => {
        // An old account's completion must not clear a newer account's
        // in-flight resolve after reset.
        if (
          resolveTask?.epoch === resolveEpoch &&
          resolveTask.promise === joinedTask
        ) {
          resolveTask = null;
        }
      });
      resolveTask = { epoch: resolveEpoch, promise: joinedTask };

      return joinedTask;
    },

    /**
     * Force the starter to be eligible again for this visit, regardless of
     * the persisted dismissal. Called by the Library empty-state CTA.
     */
    rearmForSession() {
      state.sessionRearm = true;
      // The Library CTA only exists in BrowsePanel's genuine-empty state.
      // Trust that newer evidence over a cached "had sequences" result from
      // before the user deleted their last sequence.
      state.eligibility = "eligible";
    },

    /** Consume the session rearm without touching persisted dismissal (used
     *  by a successful keep, so the rearm doesn't leak into a later visit). */
    consumeSessionRearm() {
      state.sessionRearm = false;
    },

    /**
     * Mark the starter dismissed. Persists locally, consumes any active
     * session rearm, and syncs to cloud (non-blocking).
     */
    markDismissed() {
      if (!isBrowser) return;

      state.dismissed = true;
      state.sessionRearm = false;

      safeLocalStorageSetItem(DISMISSED_KEY, "true");

      this.syncToCloud();
    },

    /** Reset (testing/dev). */
    reset() {
      if (!isBrowser) return;

      invalidateAsyncWork();
      state.dismissed = false;
      state.cloudSynced = false;
      state.syncInProgress = false;
      state.sessionRearm = false;
      state.eligibility = "unknown";

      removeLocalStorageItem(DISMISSED_KEY);
    },

    /**
     * Reset cloud sync + eligibility (call on signout so an A->B account switch
     * re-resolves against account B's cloud/library instead of reusing A's
     * already-settled state).
     */
    resetCloudSync() {
      invalidateAsyncWork();
      state.cloudSynced = false;
      state.syncInProgress = false;
      state.sessionRearm = false;
      state.eligibility = "unknown";
    },

    /** Mark cloud sync complete without a read (sync path failed externally). */
    markCloudSyncComplete() {
      resolveCloudSync();
    },

    /**
     * Sync dismissal FROM Firebase. A missing doc means this account has
     * never dismissed the starter on any device - reset local state rather
     * than inheriting a prior account's dismissal (shared/reused browser).
     */
    async syncFromCloud(): Promise<void> {
      if (!isBrowser || state.cloudSynced) return;

      const syncEpoch = epoch;
      if (cloudSyncTask?.epoch === syncEpoch) {
        return cloudSyncTask.promise;
      }

      state.syncInProgress = true;

      const task = (async () => {
        try {
          const { authState } =
            await import("$lib/shared/auth/state/auth-state.svelte");
          if (!isCurrentEpoch(syncEpoch)) return;

          const userId = authState.effectiveUserId;
          if (!userId) {
            // No-uid visitor: nothing to sync, ever. Resolve locally now
            // rather than leaving cloudSynced stuck false.
            resolveCloudSync(syncEpoch);
            return;
          }

          const { getFirestoreInstance } =
            await import("$lib/shared/auth/firebase");
          const { doc, getDoc } = await import("firebase/firestore");
          if (
            !isCurrentEpoch(syncEpoch) ||
            authState.effectiveUserId !== userId
          ) {
            return;
          }

          const firestore = await getFirestoreInstance();
          if (
            !isCurrentEpoch(syncEpoch) ||
            authState.effectiveUserId !== userId
          ) {
            return;
          }

          const docRef = doc(
            firestore,
            `users/${userId}/onboarding/firstSequenceStarter`
          );
          const docSnap = await getDoc(docRef);
          if (
            !isCurrentEpoch(syncEpoch) ||
            authState.effectiveUserId !== userId
          ) {
            return;
          }

          if (docSnap.exists() && docSnap.data().dismissed === true) {
            state.dismissed = true;
            safeLocalStorageSetItem(DISMISSED_KEY, "true");
          } else {
            // Missing doc, or a doc without dismissed=true - reset local state
            // so a shared/reused browser doesn't inherit a prior account's
            // dismissal. Cloud is authoritative per account, both directions.
            state.dismissed = false;
            removeLocalStorageItem(DISMISSED_KEY);
          }

          resolveCloudSync(syncEpoch);
        } catch (error) {
          if (!isCurrentEpoch(syncEpoch)) return;

          console.warn(
            "[firstSequenceStarterState] Failed to sync from cloud:",
            error
          );
          resolveCloudSync(syncEpoch);
        } finally {
          if (isCurrentEpoch(syncEpoch)) {
            state.syncInProgress = false;
          }
        }
      })();

      const joinedTask: Promise<void> = task.finally(() => {
        if (
          cloudSyncTask?.epoch === syncEpoch &&
          cloudSyncTask.promise === joinedTask
        ) {
          cloudSyncTask = null;
        }
      });
      cloudSyncTask = { epoch: syncEpoch, promise: joinedTask };

      return joinedTask;
    },

    /** Sync dismissal TO Firebase. Called automatically by markDismissed(). */
    async syncToCloud(): Promise<void> {
      if (!isBrowser) return;

      const writeEpoch = epoch;

      try {
        const { authState } = await import(
          "$lib/shared/auth/state/auth-state.svelte"
        );
        if (!isCurrentEpoch(writeEpoch)) return;

        const userId = authState.effectiveUserId;
        if (!userId) return;
        const dismissed = state.dismissed;

        const { getFirestoreInstance } = await import(
          "$lib/shared/auth/firebase"
        );
        const { doc, setDoc, serverTimestamp } = await import(
          "firebase/firestore"
        );
        if (
          !isCurrentEpoch(writeEpoch) ||
          authState.effectiveUserId !== userId
        ) {
          return;
        }

        const firestore = await getFirestoreInstance();
        if (
          !isCurrentEpoch(writeEpoch) ||
          authState.effectiveUserId !== userId
        ) {
          return;
        }

        const docRef = doc(
          firestore,
          `users/${userId}/onboarding/firstSequenceStarter`
        );

        await setDoc(
          docRef,
          {
            dismissed,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        if (!isCurrentEpoch(writeEpoch)) return;

        console.warn(
          "[firstSequenceStarterState] Failed to sync to cloud:",
          error
        );
      }
    },
  };
}

// Singleton instance
export const firstSequenceStarterState = createFirstSequenceStarterState();

/**
 * Account-aware "has this account saved anything yet" existence probe.
 * See file header for why this doesn't reuse the full library-loading path.
 */
export async function resolveHasSavedAnything(): Promise<boolean> {
  const { authState } = await import(
    "$lib/shared/auth/state/auth-state.svelte"
  );

  if (!authState.isFullAccount) {
    // Guest (or signed-out visitor with an anonymous session): library lives
    // locally in Dexie.
    const { db } = await import(
      "$lib/shared/persistence/database/tka-database"
    );
    const count = await db.sequences.count();
    return count > 0;
  }

  // Full account: Firestore is authoritative. NEVER read Dexie here - it
  // isn't uid-scoped and could surface another account's local cache on a
  // shared device.
  const userId = authState.effectiveUserId;
  if (!userId) return false;

  const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
  const { collection, query, limit, getDocs } = await import(
    "firebase/firestore"
  );
  const { getUserSequencesPath } = await import(
    "$lib/shared/library/data/firestore-paths"
  );

  const firestore = await getFirestoreInstance();
  const sequencesQuery = query(
    collection(firestore, getUserSequencesPath(userId)),
    limit(1)
  );
  const snap = await getDocs(sequencesQuery);
  return !snap.empty;
}
