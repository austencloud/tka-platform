/**
 * Generate Panel Tour State
 *
 * Tracks the guided tour through generator settings cards.
 * Triggered when user taps the "?" help button.
 *
 * Stop list is derived from the card registry so the tour
 * automatically includes any new cards added to the generator.
 */

import { CARD_REGISTRY, type GeneratorCardId } from "$lib/features/create/generate/shared/domain/card-registry";

const TOUR_COMPLETED_KEY = "tka-generate-tour-completed";

export type GenerateTourStop = GeneratorCardId;

const STOPS: GeneratorCardId[] = CARD_REGISTRY.map((c) => c.id) as GeneratorCardId[];

interface GenerateTourData {
  hasCompleted: boolean;
  isActive: boolean;
  currentStopIndex: number;
}

function createGenerateTourState() {
  const isBrowser = typeof window !== "undefined";

  const completed = isBrowser
    ? localStorage.getItem(TOUR_COMPLETED_KEY) === "true"
    : false;

  const data = $state<GenerateTourData>({
    hasCompleted: completed,
    isActive: false,
    currentStopIndex: 0,
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
    get currentStop(): GenerateTourStop {
      return STOPS[data.currentStopIndex] ?? "generate-button";
    },
    get totalStops() {
      return STOPS.length;
    },
    get isLastStop() {
      return data.currentStopIndex >= STOPS.length - 1;
    },

    /** Start the tour (from help button tap). */
    start() {
      data.isActive = true;
      data.currentStopIndex = 0;
    },

    advance() {
      if (data.currentStopIndex < STOPS.length - 1) {
        data.currentStopIndex++;
      } else {
        this.complete();
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

    /** Jump directly to a specific stop (from clicking a mini card). */
    goToStop(stop: GenerateTourStop) {
      const index = STOPS.indexOf(stop);
      if (index >= 0) {
        data.currentStopIndex = index;
      }
    },

    /** Replay the tour (from help button after first completion) */
    restart() {
      data.isActive = true;
      data.currentStopIndex = 0;
    },

    /** Reset for testing/development */
    reset() {
      if (!isBrowser) return;
      data.hasCompleted = false;
      data.isActive = false;
      data.currentStopIndex = 0;
      localStorage.removeItem(TOUR_COMPLETED_KEY);
    },
  };
}

export const generateTourState = createGenerateTourState();
