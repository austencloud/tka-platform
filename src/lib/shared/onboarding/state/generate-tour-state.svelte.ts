/**
 * Generate Panel Tour State
 *
 * Tracks the guided tour through generator settings cards.
 * Triggered when user taps the "?" help button.
 *
 * Stop list is derived from the card registry so the tour
 * automatically includes any new cards added to the generator.
 */

import { CARD_REGISTRY, type GeneratorCardId } from "$lib/shared/create/domain/card-registry";

const TOUR_COMPLETED_KEY = "tka-generate-tour-completed";
const TOUR_INDEX_KEY = "tka-generate-tour-index";
// Whether the first-run offer ("First time generating?") has been shown and
// resolved — by taking the tour or by dismissing it ("I'll explore"). Reused
// verbatim from GenerateEmptyState so existing local dismissals carry over.
const TOUR_OFFERED_KEY = "tka-generate-tour-offered";

export type GenerateTourStop = GeneratorCardId;

const STOPS: GeneratorCardId[] = CARD_REGISTRY.map((c) => c.id) as GeneratorCardId[];

interface GenerateTourData {
  hasCompleted: boolean;
  /** First-run offer has been resolved (offered-and-dismissed or completed). */
  wasOffered: boolean;
  isActive: boolean;
  currentStopIndex: number;
  /** True once the FROM-cloud pull has resolved (or is known unnecessary). */
  cloudSynced: boolean;
}

