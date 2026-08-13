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
