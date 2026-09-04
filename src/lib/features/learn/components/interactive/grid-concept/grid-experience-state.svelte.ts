/**
 * Grid Experience State Machine
 * Manages step progression, phase transitions, persistence, and accessibility announcements
 */

import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";

export type GridPhase = "split" | "diamond-labels" | "box-labels" | "merged";
export type PointTypePhase = "center" | "hand" | "outer";
export type EffectivePhase =
  | "intro"
  | "split"
  | "diamond-labels"
  | "box-labels"
  | "merged";
export type HighlightPhase = "none" | "center" | "hand" | "outer";

export const GRID_LAST_STEP = 2;

export function normalizeGridStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(GRID_LAST_STEP, Math.trunc(step)));
}

export interface GridExperienceState {
  step: number;
  gridPhase: GridPhase;
  pointTypePhase: PointTypePhase;
  animateIn: boolean;
  announcement: string;
}

export function createGridExperienceState(isScrollMode: boolean = false) {
  const persistence = getExperiencePersistence("grid");
  const initialState = !isScrollMode
    ? persistence.load()
    : { step: 0, phaseData: {} };

  const totalSteps = GRID_LAST_STEP + 1;

  // Core state
  let step = $state(normalizeGridStep(initialState.step));
  let gridPhase = $state<GridPhase>(
    (initialState.phaseData?.gridPhase as GridPhase) ?? "split"
  );
  let pointTypePhase = $state<PointTypePhase>(
    (initialState.phaseData?.pointTypePhase as PointTypePhase) ?? "center"
  );
  let animateIn = $state(false);
  let announcement = $state("");

  // Derived phases for GridMergeAnimation
  const effectivePhase = $derived<EffectivePhase>(
    step === 0 ? "intro" : step === 1 ? gridPhase : "merged"
  );

  const effectiveHighlightPhase = $derived<HighlightPhase>(
    step === 2 ? pointTypePhase : "none"
  );

  // Accessibility: derive announcement text
  function getAnnouncement(): string {
    if (step === 0) return "Step 1 of 3: The Grid. A 4-point diamond grid.";
    if (step === 1) {
      if (gridPhase === "split")
        return "Step 2 of 3: Two Grid Modes. Diamond and Box grids shown side by side.";
      if (gridPhase === "diamond-labels")
        return "Diamond mode: Cardinal directions North, East, South, West.";
      if (gridPhase === "box-labels")
        return "Box mode: Intercardinal directions Northeast, Southeast, Southwest, Northwest.";
      if (gridPhase === "merged")
        return "The grids merge to form the complete 8-point grid.";
    }
    if (step === 2) {
      if (pointTypePhase === "center")
        return "Step 3 of 3: Point Types. The center point is highlighted.";
      if (pointTypePhase === "hand") return "4 hand points are highlighted.";
      if (pointTypePhase === "outer") return "4 outer points are highlighted.";
    }
    return "";
  }

  function announce() {
    announcement = "";
    requestAnimationFrame(() => {
      announcement = getAnnouncement();
    });
  }

  function startAnimations() {
    requestAnimationFrame(() => {
      animateIn = true;
      announce();
    });
  }

  // Returns true if handled internally (phase change), false if step change needed
  function handleNextPhase(): boolean {
    // Step 1 grid phases
    if (step === 1) {
      if (gridPhase === "split") {
        gridPhase = "diamond-labels";
        persistence.savePhaseData("gridPhase", "diamond-labels");
        announce();
        return true;
      } else if (gridPhase === "diamond-labels") {
        gridPhase = "box-labels";
        persistence.savePhaseData("gridPhase", "box-labels");
        announce();
        return true;
      } else if (gridPhase === "box-labels") {
        gridPhase = "merged";
        persistence.savePhaseData("gridPhase", "merged");
        announce();
        return true;
      } else if (gridPhase === "merged") {
        // Reset for next time
        gridPhase = "split";
        persistence.savePhaseData("gridPhase", "split");
        pointTypePhase = "center";
        persistence.savePhaseData("pointTypePhase", "center");
        return false; // Proceed to next step
      }
    }

    // Step 2 point type phases
    if (step === 2) {
      if (pointTypePhase === "center") {
        pointTypePhase = "hand";
        persistence.savePhaseData("pointTypePhase", "hand");
        announce();
        return true;
      } else if (pointTypePhase === "hand") {
        pointTypePhase = "outer";
        persistence.savePhaseData("pointTypePhase", "outer");
        announce();
        return true;
      } else if (pointTypePhase === "outer") {
        pointTypePhase = "center";
        persistence.savePhaseData("pointTypePhase", "center");
        return false; // Proceed to next step
      }
    }

    return false;
  }

  // Returns true if handled internally (phase change), false if step change needed
  function handleBackPhase(): boolean {
    // Step 1 grid phases
    if (step === 1) {
      if (gridPhase === "merged") {
        gridPhase = "box-labels";
        persistence.savePhaseData("gridPhase", "box-labels");
        announce();
        return true;
      } else if (gridPhase === "box-labels") {
        gridPhase = "diamond-labels";
        persistence.savePhaseData("gridPhase", "diamond-labels");
        announce();
        return true;
      } else if (gridPhase === "diamond-labels") {
        gridPhase = "split";
        persistence.savePhaseData("gridPhase", "split");
        announce();
        return true;
      }
    }

    // Step 2 point type phases
    if (step === 2) {
      if (pointTypePhase === "outer") {
        pointTypePhase = "hand";
        persistence.savePhaseData("pointTypePhase", "hand");
        announce();
        return true;
      } else if (pointTypePhase === "hand") {
        pointTypePhase = "center";
        persistence.savePhaseData("pointTypePhase", "center");
        announce();
        return true;
      }
    }

    return false;
  }

  function nextStep(onComplete?: () => void) {
    animateIn = false;
    requestAnimationFrame(() => {
      step++;
      persistence.saveStep(step);
      requestAnimationFrame(() => {
        animateIn = true;
        announce();
        onComplete?.();
      });
    });
  }

  function prevStep(onComplete?: () => void) {
    animateIn = false;
    requestAnimationFrame(() => {
      step--;
      persistence.saveStep(step);
      // Reset phases when returning to previous steps
      if (step === 1) {
        gridPhase = "merged";
        persistence.savePhaseData("gridPhase", "merged");
      } else if (step === 2) {
        pointTypePhase = "outer";
        persistence.savePhaseData("pointTypePhase", "outer");
      }
      requestAnimationFrame(() => {
        animateIn = true;
        announce();
        onComplete?.();
      });
    });
  }

  function reset() {
    persistence.reset();
  }

  function setScrollMode() {
    gridPhase = "merged";
  }

  return {
    // State (reactive getters)
    get step() {
      return step;
    },
    get gridPhase() {
      return gridPhase;
    },
    get pointTypePhase() {
      return pointTypePhase;
    },
    get animateIn() {
      return animateIn;
    },
    get announcement() {
      return announcement;
    },
    get effectivePhase() {
      return effectivePhase;
    },
    get effectiveHighlightPhase() {
      return effectiveHighlightPhase;
    },
    totalSteps,

    // Actions
    startAnimations,
    handleNextPhase,
    handleBackPhase,
    nextStep,
    prevStep,
    reset,
    setScrollMode,
  };
}

export type GridExperienceStateManager = ReturnType<
  typeof createGridExperienceState
>;