function createGenerateTourState() {
  const isBrowser = typeof window !== "undefined";

  const completed = isBrowser
    ? localStorage.getItem(TOUR_COMPLETED_KEY) === "true"
    : false;
  const offered = isBrowser
    ? localStorage.getItem(TOUR_OFFERED_KEY) === "true"
    : false;

  const data = $state<GenerateTourData>({
    hasCompleted: completed,
    wasOffered: offered,
    isActive: false,
    currentStopIndex: 0,
    cloudSynced: false,
  });

  /**
   * Persist tour resolution TO Firebase so the offer stays suppressed on the
   * user's other devices. Non-blocking; localStorage remains the source of
   * truth if the write fails. Mirrors first-run-state's syncToCloud.
   */
  async function syncToCloud(): Promise<void> {
    if (!isBrowser) return;

    try {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      const { authState } = await import(
        "$lib/shared/auth/state/auth-state.svelte"
      );

      const userId = authState.effectiveUserId;
      if (!userId) return;

      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, `users/${userId}/onboarding/generateTour`);

      await setDoc(
        docRef,
        {
          completed: data.hasCompleted,
          offered: data.wasOffered,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.warn("[generateTourState] Failed to sync to cloud:", error);
    }
  }

  return {
    get hasCompleted() {
      return data.hasCompleted;
    },
    get wasOffered() {
      return data.wasOffered;
    },
    /**
     * The first-run offer should stay hidden once the user has either taken
     * the tour or dismissed the offer — on ANY device once cloud-synced.
     */
    get hasResolvedOffer() {
      return data.wasOffered || data.hasCompleted;
    },
    get cloudSynced() {
      return data.cloudSynced;
    },
    get isActive() {
      return data.isActive;
    },
    get currentStopIndex() {
      return data.currentStopIndex;
    },
    get currentStop(): GenerateTourStop {
      return STOPS[data.currentStopIndex] ?? "generate-button";
    },
    get totalStops() {
      return STOPS.length;
    },
    get isLastStop() {
      return data.currentStopIndex >= STOPS.length - 1;
    },

    /** Start the tour (from help button tap). Resumes from last position if closed mid-tour. */
    start() {
      const saved = isBrowser
        ? parseInt(localStorage.getItem(TOUR_INDEX_KEY) ?? "0", 10)
        : 0;
      data.isActive = true;
      data.currentStopIndex = Math.min(saved, STOPS.length - 1);
    },

    advance() {
      if (data.currentStopIndex < STOPS.length - 1) {
        data.currentStopIndex++;
        if (isBrowser) localStorage.setItem(TOUR_INDEX_KEY, String(data.currentStopIndex));
      } else {
        this.complete();
      }
    },

    /** Go back one stop (for keyboard ← navigation). */
    retreat() {
      if (data.currentStopIndex > 0) {
        data.currentStopIndex--;
        if (isBrowser) localStorage.setItem(TOUR_INDEX_KEY, String(data.currentStopIndex));
      }
    },

    complete() {
      if (!isBrowser) return;
      data.isActive = false;
      data.hasCompleted = true;
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
      localStorage.removeItem(TOUR_INDEX_KEY);
      void syncToCloud();
    },

    skip() {
      if (!isBrowser) return;
      data.isActive = false;
      data.hasCompleted = true;
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
      localStorage.removeItem(TOUR_INDEX_KEY);
      void syncToCloud();
    },

    /**
     * Mark the first-run offer as resolved (shown-and-dismissed, or accepted).
     * Idempotent. Persists locally and to the cloud so the offer stays
     * suppressed across the user's devices.
     */
    markOffered() {
      if (data.wasOffered) return;
      data.wasOffered = true;
      if (isBrowser) {
        localStorage.setItem(TOUR_OFFERED_KEY, "true");
      }
      void syncToCloud();
    },

    /** Jump directly to a specific stop (from clicking a mini card). */
    goToStop(stop: GenerateTourStop) {
      const index = STOPS.indexOf(stop);
      if (index >= 0) {
        data.currentStopIndex = index;
        if (isBrowser) localStorage.setItem(TOUR_INDEX_KEY, String(index));
      }
    },

    /** Replay the tour (from help button after first completion) */
    restart() {
      data.isActive = true;
      data.currentStopIndex = 0;
      if (isBrowser) localStorage.removeItem(TOUR_INDEX_KEY);
    },

    /**
     * Sync tour resolution FROM Firebase. Call on authentication so a user who
     * completed or dismissed the offer on another device isn't re-offered here.
     * Mirrors first-run-state.syncFromCloud, including the brand-new-user reset
     * (so a shared browser doesn't inherit the previous account's state).
     */
    async syncFromCloud(): Promise<void> {
      if (!isBrowser || data.cloudSynced) return;

      try {
        const { getFirestoreInstance } = await import(
          "$lib/shared/auth/firebase"
        );
        const { doc, getDoc } = await import("firebase/firestore");
        const { authState } = await import(
          "$lib/shared/auth/state/auth-state.svelte"
        );

        const userId = authState.effectiveUserId;
        if (!userId) {
          // No account to pull from — local state is authoritative. Resolve the
          // gate so the offer can render for genuine first-run guests.
          data.cloudSynced = true;
          return;
        }

        const firestore = await getFirestoreInstance();
        const docRef = doc(firestore, `users/${userId}/onboarding/generateTour`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const cloud = docSnap.data();
          if (cloud.completed) {
            data.hasCompleted = true;
            localStorage.setItem(TOUR_COMPLETED_KEY, "true");
          }
          if (cloud.offered) {
            data.wasOffered = true;
            localStorage.setItem(TOUR_OFFERED_KEY, "true");
          }
        } else {
          // Brand-new account (or first sign-in on this browser for it): clear
          // any inherited local flags so a new user still gets the offer.
          data.hasCompleted = false;
          data.wasOffered = false;
          localStorage.removeItem(TOUR_COMPLETED_KEY);
          localStorage.removeItem(TOUR_OFFERED_KEY);
          localStorage.removeItem(TOUR_INDEX_KEY);
        }

        data.cloudSynced = true;
      } catch (error) {
        console.warn("[generateTourState] Failed to sync from cloud:", error);
        // Don't strand the offer-gate on a network error — fall back to local.
        data.cloudSynced = true;
      }
    },

    /**
     * Resolve the cloud-sync gate without pulling (call when the external sync
     * path fails before syncFromCloud runs), so the offer isn't stuck hidden.
     */
    markCloudSyncComplete() {
      data.cloudSynced = true;
    },

    /** Reset for testing/development */
    reset() {
      if (!isBrowser) return;
      data.hasCompleted = false;
      data.wasOffered = false;
      data.isActive = false;
      data.currentStopIndex = 0;
      localStorage.removeItem(TOUR_COMPLETED_KEY);
      localStorage.removeItem(TOUR_OFFERED_KEY);
      localStorage.removeItem(TOUR_INDEX_KEY);
    },
  };
}

export const generateTourState = createGenerateTourState();
