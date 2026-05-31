/**
 * Create Tutorial State
 *
 * Manages the 4-step create tutorial wizard.
 * The "add-beat" step repeats until the user has picked REQUIRED_BEATS beats.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export const REQUIRED_BEATS = 4;

export type CreateTutorialStep =
  | "pick-start"
  | "add-beat"
  | "play-sequence"
  | "ready";

const STEPS: CreateTutorialStep[] = [
  "pick-start",
  "add-beat",
  "play-sequence",
  "ready",
];

interface CreateTutorialData {
  currentStepIndex: number;
  startPosition: PictographData | null;
  gridMode: GridMode;
  beats: PictographData[];
}

function createCreateTutorialState() {
  const data = $state<CreateTutorialData>({
    currentStepIndex: 0,
    startPosition: null,
    gridMode: GridMode.DIAMOND,
    beats: [],
  });

  return {
    get currentStepIndex() {
      return data.currentStepIndex;
    },
    get currentStep(): CreateTutorialStep {
      return STEPS[data.currentStepIndex] ?? "ready";
    },
    get totalSteps() {
      return STEPS.length;
    },
    get progress() {
      return ((data.currentStepIndex + 1) / STEPS.length) * 100;
    },
    get startPosition() {
      return data.startPosition;
    },
    get gridMode() {
      return data.gridMode;
    },
    get beats(): PictographData[] {
      return data.beats;
    },
    /** Full sequence: start position + all beats */
    get sequence(): PictographData[] {
      const seq: PictographData[] = [];
      if (data.startPosition) seq.push(data.startPosition);
      seq.push(...data.beats);
      return seq;
    },
    get beatsRemaining() {
      return REQUIRED_BEATS - data.beats.length;
    },

    setStartPosition(pos: PictographData, gridMode?: GridMode) {
      data.startPosition = pos;
      // Clear beats - they were computed from the old start position
      data.beats = [];
      if (gridMode) {
        data.gridMode = gridMode;
      }
    },

    addStep(beat: PictographData) {
      data.beats.push(beat);
    },

    /** Remove the last beat (for undo/back within the add-beat step) */
    removeLastBeat() {
      data.beats.pop();
    },

    advance() {
      if (data.currentStepIndex < STEPS.length - 1) {
        data.currentStepIndex++;
      }
    },

    goBack() {
      if (data.currentStepIndex > 0) {
        data.currentStepIndex--;
      }
    },

    goToStep(index: number) {
      if (index >= 0 && index < STEPS.length) {
        data.currentStepIndex = index;
      }
    },

    reset() {
      data.currentStepIndex = 0;
      data.startPosition = null;
      data.gridMode = GridMode.DIAMOND;
      data.beats = [];
    },
  };
}

export const createTutorialState = createCreateTutorialState();
