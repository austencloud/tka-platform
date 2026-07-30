export const CONSTRUCT_TUTORIAL_STAGES = [
  "start-position",
  "next-pictograph",
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

export interface ConstructTutorialState {
  readonly status: ConstructTutorialStatus;
  readonly isActive: boolean;
  readonly stage: ConstructTutorialStage;
  readonly currentStepNumber: number;
  readonly totalSteps: number;
  readonly positionLabel: string | null;
  readonly addedLetter: string | null;
  start(): void;
  reset(): void;
  dismiss(): void;
  recordStartPosition(label: string | null): boolean;
  recordOptionApplied(option: AppliedTutorialOption): boolean;
  recordFullPlay(): boolean;
}

/**
 * Tracks only successful actions in the live Construct workflow. Account-level
 * persistence remains owned by appEntryState at the Create composition root.
 */
export function createConstructTutorialState(): ConstructTutorialState {
  let status = $state<ConstructTutorialStatus>("inactive");
  let stage = $state<ConstructTutorialStage>("start-position");
  let positionLabel = $state<string | null>(null);
  let addedLetter = $state<string | null>(null);

  function start() {
    status = "active";
    stage = "start-position";
    positionLabel = null;
    addedLetter = null;
  }

  function reset() {
    status = "inactive";
    stage = "start-position";
    positionLabel = null;
    addedLetter = null;
  }

  function dismiss() {
    if (status === "active") {
      status = "dismissed";
    }
  }

  function recordStartPosition(label: string | null): boolean {
    if (status !== "active" || stage !== "start-position") return false;
    positionLabel = label;
    stage = "next-pictograph";
    return true;
  }

  function recordOptionApplied(option: AppliedTutorialOption): boolean {
    if (status === "active" && stage === "next-pictograph") {
      addedLetter = option.letter;
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
    get addedLetter() {
      return addedLetter;
    },
    start,
    reset,
    dismiss,
    recordStartPosition,
    recordOptionApplied,
    recordFullPlay,
  };
}
