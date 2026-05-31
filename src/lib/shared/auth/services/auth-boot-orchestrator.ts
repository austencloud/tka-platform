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
}
