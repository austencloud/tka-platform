export const CONSTRUCT_TUTORIAL_STAGES = [
  "start-position",
  "movement-type",
  "movement-option",
  "play-sequence",
] as const;

export type ConstructTutorialStage = (typeof CONSTRUCT_TUTORIAL_STAGES)[number];
export type ConstructTutorialStatus =
  | "inactive"
  | "active"
  | "dismissed"
  | "completed";

export interface AppliedTutorialOption {
  letter: string | null;
  stepNumber: number;
}

/**
 * Tracks only successful actions in the live Construct workflow. Account-level
 * persistence remains owned by appEntryState at the Create composition root.
 */
export function createConstructTutorialState() {
  let status = $state<ConstructTutorialStatus>("inactive");
  let stage = $state<ConstructTutorialStage>("start-position");
  let positionLabel = $state<string | null>(null);
  let movementLetter = $state<string | null>(null);

  function start() {
    status = "active";
    stage = "start-position";
    positionLabel = null;
    movementLetter = null;
  }

  function reset() {
    status = "inactive";
    stage = "start-position";
    positionLabel = null;
    movementLetter = null;
  }

  function dismiss() {
    if (status === "active") {
      status = "dismissed";
    }
  }

  function recordStartPosition(label: string): boolean {
    if (status !== "active" || stage !== "start-position") return false;
    positionLabel = label;
    stage = "movement-type";
    return true;
  }

  function recordMovementType(): boolean {
    if (status !== "active" || stage !== "movement-type") return false;
    stage = "movement-option";
    return true;
  }

  function recordOptionApplied(option: AppliedTutorialOption): boolean {
    if (status === "active" && stage === "movement-option") {
      movementLetter = option.letter;
      stage = "play-sequence";
      return true;
    }

    return false;
  }

  function recordFullPlay(): boolean {
    if (status !== "active" || stage !== "play-sequence") return false;
    status = "completed";
    return true;
  }

  return {
    get status() {
      return status;
    },
    get isActive() {
      return status === "active";
    },
    get stage() {
      return stage;
    },
    get currentStepNumber() {
      return CONSTRUCT_TUTORIAL_STAGES.indexOf(stage) + 1;
    },
    get totalSteps() {
      return CONSTRUCT_TUTORIAL_STAGES.length;
    },
    get positionLabel() {
      return positionLabel;
    },
    get movementLetter() {
      return movementLetter;
    },
    start,
    reset,
    dismiss,
    recordStartPosition,
    recordMovementType,
    recordOptionApplied,
    recordFullPlay,
  };
}

export type ConstructTutorialState = ReturnType<
  typeof createConstructTutorialState
>;
