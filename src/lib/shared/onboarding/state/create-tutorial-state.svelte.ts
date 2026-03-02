/**
 * Create Tutorial State
 *
 * Manages the 5-step create tutorial wizard.
 * Steps auto-advance when the user completes each action (no Continue button).
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export type CreateTutorialStep =
  | "pick-start"
  | "add-beat"
  | "open-actions"
  | "play-sequence"
  | "ready";

const STEPS: CreateTutorialStep[] = [
  "pick-start",
  "add-beat",
  "open-actions",
  "play-sequence",
  "ready",
];

interface CreateTutorialData {
  currentStepIndex: number;
  startPosition: PictographData | null;
  selectedBeat: PictographData | null;
}

function createCreateTutorialState() {
  const data = $state<CreateTutorialData>({
    currentStepIndex: 0,
    startPosition: null,
    selectedBeat: null,
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
    get selectedBeat() {
      return data.selectedBeat;
    },
    get sequence(): PictographData[] {
      const seq: PictographData[] = [];
      if (data.startPosition) seq.push(data.startPosition);
      if (data.selectedBeat) seq.push(data.selectedBeat);
      return seq;
    },

    setStartPosition(pos: PictographData) {
      data.startPosition = pos;
    },

    setSelectedBeat(beat: PictographData) {
      data.selectedBeat = beat;
    },

    advance() {
      if (data.currentStepIndex < STEPS.length - 1) {
        data.currentStepIndex++;
      }
    },

    reset() {
      data.currentStepIndex = 0;
      data.startPosition = null;
      data.selectedBeat = null;
    },
  };
}

export const createTutorialState = createCreateTutorialState();
