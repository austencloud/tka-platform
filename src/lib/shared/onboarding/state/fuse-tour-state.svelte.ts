/**
 * Fuse Tour State
 *
 * Tracks whether the user has seen the Fuse tab walkthrough.
 * Triggers automatically on first visit.
 */

import { AUTO_TOURS_ENABLED } from "../domain/onboarding-flags";

const TOUR_COMPLETED_KEY = "tka-fuse-tour-completed";

export type FuseTourStop =
  | "welcome"
  | "panels"
  | "shuffle"
  | "fuse";

const STOPS: FuseTourStop[] = [
  "welcome",
  "panels",
  "shuffle",
  "fuse",
];

interface FuseTourData {
  hasCompleted: boolean;
  isActive: boolean;
  currentStopIndex: number;
  actionCompleted: boolean;
}

function createFuseTourState() {
  const isBrowser = typeof window !== "undefined";

  const completed = isBrowser
    ? localStorage.getItem(TOUR_COMPLETED_KEY) === "true"
    : false;

  const data = $state<FuseTourData>({
    hasCompleted: completed,
    isActive: false,
    currentStopIndex: 0,
    actionCompleted: false,
  });

  return {
    get hasCompleted() {
      return data.hasCompleted;
    },
    get isActive() {
      return data.isActive;
    },
    get currentStopIndex() {
      return data.currentStopIndex;
    },
    get currentStop(): FuseTourStop {
      return STOPS[data.currentStopIndex] ?? "fuse";
    },
    get totalStops() {
      return STOPS.length;
    },
    get isLastStop() {
      return data.currentStopIndex >= STOPS.length - 1;
    },
    get actionCompleted() {
      return data.actionCompleted;
    },

    /** Signal that the user performed the required action (e.g. shuffled) */
    completeAction() {
      data.actionCompleted = true;
    },

    /** No-op while auto-tours are deactivated; restart() is not gated. */
    triggerIfFirstTime(): boolean {
      if (!AUTO_TOURS_ENABLED) return false;
      if (data.hasCompleted) return false;
      data.isActive = true;
      data.currentStopIndex = 0;
      return true;
    },

    advance() {
      if (data.currentStopIndex < STOPS.length - 1) {
        data.currentStopIndex++;
        data.actionCompleted = false;
      } else {
        this.complete();
      }
    },

    goBack() {
      if (data.currentStopIndex > 0) {
        data.currentStopIndex--;
        data.actionCompleted = false;
      }
    },

    complete() {
      if (!isBrowser) return;
      data.isActive = false;
      data.hasCompleted = true;
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    },

    skip() {
      if (!isBrowser) return;
      data.isActive = false;
      data.hasCompleted = true;
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    },

    restart() {
      data.isActive = true;
      data.currentStopIndex = 0;
    },

    reset() {
      if (!isBrowser) return;
      data.hasCompleted = false;
      data.isActive = false;
      data.currentStopIndex = 0;
      localStorage.removeItem(TOUR_COMPLETED_KEY);
    },
  };
}

export const fuseTourState = createFuseTourState();
