export type SequenceTransformActionId =
  | "mirror"
  | "flip"
  | "invert"
  | "rotate"
  | "swap"
  | "rewind";

export type SequencePatternActionId =
  | "turn-pattern"
  | "direction"
  | "duration"
  | "extend"
  | "shift-start";

export type SequenceActionId =
  | SequenceTransformActionId
  | SequencePatternActionId;

export type SequenceTransformCommandId =
  | "mirror"
  | "flip"
  | "swap"
  | "invert"
  | "rewind"
  | "rotate_counterclockwise"
  | "rotate_clockwise"
  | "shift_start";

export type SequenceActionSource = "header" | "panel" | "keyboard";

export type SequenceActionTargetHand = "left" | "right" | "both";

export interface SequenceTransformCommandOptions {
  source: SequenceActionSource;
  targetHand?: SequenceActionTargetHand;
  stepNumber?: number;
}

export type SequenceTransformCommandResult =
  | { status: "completed" }
  | { status: "busy" }
  | { status: "unavailable"; message: string }
  | { status: "failed"; message: string };

export type SequenceActionsOpenSource =
  | "header"
  | "workspace_button"
  | "restore"
  | "step_edit"
  | "workflow"
  | "unknown";
