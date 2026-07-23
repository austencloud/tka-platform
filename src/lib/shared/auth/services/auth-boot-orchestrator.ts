import type { User } from "firebase/auth";
import { logSessionStart } from "../../analytics/services/posthog-activity-logger";
import { getPresenceTracker } from "../../presence/get-presence-tracker";
import { ensureSystemCollections } from "$lib/shared/library/services/collection-manager";

export async function initializeChildServices(
  user: User,
  getUserFromState: () => User | null
): Promise<void> {
  try {
    logSessionStart().catch((error: unknown) => {
      console.warn("⚠️ [authState] Session start logging failed:", error);
    });
  } catch {
    // Silently fail - activity logging is non-critical
  }

  // Initialize presence tracking (non-blocking)
  (async () => {
    try {
      const presenceService = getPresenceTracker();
      if (presenceService) {
        await presenceService.initialize();
      }
    } catch (error) {
      console.warn("⚠️ [authState] Presence initialization failed:", error);
    }
  })();

  // Initialize settings Firebase sync (non-blocking)
  import("$lib/shared/settings/state/settings-state.svelte")
    .then(async (settingsModule) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await settingsModule.settingsService.initializeFirebaseSync();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Settings sync initialization failed:", error);
    });

  // Initialize global arrow adjustments (non-blocking)
  import("$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton")
    .then(async ({ initializeGlobalAdjustments }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await initializeGlobalAdjustments();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Global arrow adjustments initialization failed:", error);
    });

  // Initialize prop geometry adjustments (non-blocking)
  import("$lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-singleton")
    .then(async ({ initializePropGeometryAdjustments }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await initializePropGeometryAdjustments();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Prop geometry adjustments initialization failed:", error);
    });

  // Initialize special arrow placement overrides (non-blocking)
  import("$lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton")
    .then(async ({ initializeSpecialOverrides }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await initializeSpecialOverrides();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Special placement overrides initialization failed:", error);
    });

  // Initialize default arrow placement overrides (non-blocking)
  import("$lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton")
    .then(async ({ initializeDefaultOverrides }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await initializeDefaultOverrides();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Default placement overrides initialization failed:", error);
    });

  // Sync first-run status FROM cloud
  import("$lib/shared/onboarding/state/first-run-state.svelte")
    .then(async ({ firstRunState }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await firstRunState.syncFromCloud();
    })
    .catch(async (error) => {
      console.warn("⚠️ [authState] First-run sync failed:", error);
      try {
        const { firstRunState } = await import("$lib/shared/onboarding/state/first-run-state.svelte");
        firstRunState.markCloudSyncComplete();
      } catch {
        // If even the import fails, app is in a very bad state
      }
    });

  // Sync generate-tour status FROM cloud (suppresses the "First time
  // generating?" offer on this device if the user took or dismissed it on
  // another). Non-blocking; localStorage carries the flag if this fails.
  import("$lib/shared/onboarding/state/generate-tour-state.svelte")
    .then(async ({ generateTourState }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await generateTourState.syncFromCloud();
    })
    .catch(async (error) => {
      console.warn("⚠️ [authState] Generate-tour sync failed:", error);
      try {
        const { generateTourState } = await import("$lib/shared/onboarding/state/generate-tour-state.svelte");
        generateTourState.markCloudSyncComplete();
      } catch {
        // Non-fatal; localStorage carries the flag
      }
    });

  // Sync app-entry status FROM cloud (suppresses a re-offered create-tutorial
  // prompt on a device where onboarding was already completed elsewhere).
  // Previously write-only - this was the missing read-back call.
  import("$lib/shared/onboarding/state/app-entry-state.svelte")
    .then(async ({ appEntryState }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await appEntryState.syncFromCloud();
    })
    .catch(async (error) => {
      console.warn("⚠️ [authState] App-entry sync failed:", error);
      try {
        const { appEntryState } = await import("$lib/shared/onboarding/state/app-entry-state.svelte");
        appEntryState.markCloudSyncComplete();
      } catch {
        // Non-fatal; the pending offer would otherwise stay deferred forever
      }
    });

  // Sync first-sequence-starter dismissal FROM cloud (SP3b) — suppresses a
  // re-offered one-tap starter on a device where it was already dismissed or
  // consumed elsewhere. Sibling of the app-entry sync above; same non-blocking
  // shape so a failure here never stalls other boot sync. Only runs inside the
  // if(user)-gated cascade — a no-uid visitor resolves locally via the state
  // module's own no-uid branch, not here.
  import("$lib/shared/onboarding/state/first-sequence-starter-state.svelte")
    .then(async ({ firstSequenceStarterState }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await firstSequenceStarterState.syncFromCloud();
    })
    .catch(async (error) => {
      console.warn("⚠️ [authState] First-sequence-starter sync failed:", error);
      try {
        const { firstSequenceStarterState } = await import(
          "$lib/shared/onboarding/state/first-sequence-starter-state.svelte"
        );
        firstSequenceStarterState.markCloudSyncComplete();
      } catch {
        // Non-fatal; local resolution still carries eligibility
      }
    });

  // Initialize onboarding Firebase sync (non-blocking)
  import("$lib/shared/onboarding/config/storage-keys")
    .then(async (onboardingModule) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await onboardingModule.syncOnboardingToCloud();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Onboarding sync failed:", error);
    });

  // Initialize system collections (Favorites, etc.) - non-blocking
  (async () => {
    try {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();

      // Re-check auth after async gap
      if (!getUserFromState()) return;

      await ensureSystemCollections();
    } catch (error) {
      console.warn("⚠️ [authState] System collections init failed:", error);
    }
  })();

  // Start the Library collection subscriptions at boot so their local mirror is
  // written well before the user opens Library — the panel's own ensureStarted()
  // is idempotent per-uid, so its call becomes a no-op and Library paints from
  // the fresh mirror instantly. (non-blocking)
  import("$lib/features/library/state/collections-state.svelte")
    .then(({ collectionsState }) => {
      if (getUserFromState()) collectionsState.ensureStarted();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Collections prewarm failed:", error);
    });
  import("$lib/features/library/state/followed-collections-state.svelte")
    .then(({ followedCollectionsState }) => {
      if (getUserFromState()) followedCollectionsState.ensureStarted();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Followed collections prewarm failed:", error);
    });

  // Initialize mandala collection Firebase sync (non-blocking)
  import("$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte")
    .then(async ({ mandalaCollectionState }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await mandalaCollectionState.init(user.uid);
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Mandala collection sync failed:", error);
    });

  // Initialize tunnel collection Firebase sync (non-blocking)
  import("$lib/features/tunnel-collection/state/tunnel-collection-state.svelte")
    .then(async ({ tunnelCollectionState }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await tunnelCollectionState.init(user.uid);
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Tunnel collection sync failed:", error);
    });

  // Initialize 3D scene collection Firebase sync (non-blocking)
  import("$lib/features/scene-3d-collection/state/scene-3d-collection-state.svelte")
    .then(async ({ scene3dCollectionState }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await scene3dCollectionState.init(user.uid);
    })
    .catch((error) => {
      console.warn("⚠️ [authState] 3D scene collection sync failed:", error);
    });
}
