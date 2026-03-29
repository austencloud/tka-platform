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
const TOUR_INDEX_KEY = "tka-generate-tour-index";

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
    },

    skip() {
      if (!isBrowser) return;
      data.isActive = false;
      data.hasCompleted = true;
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
      localStorage.removeItem(TOUR_INDEX_KEY);
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

    /** Reset for testing/development */
    reset() {
      if (!isBrowser) return;
      data.hasCompleted = false;
      data.isActive = false;
      data.currentStopIndex = 0;
      localStorage.removeItem(TOUR_COMPLETED_KEY);
      localStorage.removeItem(TOUR_INDEX_KEY);
    },
  };
}

export const generateTourState = createGenerateTourState();
